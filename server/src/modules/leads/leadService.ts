import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction, isUniqueViolation, type Db } from '../../db/tx.js';
import { HttpError } from '../../http/errors.js';
import {
  LEAD_TRANSITIONS,
  MAX_QUANTITY_PER_ITEM,
  type CreateLeadInput,
  type LeadStatus
} from './leadSchemas.js';
import type { VerifiedTelegramUser } from './telegramAuth.js';

/** Identical phone + cart inside this window is treated as an accidental double submit. */
const DUPLICATE_WINDOW_MINUTES = 10;

export interface LeadItemView {
  productId: string | null;
  productName: string;
  brand: string;
  volume: string;
  unitPrice: number;
  quantity: number;
}

export interface LeadHistoryView {
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  actor: string;
  createdAt: string;
}

export interface LeadView {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  comment: string | null;
  status: LeadStatus;
  staffNote: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  source: 'web' | 'telegram';
  itemsTotal: number;
  createdAt: string;
  updatedAt: string;
  contactedAt: string | null;
  items: LeadItemView[];
  history?: LeadHistoryView[];
}

interface LeadRow {
  id: string;
  lead_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  comment: string | null;
  status: LeadStatus;
  staff_note: string | null;
  telegram_id: string | null;
  telegram_username: string | null;
  source: 'web' | 'telegram';
  idempotency_key: string | null;
  items_total: string;
  created_at: Date;
  updated_at: Date;
  contacted_at: Date | null;
}

interface ItemRow {
  lead_id: string;
  product_id: string | null;
  product_name: string;
  brand: string;
  volume: string;
  unit_price: string;
  quantity: number;
}

const LEAD_COLUMNS = `id, lead_number, first_name, last_name, phone, comment, status, staff_note, telegram_id,
  telegram_username, source, idempotency_key, items_total, created_at, updated_at, contacted_at`;

function toView(row: LeadRow, items: ItemRow[]): LeadView {
  return {
    id: row.id,
    leadNumber: row.lead_number,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    comment: row.comment,
    status: row.status,
    staffNote: row.staff_note,
    telegramId: row.telegram_id,
    telegramUsername: row.telegram_username,
    source: row.source,
    itemsTotal: Number(row.items_total),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    contactedAt: row.contacted_at ? row.contacted_at.toISOString() : null,
    items: items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      brand: item.brand,
      volume: item.volume,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity
    }))
  };
}

async function loadItems(db: Db, leadIds: string[]): Promise<Map<string, ItemRow[]>> {
  const byLead = new Map<string, ItemRow[]>();
  if (!leadIds.length) return byLead;
  const result = await db.query<ItemRow>(
    `SELECT lead_id, product_id, product_name, brand, volume, unit_price, quantity
       FROM lead_items WHERE lead_id = ANY($1::text[]) ORDER BY lead_id, position, id`,
    [leadIds]
  );
  for (const item of result.rows) {
    const list = byLead.get(item.lead_id) ?? [];
    list.push(item);
    byLead.set(item.lead_id, list);
  }
  return byLead;
}

async function hydrate(db: Db, rows: LeadRow[]): Promise<LeadView[]> {
  const items = await loadItems(db, rows.map((row) => row.id));
  return rows.map((row) => toView(row, items.get(row.id) ?? []));
}

// ----------------------------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------------------------

interface CartLine {
  productId: string;
  quantity: number;
}

/** The same product on two lines is one line; per-item limits cannot be bypassed by repeating it. */
function mergeLines(items: CreateLeadInput['items']): CartLine[] {
  const merged = new Map<string, number>();
  for (const item of items) merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  return [...merged].map(([productId, quantity]) => {
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      throw new HttpError(400, 'quantity_limit', `Максимум ${MAX_QUANTITY_PER_ITEM} шт. одного товара`, { productId });
    }
    return { productId, quantity };
  });
}

const signature = (lines: Array<{ productId: string | null; quantity: number }>) =>
  lines
    .map((line) => `${line.productId ?? ''}:${line.quantity}`)
    .sort()
    .join('|');

/** Existing lead with the same key. Same payload = a retry (replay); a different payload = a client bug. */
async function findByIdempotencyKey(db: Db, key: string, phone: string, sig: string): Promise<LeadView | null> {
  const found = await db.query<LeadRow>(`SELECT ${LEAD_COLUMNS} FROM leads WHERE idempotency_key = $1`, [key]);
  if (!found.rows[0]) return null;
  const [view] = await hydrate(db, found.rows);
  if (view.phone !== phone || signature(view.items) !== sig) {
    throw new HttpError(409, 'idempotency_conflict', 'Этот ключ запроса уже использован для другой заявки');
  }
  return view;
}

async function findRecentDuplicate(db: Db, phone: string, sig: string): Promise<LeadView | null> {
  const recent = await db.query<LeadRow>(
    `SELECT ${LEAD_COLUMNS} FROM leads
      WHERE phone = $1 AND status <> 'cancelled' AND created_at > NOW() - make_interval(mins => $2)
      ORDER BY created_at DESC LIMIT 5`,
    [phone, DUPLICATE_WINDOW_MINUTES]
  );
  for (const view of await hydrate(db, recent.rows)) {
    if (signature(view.items) === sig) return view;
  }
  return null;
}

export interface CreateLeadResult {
  lead: LeadView;
  /** false when an earlier identical submission was returned instead of creating a new lead. */
  created: boolean;
}

export async function createLead(
  pool: Pool,
  input: CreateLeadInput,
  telegram: VerifiedTelegramUser | null
): Promise<CreateLeadResult> {
  const lines = mergeLines(input.items);
  const sig = signature(lines);

  // lead_number is random; on the (astronomically unlikely) collision simply draw another one.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await withTransaction(pool, (db) => insertLead(db, input, lines, sig, telegram));
    } catch (error) {
      if (isUniqueViolation(error, 'leads_lead_number_key')) continue;
      throw error;
    }
  }
  throw new HttpError(503, 'try_again', 'Не удалось сохранить заявку. Попробуйте ещё раз.');
}

async function insertLead(
  db: Db,
  input: CreateLeadInput,
  lines: CartLine[],
  sig: string,
  telegram: VerifiedTelegramUser | null
): Promise<CreateLeadResult> {
  const replay = await findByIdempotencyKey(db, input.idempotencyKey, input.phone, sig);
  if (replay) return { lead: replay, created: false };

  // Products are the source of truth for name, brand, volume and price. Nothing is reserved or decremented.
  const ids = lines.map((line) => line.productId).sort();
  const found = await db.query<{ id: string; name: string; brand: string; volume: string; price: number; in_stock: boolean }>(
    `SELECT id, name, brand, volume, price, in_stock FROM products WHERE id = ANY($1::text[])`,
    [ids]
  );
  const products = new Map(found.rows.map((row) => [row.id, row]));

  const missing = ids.filter((id) => !products.has(id));
  if (missing.length) {
    throw new HttpError(409, 'product_unavailable', 'Один из товаров больше недоступен. Обновите корзину.', { productIds: missing });
  }
  const soldOut = found.rows.filter((row) => !row.in_stock);
  if (soldOut.length) {
    throw new HttpError(409, 'out_of_stock', `Нет в наличии: ${soldOut.map((row) => `«${row.name}»`).join(', ')}`, {
      productIds: soldOut.map((row) => row.id)
    });
  }

  const duplicate = await findRecentDuplicate(db, input.phone, sig);
  if (duplicate) return { lead: duplicate, created: false };

  const snapshot = lines.map((line) => {
    const product = products.get(line.productId)!;
    return {
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      volume: product.volume,
      unitPrice: Math.round(Number(product.price)),
      quantity: line.quantity
    };
  });
  const itemsTotal = snapshot.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  const id = `lead-${randomUUID()}`;
  const leadNumber = `FL-${randomBytes(4).toString('hex').toUpperCase()}`;
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO leads (id, lead_number, first_name, last_name, phone, comment, telegram_id, telegram_username,
                        source, idempotency_key, items_total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      id, leadNumber, input.firstName, input.lastName, input.phone, input.comment,
      telegram?.id ?? null, telegram?.username ?? null, telegram ? 'telegram' : 'web',
      input.idempotencyKey, itemsTotal
    ]
  );
  if (!inserted.rowCount) {
    // A concurrent request with the same key committed first.
    const winner = await findByIdempotencyKey(db, input.idempotencyKey, input.phone, sig);
    if (winner) return { lead: winner, created: false };
    throw new HttpError(503, 'try_again', 'Не удалось сохранить заявку. Попробуйте ещё раз.');
  }

  for (const [position, line] of snapshot.entries()) {
    await db.query(
      `INSERT INTO lead_items (lead_id, position, product_id, product_name, brand, volume, unit_price, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, position, line.productId, line.productName, line.brand, line.volume, line.unitPrice, line.quantity]
    );
  }
  await db.query(
    `INSERT INTO lead_status_history (lead_id, from_status, to_status, actor) VALUES ($1, NULL, 'new', 'system')`,
    [id]
  );

  const created = await db.query<LeadRow>(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = $1`, [id]);
  const [lead] = await hydrate(db, created.rows);
  return { lead, created: true };
}

// ----------------------------------------------------------------------------------------------
// Admin: list, detail, update
// ----------------------------------------------------------------------------------------------

export interface ListLeadsParams {
  status?: LeadStatus;
  q?: string;
  page: number;
  pageSize: number;
}

export async function listLeads(pool: Pool, params: ListLeadsParams) {
  const where: string[] = [];
  const values: unknown[] = [];
  if (params.status) {
    values.push(params.status);
    where.push(`status = $${values.length}`);
  }
  if (params.q) {
    values.push(`%${params.q.replace(/[\\%_]/g, '\\$&')}%`);
    const p = `$${values.length}`;
    where.push(`(lead_number ILIKE ${p} OR phone ILIKE ${p} OR first_name ILIKE ${p} OR last_name ILIKE ${p})`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM leads ${clause}`, values);
  const rows = await pool.query<LeadRow>(
    `SELECT ${LEAD_COLUMNS} FROM leads ${clause}
      ORDER BY created_at DESC, id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, params.pageSize, (params.page - 1) * params.pageSize]
  );
  return {
    items: await hydrate(pool, rows.rows),
    page: params.page,
    pageSize: params.pageSize,
    total: total.rows[0].n
  };
}

async function withHistory(db: Db, view: LeadView): Promise<LeadView> {
  const history = await db.query<{ from_status: LeadStatus | null; to_status: LeadStatus; actor: string; created_at: Date }>(
    `SELECT from_status, to_status, actor, created_at FROM lead_status_history WHERE lead_id = $1 ORDER BY id`,
    [view.id]
  );
  return {
    ...view,
    history: history.rows.map((row) => ({
      fromStatus: row.from_status,
      toStatus: row.to_status,
      actor: row.actor,
      createdAt: row.created_at.toISOString()
    }))
  };
}

export async function getLead(pool: Pool, id: string): Promise<LeadView | null> {
  const found = await pool.query<LeadRow>(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = $1`, [id]);
  if (!found.rows[0]) return null;
  const [view] = await hydrate(pool, found.rows);
  return withHistory(pool, view);
}

export interface LeadPatch {
  status?: LeadStatus;
  /** undefined = leave unchanged; null or empty string = clear the note. */
  staffNote?: string | null;
}

export async function updateLead(pool: Pool, id: string, patch: LeadPatch, actor: string): Promise<LeadView> {
  return withTransaction(pool, async (db) => {
    // Row lock: two staff members changing the same lead are serialised, so a transition is validated
    // against the status that is really stored.
    const locked = await db.query<LeadRow>(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = $1 FOR UPDATE`, [id]);
    const current = locked.rows[0];
    if (!current) throw new HttpError(404, 'lead_not_found', 'Заявка не найдена');

    const statusChanges = patch.status !== undefined && patch.status !== current.status;
    if (statusChanges && !LEAD_TRANSITIONS[current.status].includes(patch.status!)) {
      throw new HttpError(409, 'invalid_transition',
        LEAD_TRANSITIONS[current.status].length
          ? `Нельзя перевести заявку из «${current.status}» в «${patch.status}»`
          : `Заявка уже закрыта («${current.status}») и не может быть изменена`,
        { from: current.status, to: patch.status, allowed: LEAD_TRANSITIONS[current.status] });
    }

    const noteChanges = patch.staffNote !== undefined;
    if (statusChanges || noteChanges) {
      await db.query(
        `UPDATE leads SET
           status = $2,
           staff_note = CASE WHEN $3::boolean THEN $4 ELSE staff_note END,
           contacted_at = CASE WHEN $2 = 'contacted' AND contacted_at IS NULL THEN NOW() ELSE contacted_at END,
           updated_at = NOW()
         WHERE id = $1`,
        [id, statusChanges ? patch.status : current.status, noteChanges, patch.staffNote ? patch.staffNote : null]
      );
    }
    if (statusChanges) {
      await db.query(
        `INSERT INTO lead_status_history (lead_id, from_status, to_status, actor) VALUES ($1, $2, $3, $4)`,
        [id, current.status, patch.status, actor]
      );
    }

    const reread = await db.query<LeadRow>(`SELECT ${LEAD_COLUMNS} FROM leads WHERE id = $1`, [id]);
    const [view] = await hydrate(db, reread.rows);
    return withHistory(db, view);
  });
}
