// Black-box API tests for the leads backend.
// The real server.ts is started as a child process against a throwaway PostgreSQL, so routing, the
// admin cookie session, rate limiting, validation and the error middleware are all exercised.
//
//   npm test
//
// Database: by default a throwaway PostgreSQL is started from `embedded-postgres`, a test-only dependency that lives in
// test/package.json (so the production build never installs it). `npm test` installs it first (pretest), so
// `npm ci && npm test` works on a clean checkout. To use your own server
// instead (for example a CI service container) set TEST_DATABASE_URL to an EMPTY scratch database:
// its public schema is wiped.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';
import { normalizeUzPhone } from '../src/modules/leads/leadSchemas.js';
import { verifyTelegramInitData } from '../src/modules/leads/telegramAuth.js';
import { escapeHtml, formatLeadMessage } from '../src/modules/leads/leadNotification.js';
import type { LeadView } from '../src/modules/leads/leadService.js';

const SERVER_DIR = path.resolve(import.meta.dirname, '..');
const MIGRATIONS = path.join(SERVER_DIR, 'src/db/migrations');
const BOT_TOKEN = '123456:TEST-TOKEN-NOT-REAL';
const ADMIN_EMAIL = 'qa-admin@example.com';
const ADMIN_CODE = 'qa-access-code-for-tests-only';
const SESSION_SECRET = 'qa-session-secret-0123456789abcdef-xyz';

// ---------------------------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------------------------
let dbUrl = '';
let stopDb: () => Promise<void> = async () => undefined;
let db: pg.Pool;
const servers: ChildProcess[] = [];

/** Asks the OS for a free TCP port so the tests never collide with a dev server or another run. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T | 'timeout'> =>
  Promise.race([work, new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms).unref())]);

/** Kills a process and everything it spawned. Safe to call for a pid that is already gone. */
function killTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      // PostgreSQL can fork an I/O worker while it is shutting down. Such a late child is missing from the
      // tree that `taskkill /T` walked, and it survives its dead parent. Sweep anything still pointing at the pid.
      for (let attempt = 0; attempt < 3; attempt++) {
        spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
          `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
        ], { stdio: 'ignore' });
      }
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch { /* already gone */ }
}

/** The postmaster writes its pid on the first line of postmaster.pid inside the data directory. */
function postmasterPid(dataDir: string): number | undefined {
  try {
    const pid = Number(fs.readFileSync(path.join(dataDir, 'postmaster.pid'), 'utf8').split(/\r?\n/)[0]);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

async function startDatabase(): Promise<void> {
  if (process.env.TEST_DATABASE_URL) {
    dbUrl = process.env.TEST_DATABASE_URL;
    const admin = new pg.Client({ connectionString: dbUrl });
    await admin.connect();
    await admin.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await admin.end();
    return;
  }
  let EmbeddedPostgres: any;
  try {
    EmbeddedPostgres = (await import('embedded-postgres')).default;
  } catch (error) {
    throw new Error(`Cannot start the test database: run "npm test" (its pretest step installs test/node_modules) or set TEST_DATABASE_URL. ${(error as Error).message}`);
  }
  const port = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flaner-leads-pg-'));
  const instance = new EmbeddedPostgres({ databaseDir: dataDir, user: 'qa', password: 'qa', port, persistent: false, onLog: () => undefined, onError: () => undefined });

  // Last line of defence: if the test process dies without running `after`, never leave postgres behind.
  // The pid is remembered right after start: once the postmaster is gone, postmaster.pid is gone too, and
  // its orphaned worker processes could no longer be found.
  let knownPid: number | undefined;
  const killPostmaster = () => killTree(knownPid ?? postmasterPid(dataDir));
  process.once('exit', killPostmaster);

  stopDb = async () => {
    // A graceful stop is attempted first, but it must never be able to hang the run.
    await withTimeout(instance.stop().catch(() => undefined), 10_000);
    killPostmaster();
    process.removeListener('exit', killPostmaster);
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };

  await instance.initialise();
  await instance.start();
  knownPid = postmasterPid(dataDir);
  // The cluster uses the OS default encoding (WIN1251 on some Windows locales), so the test database is
  // created explicitly as UTF8 from template0.
  const admin = new pg.Client({ connectionString: `postgresql://qa:qa@localhost:${port}/postgres` });
  await admin.connect();
  await admin.query("CREATE DATABASE qa ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0");
  await admin.end();
  dbUrl = `postgresql://qa:qa@localhost:${port}/qa`;
}

/** Stops a spawned server and waits until it has really exited. */
async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  child.kill();
  if ((await withTimeout(exited, 5_000)) === 'timeout') {
    killTree(child.pid);
    await withTimeout(exited, 5_000);
  }
}

async function startServer(port: number, extraEnv: Record<string, string> = {}): Promise<string> {
  // Every variable that could reach a real service is set explicitly; dotenv never overrides them.
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'development', PORT: String(port), DATABASE_URL: dbUrl, DATABASE_SSL: 'false',
      ADMIN_ACCESS_CODE: ADMIN_CODE, ADMIN_SESSION_SECRET: SESSION_SECRET, ADMIN_EMAIL_ALLOWLIST: ADMIN_EMAIL,
      TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID: '', CORS_ORIGINS: '',
      LEADS_RATE_LIMIT_MAX: '1000', ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout?.on('data', (chunk) => { log += chunk; });
  child.stderr?.on('data', (chunk) => { log += chunk; });
  servers.push(child);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${log}`);
    try { if ((await fetch(`${base}/api/health`)).ok) return base; } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`server did not become healthy:\n${log}`);
}

before(async () => {
  await startDatabase();
  db = new pg.Pool({ connectionString: dbUrl, max: 4 });
  for (const file of fs.readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    await db.query(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }
  const product = (id: string, name: string, price: number, inStock: boolean, stock: number) =>
    db.query(
      `INSERT INTO products (id, name, brand, category, price, volume, in_stock, stock_count) VALUES ($1,$2,'Brand','makeup',$3,'50 ml',$4,$5)`,
      [id, name, price, inStock, stock]
    );
  await product('p-a', 'Serum A', 100000, true, 5);
  await product('p-b', 'Cream B', 250000, true, 0); // in_stock but stock_count 0: a lead must still be accepted
  await product('p-c', 'Gone C', 90000, false, 0);
  BASE = await startServer(await freePort());
  cookie = await adminLogin();
});

after(async () => {
  // Order matters: servers first (they hold connections), then our own pool, then the database itself.
  await Promise.all(servers.map(stopServer));
  await withTimeout(db?.end().catch(() => undefined) ?? Promise.resolve(), 5_000);
  await stopDb();
});

// ---------------------------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------------------------
let BASE = '';
let seq = 0;
const uniquePhone = () => `+99890${String(1000000 + ++seq).slice(-7)}`;
const idemKey = () => `idem-${Date.now()}-${++seq}-${Math.random().toString(36).slice(2, 8)}`;

async function call(method: string, url: string, body?: unknown, headers: Record<string, string> = {}, base = BASE) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text, headers: res.headers };
}

const validLead = (over: Record<string, unknown> = {}) => ({
  firstName: 'Анна', lastName: 'Иванова', phone: uniquePhone(), comment: 'Позвоните после 18:00',
  items: [{ productId: 'p-a', quantity: 2 }], idempotencyKey: idemKey(), ...over
});
const postLead = (body: unknown, headers?: Record<string, string>) => call('POST', '/api/leads', body, headers);
const leadCount = async () => (await db.query('SELECT count(*)::int n FROM leads')).rows[0].n as number;

let cookie = '';
const admin = (method: string, url: string, body?: unknown) => call(method, url, body, { Cookie: cookie });
async function adminLogin(base = BASE) {
  const res = await call('POST', '/api/admin/login', { email: ADMIN_EMAIL, code: ADMIN_CODE }, {}, base);
  assert.equal(res.status, 200, res.text);
  return (res.headers.getSetCookie()[0] ?? '').split(';')[0];
}

function signedInitData(user: object, authDate: number, token = BOT_TOKEN, tamper = false): string {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAH-test', user: JSON.stringify(user) });
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  let hash = createHmac('sha256', secret).update(check).digest('hex');
  if (tamper) hash = hash.replace(/^./, hash[0] === 'a' ? 'b' : 'a');
  params.set('hash', hash);
  return params.toString();
}


// ---------------------------------------------------------------------------------------------
// Unit tests (pure functions)
// ---------------------------------------------------------------------------------------------
describe('unit: phone, initData, notification', () => {
  it('normalizes Uzbek phone numbers', () => {
    assert.equal(normalizeUzPhone('+998 90 123-45-67'), '+998901234567');
    assert.equal(normalizeUzPhone('998901234567'), '+998901234567');
    assert.equal(normalizeUzPhone('(90) 123 45 67'), '+998901234567');
    for (const bad of ['', '12345', '+7 900 123 45 67', '+998 90 123 45', '+998 90 123 45 678', 'abc']) assert.equal(normalizeUzPhone(bad), null, bad);
  });

  it('accepts only correctly signed, fresh initData', () => {
    const now = Math.floor(Date.now() / 1000);
    const ok = verifyTelegramInitData(signedInitData({ id: 777, username: 'anna' }, now), BOT_TOKEN, 3600);
    assert.deepEqual(ok, { id: 777, username: 'anna' });
    assert.equal(verifyTelegramInitData(signedInitData({ id: 777 }, now, BOT_TOKEN, true), BOT_TOKEN, 3600), null, 'tampered hash');
    assert.equal(verifyTelegramInitData(signedInitData({ id: 777 }, now, 'other:token'), BOT_TOKEN, 3600), null, 'signed with another token');
    assert.equal(verifyTelegramInitData(signedInitData({ id: 777 }, now - 7200), BOT_TOKEN, 3600), null, 'expired');
    assert.equal(verifyTelegramInitData(signedInitData({ id: 777 }, now + 3600), BOT_TOKEN, 3600), null, 'from the future');
    assert.equal(verifyTelegramInitData(signedInitData({ id: 'x' }, now), BOT_TOKEN, 3600), null, 'non-numeric id');
    assert.equal(verifyTelegramInitData('garbage', BOT_TOKEN, 3600), null);
    assert.equal(verifyTelegramInitData(undefined, BOT_TOKEN, 3600), null);
    assert.equal(verifyTelegramInitData(signedInitData({ id: 1 }, now), '', 3600), null, 'no bot token configured');
  });

  it('escapes shopper-supplied HTML in the Telegram message', () => {
    assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href="x"&gt;&amp;&lt;/a&gt;');
    const lead = {
      leadNumber: 'FL-1', firstName: '<b>X</b>', lastName: '<script>', phone: '+998901234567', comment: '<a href="http://evil">click</a>',
      telegramUsername: 'u_<i>', itemsTotal: 1000,
      items: [{ productId: 'p', productName: '<img src=x>', brand: '<u>B</u>', volume: '<1>', unitPrice: 1000, quantity: 1 }]
    } as unknown as LeadView;
    const message = formatLeadMessage(lead);
    assert.ok(!/<(?!\/?(b|i|code)>)/.test(message.replace(/<\/?(b|i|code)>/g, '')), `unescaped tag in: ${message}`);
    assert.ok(message.includes('&lt;a href="http://evil"&gt;click&lt;/a&gt;'));
  });
});

// ---------------------------------------------------------------------------------------------
// POST /api/leads
// ---------------------------------------------------------------------------------------------
describe('POST /api/leads', () => {
  it('creates a lead with a price snapshot, history entry and no stock change', async () => {
    const stockBefore = (await db.query('SELECT id, stock_count, in_stock FROM products ORDER BY id')).rows;
    const body = validLead({
      phone: '+998 (90) 555-00-01', comment: '  with spaces  ',
      items: [{ productId: 'p-a', quantity: 2, price: 1, name: 'HACKED' }, { productId: 'p-b', quantity: 3 }]
    });
    const res = await postLead(body);
    assert.equal(res.status, 201, res.text);
    assert.match(res.json.leadNumber, /^FL-[0-9A-F]{8}$/);
    assert.equal(res.json.status, 'new');
    assert.equal(res.json.replayed, false);
    assert.equal(res.json.itemsTotal, 2 * 100000 + 3 * 250000);

    const lead = (await db.query('SELECT * FROM leads WHERE lead_number = $1', [res.json.leadNumber])).rows[0];
    assert.equal(lead.phone, '+998905550001');
    assert.equal(lead.comment, 'with spaces');
    assert.equal(lead.status, 'new');
    assert.equal(lead.source, 'web');
    assert.equal(lead.telegram_id, null);
    assert.equal(Number(lead.items_total), 950000);
    const items = (await db.query('SELECT * FROM lead_items WHERE lead_id = $1 ORDER BY position', [lead.id])).rows;
    assert.equal(items.length, 2);
    assert.deepEqual([items[0].product_id, items[0].product_name, Number(items[0].unit_price), items[0].quantity], ['p-a', 'Serum A', 100000, 2]);
    assert.deepEqual([items[1].product_id, items[1].product_name, Number(items[1].unit_price), items[1].quantity], ['p-b', 'Cream B', 250000, 3]);
    const history = (await db.query('SELECT from_status, to_status, actor FROM lead_status_history WHERE lead_id = $1', [lead.id])).rows;
    assert.deepEqual(history, [{ from_status: null, to_status: 'new', actor: 'system' }]);
    assert.deepEqual((await db.query('SELECT id, stock_count, in_stock FROM products ORDER BY id')).rows, stockBefore, 'stock must not change');
  });

  it('does not expose internal fields to the shopper', async () => {
    const res = await postLead(validLead());
    assert.equal(res.status, 201);
    for (const key of ['id', 'staffNote', 'telegramId', 'phone', 'firstName', 'idempotencyKey']) assert.ok(!(key in res.json), `leaked ${key}`);
  });

  it('keeps the old price in the snapshot after the catalog price changes', async () => {
    const res = await postLead(validLead({ items: [{ productId: 'p-a', quantity: 1 }] }));
    await db.query("UPDATE products SET price = 999999, name = 'Renamed' WHERE id = 'p-a'");
    const item = (await db.query(`SELECT i.product_name, i.unit_price FROM lead_items i JOIN leads l ON l.id = i.lead_id WHERE l.lead_number = $1`, [res.json.leadNumber])).rows[0];
    assert.deepEqual([item.product_name, Number(item.unit_price)], ['Serum A', 100000]);
    await db.query("UPDATE products SET price = 100000, name = 'Serum A' WHERE id = 'p-a'");
  });

  it('merges repeated lines and enforces the per-item limit after merging', async () => {
    const merged = await postLead(validLead({ items: [{ productId: 'p-a', quantity: 2 }, { productId: 'p-a', quantity: 3 }] }));
    assert.equal(merged.status, 201);
    assert.equal(merged.json.items.length, 1);
    assert.equal(merged.json.items[0].quantity, 5);
    const before = await leadCount();
    const over = await postLead(validLead({ items: [{ productId: 'p-a', quantity: 15 }, { productId: 'p-a', quantity: 10 }] }));
    assert.equal(over.status, 400);
    assert.equal(over.json.code, 'quantity_limit');
    assert.equal(await leadCount(), before);
  });

  const invalidCases: Array<[string, Record<string, unknown>]> = [
    ['missing firstName', { firstName: undefined }],
    ['blank lastName', { lastName: '   ' }],
    ['firstName > 60 chars', { firstName: 'a'.repeat(61) }],
    ['bad phone', { phone: '12345' }],
    ['foreign phone', { phone: '+7 900 123 45 67' }],
    ['phone not a string', { phone: 998901234567 }],
    ['comment > 500 chars', { comment: 'x'.repeat(501) }],
    ['empty items', { items: [] }],
    ['items not an array', { items: 'p-a' }],
    ['31 items', { items: Array.from({ length: 31 }, (_, i) => ({ productId: `p-${i}`, quantity: 1 })) }],
    ['quantity 0', { items: [{ productId: 'p-a', quantity: 0 }] }],
    ['quantity 21', { items: [{ productId: 'p-a', quantity: 21 }] }],
    ['fractional quantity', { items: [{ productId: 'p-a', quantity: 1.5 }] }],
    ['string quantity', { items: [{ productId: 'p-a', quantity: '2' }] }],
    ['negative quantity', { items: [{ productId: 'p-a', quantity: -1 }] }],
    ['blank productId', { items: [{ productId: '  ', quantity: 1 }] }],
    ['missing idempotencyKey', { idempotencyKey: undefined }],
    ['short idempotencyKey', { idempotencyKey: 'short' }]
  ];
  for (const [name, override] of invalidCases) {
    it(`rejects: ${name}`, async () => {
      const before = await leadCount();
      const res = await postLead(validLead(override));
      assert.equal(res.status, 400, res.text);
      assert.equal(res.json.code, 'validation_error');
      assert.ok(Array.isArray(res.json.details) && res.json.details.length > 0);
      assert.equal(await leadCount(), before, 'nothing may be stored');
    });
  }

  it('rejects malformed JSON and an empty body with 400 JSON errors', async () => {
    const bad = await call('POST', '/api/leads', '{"firstName": ');
    assert.equal(bad.status, 400);
    assert.equal(bad.json.code, 'bad_json');
    const empty = await call('POST', '/api/leads', {});
    assert.equal(empty.status, 400);
    assert.equal(empty.json.code, 'validation_error');
    const noType = await fetch(`${BASE}/api/leads`, { method: 'POST', body: 'firstName=x' });
    assert.equal(noType.status, 400);
  });

  it('rejects an unknown product and a sold-out product with 409 and stores nothing', async () => {
    const before = await leadCount();
    const unknown = await postLead(validLead({ items: [{ productId: 'p-a', quantity: 1 }, { productId: 'does-not-exist', quantity: 1 }] }));
    assert.equal(unknown.status, 409);
    assert.equal(unknown.json.code, 'product_unavailable');
    assert.deepEqual(unknown.json.details.productIds, ['does-not-exist']);
    const soldOut = await postLead(validLead({ items: [{ productId: 'p-c', quantity: 1 }] }));
    assert.equal(soldOut.status, 409);
    assert.equal(soldOut.json.code, 'out_of_stock');
    assert.equal(await leadCount(), before);
  });

  it('accepts a quantity above stock_count because leads reserve nothing', async () => {
    const res = await postLead(validLead({ items: [{ productId: 'p-b', quantity: 20 }] }));
    assert.equal(res.status, 201);
    assert.equal((await db.query("SELECT stock_count FROM products WHERE id = 'p-b'")).rows[0].stock_count, 0);
  });

  it('is idempotent: the same key and payload returns the same lead (200, replayed)', async () => {
    const body = validLead();
    const first = await postLead(body);
    const second = await postLead(body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.json.replayed, true);
    assert.equal(second.json.leadNumber, first.json.leadNumber);
    assert.equal((await db.query('SELECT count(*)::int n FROM leads WHERE idempotency_key = $1', [body.idempotencyKey])).rows[0].n, 1);
  });

  it('returns 409 when a key is reused for a different phone or cart', async () => {
    const body = validLead();
    assert.equal((await postLead(body)).status, 201);
    const otherPhone = await postLead({ ...body, phone: uniquePhone() });
    assert.equal(otherPhone.status, 409);
    assert.equal(otherPhone.json.code, 'idempotency_conflict');
    const otherCart = await postLead({ ...body, items: [{ productId: 'p-b', quantity: 1 }] });
    assert.equal(otherCart.status, 409);
    assert.equal(otherCart.json.code, 'idempotency_conflict');
  });

  it('creates exactly one lead when the same request arrives concurrently', async () => {
    const body = validLead();
    const results = await Promise.all(Array.from({ length: 8 }, () => postLead(body)));
    assert.ok(results.every((r) => r.status === 201 || r.status === 200), results.map((r) => r.status).join());
    assert.equal(results.filter((r) => r.status === 201).length, 1, 'exactly one creator');
    assert.equal(new Set(results.map((r) => r.json.leadNumber)).size, 1);
    assert.equal((await db.query('SELECT count(*)::int n FROM leads WHERE idempotency_key = $1', [body.idempotencyKey])).rows[0].n, 1);
  });

  it('treats an identical phone+cart within minutes as a double submit, but not a different cart', async () => {
    const phone = uniquePhone();
    const a = await postLead(validLead({ phone }));
    const b = await postLead(validLead({ phone })); // new idempotency key, same phone and cart
    assert.equal(b.status, 200);
    assert.equal(b.json.leadNumber, a.json.leadNumber);
    const c = await postLead(validLead({ phone, items: [{ productId: 'p-b', quantity: 1 }] }));
    assert.equal(c.status, 201);
    assert.notEqual(c.json.leadNumber, a.json.leadNumber);
  });

  it('honeypot: a filled hidden field looks like success but stores nothing', async () => {
    const before = await leadCount();
    const res = await postLead(validLead({ website: 'http://spam.example' }));
    assert.equal(res.status, 201);
    assert.match(res.json.leadNumber, /^FL-/);
    assert.equal(await leadCount(), before);
  });

  it('trusts Telegram identity only from validly signed initData', async () => {
    const now = Math.floor(Date.now() / 1000);
    const good = await postLead(validLead({ initData: signedInitData({ id: 424242, username: 'qa_user' }, now), telegramId: 1, source: 'web' }));
    assert.equal(good.status, 201);
    let row = (await db.query('SELECT source, telegram_id, telegram_username FROM leads WHERE lead_number = $1', [good.json.leadNumber])).rows[0];
    assert.deepEqual([row.source, String(row.telegram_id), row.telegram_username], ['telegram', '424242', 'qa_user']);

    for (const [label, initData] of [
      ['tampered hash', signedInitData({ id: 999 }, now, BOT_TOKEN, true)],
      ['wrong bot token', signedInitData({ id: 999 }, now, 'x:y')],
      ['expired', signedInitData({ id: 999 }, now - 3 * 24 * 3600)],
      ['garbage', 'user=%7B%22id%22%3A999%7D']
    ] as const) {
      const res = await postLead(validLead({ initData, telegramId: 999, telegramUsername: 'spoof' }));
      assert.equal(res.status, 201, label);
      row = (await db.query('SELECT source, telegram_id, telegram_username FROM leads WHERE lead_number = $1', [res.json.leadNumber])).rows[0];
      assert.deepEqual([row.source, row.telegram_id, row.telegram_username], ['web', null, null], label);
    }
  });

  it('stores hostile text verbatim and never as markup (escaping happens on output)', async () => {
    const res = await postLead(validLead({ firstName: "Robert'); DROP TABLE leads;--", comment: '<script>alert(1)</script>' }));
    assert.equal(res.status, 201);
    assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_name = 'leads'")).rows[0].n, 1);
  });

  it('does not touch the legacy orders flow (POST /api/orders still works and still moves stock)', async () => {
    await db.query("INSERT INTO products (id,name,brand,category,price,volume,in_stock,stock_count) VALUES ('p-legacy','Legacy','B','makeup',50000,'1',true,3)");
    const res = await call('POST', '/api/orders', {
      customer: { fullName: 'Legacy Buyer', phone: '+998901112233', deliveryType: 'pickup' },
      items: [{ productId: 'p-legacy', quantity: 2 }], paymentMethod: 'cash_on_delivery'
    });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.total, 100000);
    assert.equal((await db.query("SELECT stock_count FROM products WHERE id = 'p-legacy'")).rows[0].stock_count, 1);
    assert.equal((await call('GET', '/api/products')).status, 200);
  });
});

// ---------------------------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------------------------
describe('admin: authentication', () => {
  it('protects every admin lead endpoint (401 without a session)', async () => {
    const lead = (await postLead(validLead())).json.leadNumber;
    const id = (await db.query('SELECT id FROM leads WHERE lead_number = $1', [lead])).rows[0].id;
    for (const [method, url, body] of [['GET', '/api/admin/leads'], ['GET', `/api/admin/leads/${id}`], ['PATCH', `/api/admin/leads/${id}`, { status: 'contacted' }]] as const) {
      const res = await call(method, url, body);
      assert.equal(res.status, 401, `${method} ${url}`);
    }
    assert.equal((await call('GET', '/api/admin/leads', undefined, { Cookie: 'flaner_admin_session=forged.value' })).status, 401);
    const tampered = cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    assert.equal((await call('GET', '/api/admin/leads', undefined, { Cookie: tampered })).status, 401, 'tampered signature');
    assert.equal((await db.query('SELECT status FROM leads WHERE id = $1', [id])).rows[0].status, 'new', 'unauthenticated PATCH must not change anything');
  });

  it('a wrong access code does not give a session', async () => {
    const res = await call('POST', '/api/admin/login', { email: ADMIN_EMAIL, code: 'wrong' });
    assert.equal(res.status, 401);
    assert.equal(res.headers.getSetCookie().length, 0);
  });
});

describe('admin: list and detail', () => {
  it('lists newest first with pagination, total, items and status filter', async () => {
    const res = await admin('GET', '/api/admin/leads?pageSize=5');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.pageSize, 5);
    assert.equal(res.json.page, 1);
    assert.ok(res.json.total >= 5);
    assert.equal(res.json.items.length, 5);
    const dates = res.json.items.map((l: LeadView) => l.createdAt);
    assert.deepEqual([...dates].sort().reverse(), dates, 'newest first');
    assert.ok(res.json.items.every((l: LeadView) => Array.isArray(l.items) && l.items.length > 0));
    const page2 = await admin('GET', '/api/admin/leads?pageSize=5&page=2');
    assert.equal(page2.status, 200);
    assert.ok(!page2.json.items.some((l: LeadView) => res.json.items.some((x: LeadView) => x.id === l.id)), 'pages must not overlap');
    const filtered = await admin('GET', '/api/admin/leads?status=cancelled&pageSize=100');
    assert.ok(filtered.json.items.every((l: LeadView) => l.status === 'cancelled'));
  });

  it('searches by phone, name and lead number; treats % and _ literally', async () => {
    const phone = uniquePhone();
    const created = (await postLead(validLead({ phone, firstName: 'Zulfiya', lastName: 'Qodirova' }))).json.leadNumber;
    for (const q of [phone.slice(-7), 'zulfiy', 'QODIR', created]) {
      const res = await admin('GET', `/api/admin/leads?q=${encodeURIComponent(q)}`);
      assert.ok(res.json.items.some((l: LeadView) => l.leadNumber === created), `q=${q}`);
    }
    assert.equal((await admin('GET', `/api/admin/leads?q=${encodeURIComponent('%')}`)).json.total, 0, '% is not a wildcard');
    assert.equal((await admin('GET', `/api/admin/leads?q=${encodeURIComponent("' OR 1=1 --")}`)).json.total, 0);
  });

  it('validates query parameters', async () => {
    for (const q of ['status=paid', 'page=0', 'page=abc', 'pageSize=0', 'pageSize=101']) {
      const res = await admin('GET', `/api/admin/leads?${q}`);
      assert.equal(res.status, 400, q);
      assert.equal(res.json.code, 'validation_error');
    }
  });

  it('returns detail with history, and 404 for an unknown id', async () => {
    const created = await postLead(validLead());
    const id = (await db.query('SELECT id FROM leads WHERE lead_number = $1', [created.json.leadNumber])).rows[0].id;
    const res = await admin('GET', `/api/admin/leads/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.json.leadNumber, created.json.leadNumber);
    assert.equal(res.json.history.length, 1);
    assert.equal(res.json.history[0].toStatus, 'new');
    const missing = await admin('GET', '/api/admin/leads/lead-does-not-exist');
    assert.equal(missing.status, 404);
    assert.equal(missing.json.code, 'lead_not_found');
  });
});

describe('admin: PATCH status flow', () => {
  const newLead = async () => {
    const created = await postLead(validLead());
    return (await db.query('SELECT id FROM leads WHERE lead_number = $1', [created.json.leadNumber])).rows[0].id as string;
  };
  const patch = (id: string, body: unknown) => admin('PATCH', `/api/admin/leads/${id}`, body);

  it('walks new → contacted → confirmed → completed, recording actor and contacted_at', async () => {
    const id = await newLead();
    const a = await patch(id, { status: 'contacted' });
    assert.equal(a.status, 200, a.text);
    assert.equal(a.json.status, 'contacted');
    assert.ok(a.json.contactedAt);
    assert.equal((await patch(id, { status: 'confirmed' })).json.status, 'confirmed');
    const done = await patch(id, { status: 'completed' });
    assert.equal(done.json.status, 'completed');
    assert.deepEqual(done.json.history.map((h: any) => [h.fromStatus, h.toStatus, h.actor]), [
      [null, 'new', 'system'], ['new', 'contacted', ADMIN_EMAIL], ['contacted', 'confirmed', ADMIN_EMAIL], ['confirmed', 'completed', ADMIN_EMAIL]
    ]);
  });

  it('cannot skip steps or go backwards', async () => {
    const id = await newLead();
    for (const status of ['confirmed', 'completed']) {
      const res = await patch(id, { status });
      assert.equal(res.status, 409, status);
      assert.equal(res.json.code, 'invalid_transition');
      assert.deepEqual(res.json.details.allowed, ['contacted', 'cancelled']);
    }
    await patch(id, { status: 'contacted' });
    const back = await patch(id, { status: 'new' });
    assert.equal(back.status, 409);
    assert.equal((await db.query('SELECT status FROM leads WHERE id = $1', [id])).rows[0].status, 'contacted');
  });

  it('a completed lead can never be resurrected', async () => {
    const id = await newLead();
    for (const status of ['contacted', 'confirmed', 'completed']) await patch(id, { status });
    for (const status of ['new', 'contacted', 'confirmed', 'cancelled']) {
      const res = await patch(id, { status });
      assert.equal(res.status, 409, status);
      assert.equal(res.json.code, 'invalid_transition');
    }
    assert.equal((await db.query('SELECT status FROM leads WHERE id = $1', [id])).rows[0].status, 'completed');
  });

  it('a cancelled lead can never be resurrected; cancellation works from every open status', async () => {
    for (const path of [[], ['contacted'], ['contacted', 'confirmed']]) {
      const id = await newLead();
      for (const status of path) await patch(id, { status });
      assert.equal((await patch(id, { status: 'cancelled' })).json.status, 'cancelled', `from ${path.at(-1) ?? 'new'}`);
      for (const status of ['new', 'contacted', 'confirmed', 'completed']) assert.equal((await patch(id, { status })).status, 409, status);
    }
  });

  it('same-status request is a harmless no-op without a history row', async () => {
    const id = await newLead();
    const res = await patch(id, { status: 'new' });
    assert.equal(res.status, 200);
    assert.equal(res.json.history.length, 1);
  });

  it('manages the staff note, including on a closed lead, without reopening it', async () => {
    const id = await newLead();
    assert.equal((await patch(id, { staffNote: '  Не берёт трубку  ' })).json.staffNote, 'Не берёт трубку');
    assert.equal((await patch(id, { staffNote: '' })).json.staffNote, null);
    await patch(id, { staffNote: 'x' });
    assert.equal((await patch(id, { staffNote: null })).json.staffNote, null);
    await patch(id, { status: 'cancelled' });
    const note = await patch(id, { staffNote: 'Клиент передумал' });
    assert.equal(note.status, 200);
    assert.equal(note.json.status, 'cancelled');
    assert.equal(note.json.staffNote, 'Клиент передумал');
  });

  it('a status change and a note in one request apply together', async () => {
    const id = await newLead();
    const res = await patch(id, { status: 'contacted', staffNote: 'Перезвонить в 18:00' });
    assert.equal(res.json.status, 'contacted');
    assert.equal(res.json.staffNote, 'Перезвонить в 18:00');
  });

  it('validates the PATCH body', async () => {
    const id = await newLead();
    for (const body of [{}, { status: 'paid' }, { status: 5 }, { staffNote: 'x'.repeat(2001) }, { staffNote: 5 }]) {
      const res = await patch(id, body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
      assert.equal(res.json.code, 'validation_error');
    }
    assert.equal((await patch('lead-does-not-exist', { status: 'contacted' })).status, 404);
  });

  it('cannot change protected fields through PATCH', async () => {
    const id = await newLead();
    const before = (await db.query('SELECT phone, items_total, telegram_id, lead_number FROM leads WHERE id = $1', [id])).rows[0];
    await patch(id, { staffNote: 'ok', phone: '+998900000000', itemsTotal: 1, telegramId: 5, leadNumber: 'FL-HACKED1', id: 'other' });
    assert.deepEqual((await db.query('SELECT phone, items_total, telegram_id, lead_number FROM leads WHERE id = $1', [id])).rows[0], before);
  });

  it('serialises concurrent identical transitions: one history row, no errors', async () => {
    const id = await newLead();
    const results = await Promise.all(Array.from({ length: 6 }, () => patch(id, { status: 'contacted' })));
    assert.ok(results.every((r) => r.status === 200), results.map((r) => r.status).join());
    assert.equal((await db.query("SELECT count(*)::int n FROM lead_status_history WHERE lead_id = $1 AND to_status = 'contacted'", [id])).rows[0].n, 1);
  });

  it('concurrent conflicting transitions: the loser gets a clean 409, never a broken state', async () => {
    const id = await newLead();
    await patch(id, { status: 'contacted' });
    await patch(id, { status: 'confirmed' });
    const [a, b] = await Promise.all([patch(id, { status: 'completed' }), patch(id, { status: 'cancelled' })]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const final = (await db.query('SELECT status FROM leads WHERE id = $1', [id])).rows[0].status;
    assert.ok(['completed', 'cancelled'].includes(final));
    assert.equal((await db.query("SELECT count(*)::int n FROM lead_status_history WHERE lead_id = $1 AND to_status IN ('completed','cancelled')", [id])).rows[0].n, 1);
  });

  it('survives deletion of a product: the lead stays readable through the snapshot', async () => {
    await db.query("INSERT INTO products (id,name,brand,category,price,volume,in_stock,stock_count) VALUES ('p-temp','Temp','B','makeup',70000,'1',true,1)");
    const created = await postLead(validLead({ items: [{ productId: 'p-temp', quantity: 1 }] }));
    const id = (await db.query('SELECT id FROM leads WHERE lead_number = $1', [created.json.leadNumber])).rows[0].id;
    assert.equal((await admin('DELETE', '/api/products/p-temp')).status, 204);
    const detail = await admin('GET', `/api/admin/leads/${id}`);
    assert.equal(detail.status, 200);
    assert.deepEqual([detail.json.items[0].productId, detail.json.items[0].productName, detail.json.items[0].unitPrice], [null, 'Temp', 70000]);
  });
});

// ---------------------------------------------------------------------------------------------
// Rate limiting (separate server with a tiny limit)
// ---------------------------------------------------------------------------------------------
describe('rate limiting', () => {
  it('limits POST /api/leads per client, returns 429 JSON with headers, and leaves admin routes alone', async () => {
    const base = await startServer(await freePort(), { LEADS_RATE_LIMIT_MAX: '3', LEADS_RATE_LIMIT_WINDOW_MINUTES: '15' });
    const statuses: number[] = [];
    let last;
    for (let i = 0; i < 5; i++) {
      last = await call('POST', '/api/leads', validLead(), {}, base);
      statuses.push(last.status);
    }
    assert.deepEqual(statuses, [201, 201, 201, 429, 429]);
    assert.equal(last!.json.code, 'rate_limited');
    assert.ok(last!.headers.get('ratelimit') || last!.headers.get('ratelimit-policy'), 'standard rate limit headers');
    // invalid requests count too (they cost CPU), and the limit does not affect the admin API
    const adminCookie = await adminLogin(base);
    assert.equal((await call('GET', '/api/admin/leads', undefined, { Cookie: adminCookie }, base)).status, 200);
    assert.equal((await call('GET', '/api/products', undefined, {}, base)).status, 200);
  });
});
