import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { withTransaction } from '../../db/tx.js';
import { asyncHandler, HttpError } from '../../http/errors.js';

// Inventory, sales, cost and profit. EVERYTHING here is admin-only: the caller mounts the router behind
// requireAdmin, and the public catalog (productRoutes.ts) never returns stock, cost or sales data.

export const LOW_STOCK_LIMIT = 2;
// Shop days are counted in Tashkent time, so "this month" and a sale at 00:30 land where the owner expects.
const SHOP_TZ = 'Asia/Tashkent';

const quantity = z.number().int('Укажите целое число').min(1, 'Количество должно быть не меньше 1').max(100000, 'Слишком большое количество');
const money = z.number().finite().min(0, 'Цена не может быть отрицательной').max(1e12, 'Слишком большая сумма');
const note = z.string().trim().max(200, 'Заметка не длиннее 200 символов').optional();

const receiptBody = z.object({ quantity, costPrice: money.optional(), note });
const saleBody = z.object({ quantity: quantity.default(1), unitPrice: money.optional(), note });
const setStockBody = z.object({ stockCount: z.number().int('Укажите целое число').min(0, 'Остаток не может быть отрицательным').max(1000000), note });
const costBody = z.object({ costPrice: money });
export const RESET_CONFIRM_WORD = 'ОБНУЛИТЬ';
const resetBody = z.object({ confirm: z.literal(RESET_CONFIRM_WORD, { error: `Для подтверждения введите слово ${RESET_CONFIRM_WORD}` }) });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}, 'Такой даты нет');
const monthText = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц в формате ГГГГ-ММ');

type MovementKind = 'receipt' | 'sale' | 'sale_cancel' | 'adjustment';

interface ProductRow {
  id: string;
  name: string;
  brand: string;
  category: string;
  volume: string;
  price: number;
  cost_price: number;
  stock_count: number;
  in_stock: boolean;
}

interface MovementRow {
  id: string;
  product_id: string | null;
  product_name: string;
  brand: string;
  kind: MovementKind;
  delta: number;
  stock_after: number;
  unit_price: number | null;
  list_price: number | null;
  unit_cost: number | null;
  note: string | null;
  actor: string;
  cancelled_at: Date | null;
  cancel_of: string | null;
  created_at: Date;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const num = (value: number | null) => (value === null ? null : Number(value));

const serializeStockItem = (row: ProductRow) => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  category: row.category,
  volume: row.volume,
  price: Number(row.price),
  costPrice: Number(row.cost_price),
  stockCount: row.stock_count,
  inStock: row.in_stock
});

const serializeMovement = (row: MovementRow) => ({
  id: String(row.id),
  productId: row.product_id,
  productName: row.product_name,
  brand: row.brand,
  kind: row.kind,
  delta: row.delta,
  stockAfter: row.stock_after,
  unitPrice: num(row.unit_price),
  listPrice: num(row.list_price),
  unitCost: num(row.unit_cost),
  note: row.note,
  actor: row.actor,
  cancelled: row.cancelled_at !== null,
  cancelOf: row.cancel_of === null ? null : String(row.cancel_of),
  createdAt: row.created_at.toISOString()
});

const PRODUCT_COLUMNS = 'id, name, brand, category, volume, price, cost_price, stock_count, in_stock';
const MOVEMENT_COLUMNS = `id, product_id, product_name, brand, kind, delta, stock_after, unit_price, list_price, unit_cost,
  note, actor, cancelled_at, cancel_of, created_at`;

const productNotFound = () => new HttpError(404, 'product_not_found', 'Товар не найден');

/**
 * Changes the stock of one product inside the caller's transaction and writes the matching journal row.
 * The UPDATE both locks the row and refuses to go below zero, so two sales of the last item can never both succeed.
 * The public in_stock flag follows the stock only at the edges: it turns off when the stock reaches 0 and turns
 * back on when something arrives at 0 (a product the admin hid by hand with stock left stays hidden).
 */
async function changeStock(
  client: PoolClient,
  productId: string,
  delta: number,
  entry: { kind: MovementKind; actor: string; note?: string; unitPrice?: number; costPrice?: number; cancelOf?: string }
): Promise<{ product: ProductRow; movement: MovementRow }> {
  const updated = await client.query<ProductRow & { list_price: number }>(
    `UPDATE products SET
       stock_count = stock_count + $2,
       in_stock = CASE WHEN stock_count + $2 = 0 THEN FALSE WHEN stock_count = 0 THEN TRUE ELSE in_stock END,
       cost_price = COALESCE($3::double precision, cost_price),
       updated_at = NOW()
     WHERE id = $1 AND stock_count + $2 >= 0
     RETURNING ${PRODUCT_COLUMNS}, price AS list_price`,
    [productId, delta, entry.costPrice ?? null]
  );
  const product = updated.rows[0];
  if (!product) {
    const current = await client.query<{ stock_count: number }>('SELECT stock_count FROM products WHERE id = $1', [productId]);
    if (!current.rowCount) throw productNotFound();
    throw new HttpError(409, 'insufficient_stock', `Недостаточно товара на складе: осталось ${current.rows[0].stock_count} шт.`);
  }
  const isSale = entry.kind === 'sale' || entry.kind === 'sale_cancel';
  const inserted = await client.query<MovementRow>(
    `INSERT INTO stock_movements (product_id, product_name, brand, kind, delta, stock_after, unit_price, list_price, unit_cost, note, actor, cancel_of)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${MOVEMENT_COLUMNS}`,
    [
      product.id, product.name, product.brand, entry.kind, delta, product.stock_count,
      isSale ? entry.unitPrice ?? product.price : null,
      isSale ? product.price : null,
      isSale || entry.kind === 'receipt' ? product.cost_price : null,
      entry.note || null, entry.actor, entry.cancelOf ?? null
    ]
  );
  return { product, movement: inserted.rows[0] };
}

interface ReportLine {
  productId: string | null;
  name: string;
  brand: string;
  salesCount: number;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
}

// CSV opened in Excel: a text cell starting with = + - @ would run as a formula, so it is neutralised.
function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
// Russian-locale Excel reads "1234,5", not "1234.5".
const csvNumber = (value: number) => String(round2(value)).replace('.', ',');

export function createInventoryRouter(pool: Pool) {
  const router = Router();
  const actorOf = (res: { locals: Record<string, any> }): string => String(res.locals.admin?.email ?? '');

  const loadProduct = async (id: string): Promise<ProductRow> => {
    const { rows } = await pool.query<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
    if (!rows[0]) throw productNotFound();
    return rows[0];
  };

  // ---- warehouse -----------------------------------------------------------------------------

  router.get('/products', asyncHandler(async (req, res) => {
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    const q = text(req.query.q).toLowerCase();
    const category = text(req.query.category);
    const brand = text(req.query.brand);
    const stockFilter = text(req.query.stock);

    const { rows } = await pool.query<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY brand, name, id`);
    const brands = [...new Set(rows.map((row) => row.brand))].sort((a, b) => a.localeCompare(b));
    // Filtered in JS: PostgreSQL's lower()/ILIKE depends on the database locale and may not fold Cyrillic.
    const items = rows.filter((row) => {
      if (q && !`${row.name} ${row.brand}`.toLowerCase().includes(q)) return false;
      if (category && row.category !== category) return false;
      if (brand && row.brand !== brand) return false;
      if (stockFilter === 'zero') return row.stock_count === 0;
      if (stockFilter === 'low') return row.stock_count >= 1 && row.stock_count <= LOW_STOCK_LIMIT;
      if (stockFilter === 'in') return row.stock_count > LOW_STOCK_LIMIT;
      return true;
    });
    const totals = items.reduce((sum, row) => ({
      products: sum.products + 1,
      units: sum.units + row.stock_count,
      costValue: sum.costValue + row.stock_count * Number(row.cost_price),
      retailValue: sum.retailValue + row.stock_count * Number(row.price)
    }), { products: 0, units: 0, costValue: 0, retailValue: 0 });
    res.set('Cache-Control', 'no-store').json({
      items: items.map(serializeStockItem),
      brands,
      lowStockLimit: LOW_STOCK_LIMIT,
      totals: { ...totals, costValue: round2(totals.costValue), retailValue: round2(totals.retailValue) }
    });
  }));

  router.post('/products/:id/receipt', asyncHandler(async (req, res) => {
    const body = receiptBody.parse(req.body);
    const result = await withTransaction(pool, (client) =>
      changeStock(client, req.params.id, body.quantity, { kind: 'receipt', actor: actorOf(res), note: body.note, costPrice: body.costPrice }));
    res.status(201).json({ product: serializeStockItem(result.product), movement: serializeMovement(result.movement) });
  }));

  router.post('/products/:id/sale', asyncHandler(async (req, res) => {
    const body = saleBody.parse(req.body);
    const result = await withTransaction(pool, (client) =>
      changeStock(client, req.params.id, -body.quantity, { kind: 'sale', actor: actorOf(res), note: body.note, unitPrice: body.unitPrice }));
    res.status(201).json({ product: serializeStockItem(result.product), movement: serializeMovement(result.movement) });
  }));

  // Sets the stock to an exact number (a recount). Recorded as an "adjustment" with the difference.
  router.put('/products/:id/stock', asyncHandler(async (req, res) => {
    const body = setStockBody.parse(req.body);
    const result = await withTransaction(pool, async (client) => {
      const locked = await client.query<{ stock_count: number }>('SELECT stock_count FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!locked.rowCount) throw productNotFound();
      const delta = body.stockCount - locked.rows[0].stock_count;
      if (delta === 0) return null;
      return changeStock(client, req.params.id, delta, { kind: 'adjustment', actor: actorOf(res), note: body.note });
    });
    if (!result) return res.json({ product: serializeStockItem(await loadProduct(req.params.id)), movement: null });
    res.json({ product: serializeStockItem(result.product), movement: serializeMovement(result.movement) });
  }));

  router.put('/products/:id/cost-price', asyncHandler(async (req, res) => {
    const body = costBody.parse(req.body);
    const { rows } = await pool.query<ProductRow>(
      `UPDATE products SET cost_price = $2, updated_at = NOW() WHERE id = $1 RETURNING ${PRODUCT_COLUMNS}`,
      [req.params.id, body.costPrice]
    );
    if (!rows[0]) throw productNotFound();
    res.json({ product: serializeStockItem(rows[0]) });
  }));

  // ---- cancelling a sale ---------------------------------------------------------------------

  router.post('/movements/:id/cancel', asyncHandler(async (req, res) => {
    if (!/^\d{1,18}$/.test(req.params.id)) throw new HttpError(404, 'movement_not_found', 'Запись не найдена');
    const result = await withTransaction(pool, async (client) => {
      const found = await client.query<MovementRow>(`SELECT ${MOVEMENT_COLUMNS} FROM stock_movements WHERE id = $1 FOR UPDATE`, [req.params.id]);
      const sale = found.rows[0];
      if (!sale) throw new HttpError(404, 'movement_not_found', 'Запись не найдена');
      if (sale.kind !== 'sale') throw new HttpError(409, 'not_a_sale', 'Отменить можно только продажу');
      if (sale.cancelled_at) throw new HttpError(409, 'already_cancelled', 'Эта продажа уже отменена');
      if (!sale.product_id) throw new HttpError(409, 'product_deleted', 'Товар удалён из каталога, вернуть его на склад нельзя');
      const restored = await changeStock(client, sale.product_id, -sale.delta, {
        kind: 'sale_cancel', actor: actorOf(res), note: `Отмена продажи №${sale.id}`, unitPrice: sale.unit_price ?? undefined, cancelOf: String(sale.id)
      });
      const marked = await client.query<MovementRow>(
        `UPDATE stock_movements SET cancelled_at = NOW() WHERE id = $1 RETURNING ${MOVEMENT_COLUMNS}`, [sale.id]);
      return { product: restored.product, sale: marked.rows[0], cancellation: restored.movement };
    });
    res.json({ product: serializeStockItem(result.product), sale: serializeMovement(result.sale), movement: serializeMovement(result.cancellation) });
  }));

  // ---- backups and reset ---------------------------------------------------------------------

  const sendCsv = (res: import('express').Response, filename: string, rows: string[][]) => {
    // BOM so Excel opens the UTF-8 file with Cyrillic intact; ";" is the list separator of Russian-locale Excel.
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' })
      .send('﻿' + rows.map((row) => row.join(';')).join('\r\n') + '\r\n');
  };

  router.get('/stock.csv', asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY brand, name, id`);
    const lines = [['ID', 'Товар', 'Бренд', 'Категория', 'Цена', 'Закупочная цена', 'Остаток', 'На сайте в наличии']];
    for (const row of rows) {
      lines.push([csvText(row.id), csvText(row.name), csvText(row.brand), csvText(row.category), csvNumber(Number(row.price)), csvNumber(Number(row.cost_price)), String(row.stock_count), row.in_stock ? 'да' : 'нет']);
    }
    sendCsv(res, 'stock.csv', lines);
  }));

  router.get('/movements.csv', asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<MovementRow>(`SELECT ${MOVEMENT_COLUMNS} FROM stock_movements ORDER BY created_at, id`);
    const lines = [['№', 'Дата (UTC)', 'Тип', 'Товар', 'Бренд', 'ID товара', 'Изменение', 'Остаток после', 'Цена продажи', 'Обычная цена', 'Себестоимость', 'Отменена', 'Заметка', 'Кто']];
    for (const row of rows) {
      const money = (value: number | null) => (value === null ? '' : csvNumber(Number(value)));
      lines.push([String(row.id), row.created_at.toISOString(), row.kind, csvText(row.product_name), csvText(row.brand), csvText(row.product_id ?? ''), String(row.delta), String(row.stock_after),
        money(row.unit_price), money(row.list_price), money(row.unit_cost), row.cancelled_at ? 'да' : '', csvText(row.note ?? ''), csvText(row.actor)]);
    }
    sendCsv(res, 'movements.csv', lines);
  }));

  // Sets every stock to 0 and clears the journal. The public in_stock flag and the cost prices are left alone.
  // The word must be sent again here, so a stray request cannot wipe the warehouse; the screen downloads the CSV backups first.
  router.post('/reset', asyncHandler(async (req, res) => {
    resetBody.parse(req.body);
    const result = await withTransaction(pool, async (client) => {
      const movements = await client.query('DELETE FROM stock_movements');
      const products = await client.query('UPDATE products SET stock_count = 0, updated_at = NOW() WHERE stock_count <> 0');
      return { movementsDeleted: movements.rowCount ?? 0, productsReset: products.rowCount ?? 0 };
    });
    res.json(result);
  }));

  // ---- journal -------------------------------------------------------------------------------

  const journalQuery = z.object({
    productId: z.string().trim().min(1).max(100).optional(),
    kind: z.enum(['receipt', 'sale', 'sale_cancel', 'adjustment']).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
  });

  router.get('/movements', asyncHandler(async (req, res) => {
    const query = journalQuery.parse({
      productId: req.query.productId || undefined, kind: req.query.kind || undefined,
      from: req.query.from || undefined, to: req.query.to || undefined,
      page: req.query.page || undefined, pageSize: req.query.pageSize || undefined
    });
    const conditions: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replace('?', `$${params.length}`)); };
    if (query.productId) add('product_id = ?', query.productId);
    if (query.kind) add('kind = ?', query.kind);
    if (query.from) add(`created_at >= (?::date)::timestamp AT TIME ZONE '${SHOP_TZ}'`, query.from);
    if (query.to) add(`created_at < ((?::date) + 1)::timestamp AT TIME ZONE '${SHOP_TZ}'`, query.to);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM stock_movements ${where}`, params);
    const { rows } = await pool.query<MovementRow>(
      `SELECT ${MOVEMENT_COLUMNS} FROM stock_movements ${where} ORDER BY created_at DESC, id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      params
    );
    res.set('Cache-Control', 'no-store').json({ items: rows.map(serializeMovement), page: query.page, pageSize: query.pageSize, total: Number(total.rows[0].count) });
  }));

  // ---- monthly report ------------------------------------------------------------------------

  async function buildReport(monthParam: unknown) {
    const month = monthParam
      ? monthText.parse(monthParam)
      : (await pool.query<{ month: string }>(`SELECT to_char(NOW() AT TIME ZONE '${SHOP_TZ}', 'YYYY-MM') AS month`)).rows[0].month;
    const start = `${month}-01`;
    const range = `created_at >= ($1::date)::timestamp AT TIME ZONE '${SHOP_TZ}' AND created_at < (($1::date) + INTERVAL '1 month')::timestamp AT TIME ZONE '${SHOP_TZ}'`;
    const sales = await pool.query<{ product_id: string | null; product_name: string; brand: string; sales_count: number; qty: number; revenue: number; cost: number }>(
      `SELECT product_id, product_name, brand, COUNT(*)::int AS sales_count, SUM(-delta)::int AS qty,
              SUM(-delta * unit_price) AS revenue, SUM(-delta * unit_cost) AS cost
         FROM stock_movements
        WHERE kind = 'sale' AND cancelled_at IS NULL AND ${range}
        GROUP BY product_id, product_name, brand`,
      [start]
    );
    const lines: ReportLine[] = sales.rows.map((row) => ({
      productId: row.product_id,
      name: row.product_name,
      brand: row.brand,
      salesCount: row.sales_count,
      quantity: row.qty,
      revenue: round2(Number(row.revenue)),
      cost: round2(Number(row.cost)),
      profit: round2(Number(row.revenue) - Number(row.cost))
    })).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name));
    const totals = lines.reduce((sum, line) => ({
      salesCount: sum.salesCount + line.salesCount,
      quantity: sum.quantity + line.quantity,
      revenue: sum.revenue + line.revenue,
      cost: sum.cost + line.cost,
      profit: sum.profit + line.profit
    }), { salesCount: 0, quantity: 0, revenue: 0, cost: 0, profit: 0 });

    const stock = await pool.query<{ id: string; name: string; brand: string; stock_count: number }>(
      `SELECT id, name, brand, stock_count FROM products WHERE stock_count <= $1 ORDER BY stock_count, brand, name`, [LOW_STOCK_LIMIT]);
    const pick = (row: { id: string; name: string; brand: string; stock_count: number }) => ({ id: row.id, name: row.name, brand: row.brand, stockCount: row.stock_count });
    return {
      month,
      lines,
      totals: { salesCount: totals.salesCount, quantity: totals.quantity, revenue: round2(totals.revenue), cost: round2(totals.cost), profit: round2(totals.profit) },
      lowStockLimit: LOW_STOCK_LIMIT,
      outOfStock: stock.rows.filter((row) => row.stock_count === 0).map(pick),
      lowStock: stock.rows.filter((row) => row.stock_count > 0).map(pick)
    };
  }

  router.get('/report', asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await buildReport(req.query.month || undefined));
  }));

  router.get('/report.csv', asyncHandler(async (req, res) => {
    const report = await buildReport(req.query.month || undefined);
    const rows: string[][] = [['Товар', 'Бренд', 'Продаж (раз)', 'Штук', 'Выручка', 'Себестоимость', 'Прибыль']];
    for (const line of report.lines) {
      rows.push([csvText(line.name), csvText(line.brand), String(line.salesCount), String(line.quantity), csvNumber(line.revenue), csvNumber(line.cost), csvNumber(line.profit)]);
    }
    const t = report.totals;
    rows.push(['ИТОГО', '', String(t.salesCount), String(t.quantity), csvNumber(t.revenue), csvNumber(t.cost), csvNumber(t.profit)]);
    rows.push([], [`Нет в наличии (0 шт.)`]);
    for (const item of report.outOfStock) rows.push([csvText(item.name), csvText(item.brand), '', '0']);
    rows.push([], [`Мало на складе (1-${report.lowStockLimit} шт.)`]);
    for (const item of report.lowStock) rows.push([csvText(item.name), csvText(item.brand), '', String(item.stockCount)]);
    // BOM so Excel opens the UTF-8 file with Cyrillic intact; ";" is the list separator of Russian-locale Excel.
    const body = '﻿' + rows.map((row) => row.join(';')).join('\r\n') + '\r\n';
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="report-${report.month}.csv"`,
      'Cache-Control': 'no-store'
    }).send(body);
  }));

  return router;
}
