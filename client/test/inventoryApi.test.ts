import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  addReceipt, cancelSale, currentMonth, getReport, listMovements, listStock, parseAmount, reportCsvUrl, sellProduct, stockLevel, stockTotals, type StockItem
} from '../src/utils/inventoryApi.ts';

const reply = (status: number, body: unknown): typeof fetch => (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
const item = (over: Partial<StockItem> = {}): StockItem => ({ id: 'p', name: 'N', brand: 'B', category: 'c', volume: '', price: 100, costPrice: 60, stockCount: 3, inStock: true, ...over });

describe('inventory helpers', () => {
  it('classifies stock: 0 is zero, 1-2 is low, more is ok', () => {
    assert.deepEqual([0, 1, 2, 3].map(stockLevel), ['zero', 'low', 'low', 'ok']);
  });

  it('sums the warehouse value at cost and at retail', () => {
    const totals = stockTotals([item({ stockCount: 3 }), item({ id: 'q', stockCount: 0 }), item({ id: 'r', stockCount: 2, price: 50, costPrice: 10 })]);
    assert.deepEqual(totals, { products: 3, units: 5, costValue: 3 * 60 + 2 * 10, retailValue: 3 * 100 + 2 * 50 });
  });

  it('parses typed amounts: empty -> undefined, junk -> NaN, comma and spaces tolerated', () => {
    assert.equal(parseAmount(''), undefined);
    assert.equal(parseAmount(' 1 250 000 '), 1250000);
    assert.equal(parseAmount('12,5'), 12.5);
    assert.ok(Number.isNaN(parseAmount('abc')));
  });

  it('counts the month in Tashkent time (UTC+5)', () => {
    assert.equal(currentMonth(new Date('2026-03-31T19:30:00Z')), '2026-04');
    assert.equal(currentMonth(new Date('2026-03-31T18:30:00Z')), '2026-03');
    assert.equal(reportCsvUrl('2026-03'), '/api/admin/inventory/report.csv?month=2026-03');
  });
});

describe('inventory API client', () => {
  it('sends the sale with quantity and price to the admin endpoint', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init?: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ product: item() }), { status: 201 }); }) as unknown as typeof fetch;
    await sellProduct('p 1', { quantity: 2, unitPrice: 80 }, fetchImpl);
    assert.equal(seen!.url, '/api/admin/inventory/products/p%201/sale');
    assert.equal(seen!.init!.method, 'POST');
    assert.deepEqual(JSON.parse(String(seen!.init!.body)), { quantity: 2, unitPrice: 80 });
  });

  it('surfaces the server message for an out-of-stock sale', async () => {
    await assert.rejects(sellProduct('p', { quantity: 9 }, reply(409, { error: 'Недостаточно товара на складе: осталось 3 шт.', code: 'insufficient_stock' })),
      (error: any) => error.code === 'insufficient_stock' && /осталось 3/.test(error.message));
  });

  it('reports an expired session and unexpected bodies', async () => {
    await assert.rejects(listStock({}, reply(401, { error: 'x' })), (error: any) => error.code === 'unauthorized');
    await assert.rejects(getReport('2026-03', reply(200, { nope: true })), (error: any) => error.code === 'bad_response');
    await assert.rejects(addReceipt('p', { quantity: 1 }, reply(200, {})), (error: any) => error.code === 'bad_response');
  });

  it('builds the journal and stock queries from the filters', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => { urls.push(url); return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 30, brands: [], totals: {} }), { status: 200 }); }) as unknown as typeof fetch;
    await listMovements({ productId: 'p', kind: 'sale', from: '2026-03-01', to: '2026-03-31', page: 2, pageSize: 30 }, fetchImpl);
    await listStock({ q: ' крем ', stock: 'low', brand: 'X' }, fetchImpl);
    await listStock({ stock: 'all' }, fetchImpl);
    assert.equal(urls[0], '/api/admin/inventory/movements?page=2&pageSize=30&productId=p&kind=sale&from=2026-03-01&to=2026-03-31');
    assert.equal(decodeURIComponent(urls[1]), '/api/admin/inventory/products?q=крем&brand=X&stock=low');
    assert.equal(urls[2], '/api/admin/inventory/products?');
    await assert.rejects(cancelSale('1', reply(409, { error: 'Эта продажа уже отменена', code: 'already_cancelled' })), (error: any) => error.code === 'already_cancelled');
  });
});

describe('the storefront never carries stock or cost', () => {
  const srcDir = path.resolve(import.meta.dirname, '../src');
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  const storefrontFiles = walk(srcDir).filter((file) => /\.(ts|tsx)$/.test(file) && !/Admin|inventoryApi|adminLeadsApi/.test(path.basename(file)));

  it('uses no stockCount / costPrice in any non-admin source file', () => {
    for (const file of storefrontFiles) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /stockCount|costPrice/, path.relative(srcDir, file));
    }
  });

  it('never requests the admin inventory API outside admin modules', () => {
    for (const file of storefrontFiles) {
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /admin\/inventory/, path.relative(srcDir, file));
    }
  });
});
