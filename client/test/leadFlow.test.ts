// Unit tests for the pure frontend logic behind the cart, favorites and lead submission.
// Run with: npm test   (Node runs the TypeScript files directly, no build step)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeUzPhone } from '../src/utils/phone.ts';
import {
  MAX_ITEMS_PER_LEAD,
  MAX_QUANTITY_PER_ITEM,
  cartSignature,
  parseStoredCart,
  parseStoredFavorites,
  upsertLine
} from '../src/utils/cartStorage.ts';
import { LeadSubmitError, createIdempotencyKey, postLead, type LeadRequest } from '../src/utils/leadApi.ts';

const request: LeadRequest = {
  firstName: 'Анна', lastName: 'Иванова', phone: '+998 90 123 45 67', comment: '',
  items: [{ productId: 'p-a', quantity: 2 }], idempotencyKey: 'lead-key-12345678'
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('phone', () => {
  it('normalizes Uzbek numbers like the server does', () => {
    assert.equal(normalizeUzPhone('+998 90 123-45-67'), '+998901234567');
    assert.equal(normalizeUzPhone('998901234567'), '+998901234567');
    assert.equal(normalizeUzPhone('90 123 45 67'), '+998901234567');
    for (const bad of ['', '+998 ', '12345', '+7 900 123 45 67', '+998 90 123 45 678']) assert.equal(normalizeUzPhone(bad), null, bad);
  });
});

describe('cart storage', () => {
  it('reads the new { productId, quantity } format', () => {
    assert.deepEqual(parseStoredCart('[{"productId":"p-a","quantity":3}]'), [{ productId: 'p-a', quantity: 3 }]);
  });

  it('migrates the legacy format that stored whole products', () => {
    const legacy = JSON.stringify([{ product: { id: 'p-a', name: 'Old', price: 1 }, quantity: 2 }]);
    assert.deepEqual(parseStoredCart(legacy), [{ productId: 'p-a', quantity: 2 }]);
  });

  it('stores only productId and quantity (no product snapshot survives)', () => {
    const lines = parseStoredCart(JSON.stringify([{ productId: 'p-a', quantity: 1, price: 5, product: { id: 'x', price: 1 } }]));
    assert.deepEqual(Object.keys(lines[0]).sort(), ['productId', 'quantity']);
  });

  it('survives garbage without throwing', () => {
    for (const raw of [null, '', 'not json', '{}', '123', 'null', '[1,"a",null,{}]', '[{"productId":42,"quantity":1}]']) {
      assert.deepEqual(parseStoredCart(raw), [], String(raw));
    }
  });

  it('clamps quantities, merges duplicates and caps the number of lines', () => {
    assert.deepEqual(parseStoredCart('[{"productId":"a","quantity":0},{"productId":"b","quantity":999},{"productId":"c","quantity":"x"},{"productId":"d","quantity":2.9}]'), [
      { productId: 'a', quantity: 1 }, { productId: 'b', quantity: MAX_QUANTITY_PER_ITEM }, { productId: 'c', quantity: 1 }, { productId: 'd', quantity: 2 }
    ]);
    assert.deepEqual(parseStoredCart('[{"productId":"a","quantity":15},{"productId":"a","quantity":15}]'), [{ productId: 'a', quantity: MAX_QUANTITY_PER_ITEM }]);
    const many = JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ productId: `p-${i}`, quantity: 1 })));
    assert.equal(parseStoredCart(many).length, MAX_ITEMS_PER_LEAD);
  });

  it('upsertLine adds, updates and respects the limits', () => {
    let lines = upsertLine([], 'a', 2);
    assert.deepEqual(lines, [{ productId: 'a', quantity: 2 }]);
    lines = upsertLine(lines, 'a', 5);
    assert.deepEqual(lines, [{ productId: 'a', quantity: 5 }]);
    assert.equal(upsertLine(lines, 'a', 500)[0].quantity, MAX_QUANTITY_PER_ITEM);
    const full = Array.from({ length: MAX_ITEMS_PER_LEAD }, (_, i) => ({ productId: `p-${i}`, quantity: 1 }));
    assert.equal(upsertLine(full, 'new', 1).length, MAX_ITEMS_PER_LEAD);
  });

  it('cartSignature ignores order but notices changes', () => {
    const a = [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 2 }];
    assert.equal(cartSignature(a), cartSignature([...a].reverse()));
    assert.notEqual(cartSignature(a), cartSignature([{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 2 }]));
  });
});

describe('favorites storage', () => {
  it('reads a list of ids, drops junk and duplicates', () => {
    assert.deepEqual(parseStoredFavorites('["a","b","a",3,null,""]'), ['a', 'b']);
    for (const raw of [null, '', 'oops', '{}', '"a"']) assert.deepEqual(parseStoredFavorites(raw), [], String(raw));
  });
});

describe('postLead', () => {
  it('201 = created: returns the receipt with the lead number', async () => {
    let sent: any;
    const receipt = await postLead(request, (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return jsonResponse(201, { leadNumber: 'FL-ABCD1234', status: 'new', createdAt: '2026-01-01T00:00:00Z', itemsTotal: 200000, items: [{ productName: 'A', brand: 'B', volume: '1', unitPrice: 100000, quantity: 2 }], replayed: false });
    }) as any);
    assert.equal(receipt.leadNumber, 'FL-ABCD1234');
    assert.equal(receipt.replayed, false);
    assert.equal(receipt.itemsTotal, 200000);
    assert.equal(sent.url, '/api/leads');
    assert.equal(sent.init.method, 'POST');
    const body = JSON.parse(sent.init.body);
    assert.deepEqual(body.items, [{ productId: 'p-a', quantity: 2 }]);
    assert.equal(body.idempotencyKey, 'lead-key-12345678');
    for (const forbidden of ['price', 'total', 'paymentMethod', 'promoCode', 'favorites']) assert.ok(!(forbidden in body), `${forbidden} must not be sent`);
  });

  it('200 = identical earlier submission: also a success, flagged as replayed', async () => {
    const receipt = await postLead(request, (async () => jsonResponse(200, { leadNumber: 'FL-ABCD1234', status: 'new', createdAt: 'x', itemsTotal: 1, items: [], replayed: true })) as any);
    assert.equal(receipt.leadNumber, 'FL-ABCD1234');
    assert.equal(receipt.replayed, true);
  });

  const failure = async (fetchImpl: any): Promise<LeadSubmitError> => {
    try { await postLead(request, fetchImpl); } catch (error) { assert.ok(error instanceof LeadSubmitError, String(error)); return error; }
    throw new Error('expected postLead to throw');
  };

  it('400 validation: maps server details to form fields', async () => {
    const error = await failure(async () => jsonResponse(400, {
      error: 'Некорректные данные запроса', code: 'validation_error',
      details: [{ path: 'phone', message: 'Телефон: укажите номер Узбекистана' }, { path: 'items.0.quantity', message: 'Максимум 20 шт.' }, { path: 'unknownField', message: 'ignored' }]
    }));
    assert.equal(error.status, 400);
    assert.equal(error.code, 'validation_error');
    assert.deepEqual(error.fieldErrors, { phone: 'Телефон: укажите номер Узбекистана', items: 'Максимум 20 шт.' });
  });

  it('409 out_of_stock / product_unavailable: keeps the server message and code', async () => {
    const error = await failure(async () => jsonResponse(409, { error: 'Нет в наличии: «Serum»', code: 'out_of_stock', details: { productIds: ['p-a'] } }));
    assert.equal(error.code, 'out_of_stock');
    assert.equal(error.status, 409);
    assert.match(error.message, /Serum/);
  });

  it('429 rate limit: surfaces the server message', async () => {
    const error = await failure(async () => jsonResponse(429, { error: 'Слишком много заявок с этого адреса. Попробуйте позже.', code: 'rate_limited' }));
    assert.equal(error.code, 'rate_limited');
    assert.equal(error.status, 429);
  });

  it('500 with an HTML body: generic message that says the cart is kept', async () => {
    const error = await failure(async () => new Response('<html>Bad gateway</html>', { status: 502 }));
    assert.equal(error.status, 502);
    assert.match(error.message, /Корзина сохранена/);
  });

  it('network failure: code "network", cart-kept message', async () => {
    const error = await failure(async () => { throw new TypeError('fetch failed'); });
    assert.equal(error.code, 'network');
    assert.match(error.message, /Корзина сохранена/);
  });

  it('a 2xx without a lead number is NOT treated as success', async () => {
    for (const body of [{}, { leadNumber: '' }, { leadNumber: 5 }, 'ok']) {
      const error = await failure(async () => jsonResponse(201, body));
      assert.equal(error.code, 'bad_response', JSON.stringify(body));
    }
  });

  it('other 2xx codes (204, 202) are not success either', async () => {
    for (const status of [202, 204]) {
      const error = await failure(async () => new Response(status === 204 ? null : '{"leadNumber":"FL-X"}', { status }));
      assert.ok(error instanceof LeadSubmitError, String(status));
    }
  });
});

describe('idempotency key', () => {
  it('is long enough for the server (8..100) and unique per call', () => {
    const keys = new Set(Array.from({ length: 50 }, () => createIdempotencyKey()));
    assert.equal(keys.size, 50);
    for (const key of keys) assert.ok(key.length >= 8 && key.length <= 100, key);
  });
});
