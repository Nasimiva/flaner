// Unit tests for the admin leads API client and its presentation helpers.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AdminApiError,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_ACTION_LABELS,
  LEAD_TRANSITIONS,
  formatPhone,
  getLead,
  listLeads,
  normalizeLeadSearch,
  telHref,
  telegramHref,
  updateLead
} from '../src/utils/adminLeadsApi.ts';

const json = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const lead = { id: 'l1', leadNumber: 'FL-ABCD1234', status: 'new', items: [] };

const failure = async (promise: Promise<unknown>): Promise<AdminApiError> => {
  try { await promise; } catch (error) { assert.ok(error instanceof AdminApiError, String(error)); return error; }
  throw new Error('expected a rejection');
};

describe('listLeads', () => {
  it('builds the query string and sends no body', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const page = await listLeads({ status: 'new', q: '  Анна ', page: 2, pageSize: 20 }, (async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return json(200, { items: [lead], page: 2, pageSize: 20, total: 21 });
    }) as any);
    assert.equal(page.total, 21);
    const url = new URL(seen!.url, 'http://x');
    assert.equal(url.pathname, '/api/admin/leads');
    assert.equal(url.searchParams.get('status'), 'new');
    assert.equal(url.searchParams.get('q'), 'Анна');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('pageSize'), '20');
    assert.equal(seen!.init, undefined);
  });

  it('omits empty filters', async () => {
    let url = '';
    await listLeads({ q: '   ', page: 1, pageSize: 10 }, (async (u: string) => { url = u; return json(200, { items: [], page: 1, pageSize: 10, total: 0 }); }) as any);
    assert.equal(new URL(url, 'http://x').searchParams.has('status'), false);
    assert.equal(new URL(url, 'http://x').searchParams.has('q'), false);
  });

  it('401 becomes "unauthorized" with a re-login message', async () => {
    const error = await failure(listLeads({ page: 1, pageSize: 10 }, (async () => json(401, { error: 'Нужна авторизация', code: 'unauthorized' })) as any));
    assert.equal(error.code, 'unauthorized');
    assert.equal(error.status, 401);
    assert.match(error.message, /Войдите заново/);
  });

  it('network failure → code "network"', async () => {
    const error = await failure(listLeads({ page: 1, pageSize: 10 }, (async () => { throw new TypeError('fetch failed'); }) as any));
    assert.equal(error.code, 'network');
  });

  it('server error keeps the server text and code; HTML body falls back to a generic message', async () => {
    const withJson = await failure(listLeads({ page: 1, pageSize: 10 }, (async () => json(400, { error: 'Некорректные данные запроса', code: 'validation_error' })) as any));
    assert.equal(withJson.code, 'validation_error');
    assert.equal(withJson.message, 'Некорректные данные запроса');
    const withHtml = await failure(listLeads({ page: 1, pageSize: 10 }, (async () => new Response('<html>Bad gateway</html>', { status: 502 })) as any));
    assert.equal(withHtml.status, 502);
    assert.match(withHtml.message, /502/);
  });

  it('a 200 with the wrong shape is a bad_response, not an empty list', async () => {
    for (const body of [{}, { items: 'x', total: 1 }, { items: [] }, 'oops', null]) {
      const error = await failure(listLeads({ page: 1, pageSize: 10 }, (async () => json(200, body as any)) as any));
      assert.equal(error.code, 'bad_response', JSON.stringify(body));
    }
  });
});

describe('getLead / updateLead', () => {
  it('getLead encodes the id', async () => {
    let url = '';
    await getLead('a/b c', (async (u: string) => { url = u; return json(200, lead); }) as any);
    assert.equal(url, '/api/admin/leads/a%2Fb%20c');
  });

  it('getLead rejects a body that is not a lead', async () => {
    const error = await failure(getLead('l1', (async () => json(200, { ok: true })) as any));
    assert.equal(error.code, 'bad_response');
  });

  it('updateLead sends only the provided fields as PATCH JSON', async () => {
    const sent: any[] = [];
    const fake = (async (url: string, init: RequestInit) => { sent.push({ url, init }); return json(200, lead); }) as any;
    await updateLead('l1', { status: 'contacted' }, fake);
    await updateLead('l1', { staffNote: 'позвонить после 18:00' }, fake);
    await updateLead('l1', { staffNote: null }, fake);
    assert.equal(sent[0].init.method, 'PATCH');
    assert.equal(sent[0].init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(sent[0].init.body), { status: 'contacted' });
    assert.deepEqual(JSON.parse(sent[1].init.body), { staffNote: 'позвонить после 18:00' });
    assert.deepEqual(JSON.parse(sent[2].init.body), { staffNote: null });
  });

  it('updateLead surfaces a 409 conflict with its message', async () => {
    const error = await failure(updateLead('l1', { status: 'completed' }, (async () => json(409, { error: 'Нельзя перевести заявку из «Новая» в «Выполнена»', code: 'invalid_transition' })) as any));
    assert.equal(error.status, 409);
    assert.equal(error.code, 'invalid_transition');
    assert.match(error.message, /Нельзя перевести/);
  });
});

describe('status model', () => {
  it('every status has labels and a transition entry; final statuses have no way out', () => {
    for (const status of LEAD_STATUSES) {
      assert.ok(LEAD_STATUS_LABELS[status], status);
      assert.ok(LEAD_ACTION_LABELS[status], status);
      assert.ok(Array.isArray(LEAD_TRANSITIONS[status]), status);
    }
    assert.deepEqual(LEAD_TRANSITIONS.completed, []);
    assert.deepEqual(LEAD_TRANSITIONS.cancelled, []);
  });

  it('every open status can be cancelled and nothing goes back to "new"', () => {
    for (const status of ['new', 'contacted', 'confirmed'] as const) assert.ok(LEAD_TRANSITIONS[status].includes('cancelled'), status);
    for (const status of LEAD_STATUSES) assert.ok(!LEAD_TRANSITIONS[status].includes('new'), status);
  });
});

describe('helpers', () => {
  it('formatPhone groups a valid number and leaves anything else alone', () => {
    assert.equal(formatPhone('+998901234567'), '+998 90 123 45 67');
    assert.equal(formatPhone('12345'), '12345');
  });

  it('telHref only for a well-formed Uzbek number', () => {
    assert.equal(telHref('+998901234567'), 'tel:+998901234567');
    for (const bad of ['', '901234567', '+9989012345', 'javascript:alert(1)', '+998901234567;rm', 'tel:+998901234567']) assert.equal(telHref(bad), null, bad);
  });

  it('telegramHref only for a valid username', () => {
    assert.equal(telegramHref('anna_k'), 'https://t.me/anna_k');
    for (const bad of [null, '', 'ab', 'a b c', 'x/../y', 'a'.repeat(33), '<script>']) assert.equal(telegramHref(bad as any), null, String(bad));
  });

  it('normalizeLeadSearch reduces phone-like input to digits and keeps text as is', () => {
    assert.equal(normalizeLeadSearch(' +998 (90) 123-45 '), '9989012345');
    assert.equal(normalizeLeadSearch('FL-ABCD1234'), 'FL-ABCD1234');
    assert.equal(normalizeLeadSearch(' Анна '), 'Анна');
    assert.equal(normalizeLeadSearch('+ - '), '+ -');
  });
});
