// Unit tests for the storefront content helpers (hero banners and brand strip).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fetchSiteContent,
  normalizeBanners,
  normalizeBrands,
  resetSiteContent,
  saveSiteContent
} from '../src/utils/siteContentApi.ts';

const banner = (over: Record<string, unknown> = {}) => ({
  id: 'b1', title: 'Уход', text: 'Текст', ctaLabel: 'Смотреть', ctaCategory: 'face-care', ctaLink: '',
  imageUrl: 'https://images.example.com/a.jpg', active: true, ...over
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('normalizeBanners', () => {
  it('returns null when nothing usable came back, so the shop falls back to defaults', () => {
    assert.equal(normalizeBanners(null), null);
    assert.equal(normalizeBanners('x'), null);
    assert.equal(normalizeBanners([]), null);
    assert.equal(normalizeBanners([{ title: '', imageUrl: 'https://a.b/c.jpg' }]), null);
  });

  it('drops banners without a title or a safe image URL and keeps the rest in order', () => {
    const result = normalizeBanners([
      banner({ id: 'ok-1' }),
      banner({ id: 'no-title', title: '  ' }),
      banner({ id: 'js-image', imageUrl: 'javascript:alert(1)' }),
      banner({ id: 'ok-2', imageUrl: '/images/hero.jpg' })
    ]);
    assert.deepEqual(result?.map((b) => b.id), ['ok-1', 'ok-2']);
  });

  it('never lets an unsafe link or unknown category through', () => {
    const [result] = normalizeBanners([banner({ ctaLink: 'javascript:alert(1)', ctaCategory: 'nope' })])!;
    assert.equal(result.ctaLink, '');
    assert.equal(result.ctaCategory, 'all');
  });

  it('treats a missing active flag as shown and only an explicit false as hidden', () => {
    const [shown, hidden] = normalizeBanners([{ ...banner(), active: undefined }, banner({ id: 'h', active: false })])!;
    assert.equal(shown.active, true);
    assert.equal(hidden.active, false);
  });
});

describe('stored ids', () => {
  it('are made unique so React keys never collide', () => {
    const banners = normalizeBanners([banner({ id: 'same' }), banner({ id: 'same' }), banner({ id: '' })])!;
    assert.equal(new Set(banners.map((b) => b.id)).size, 3);
    const brands = normalizeBrands([{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }])!;
    assert.equal(new Set(brands.map((b) => b.id)).size, 2);
  });
});

describe('normalizeBrands', () => {
  it('keeps named brands, trims names and ignores unsafe logos', () => {
    const result = normalizeBrands([
      { id: 'a', name: '  Dior ', logoUrl: '' },
      { id: 'b', name: '' },
      { id: 'c', name: 'Chanel', logoUrl: 'javascript:alert(1)' },
      { name: 'Tom Ford', logoUrl: 'https://images.example.com/tf.svg' }
    ]);
    assert.deepEqual(result?.map((b) => [b.name, b.logoUrl]), [['Dior', ''], ['Chanel', ''], ['Tom Ford', 'https://images.example.com/tf.svg']]);
    assert.equal(normalizeBrands([]), null);
  });
});

describe('API client', () => {
  it('fetchSiteContent normalises the response and throws on a failed request', async () => {
    const ok = await fetchSiteContent((async () => jsonResponse({ banners: [banner()], brands: null })) as typeof fetch);
    assert.equal(ok.banners?.length, 1);
    assert.equal(ok.brands, null);
    await assert.rejects(fetchSiteContent((async () => jsonResponse({}, 500)) as typeof fetch));
  });

  it('saveSiteContent sends the items as JSON with PUT and surfaces the server message', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    await saveSiteContent('brands', [{ id: 'a', name: 'Dior', logoUrl: '' }], (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return jsonResponse({});
    }) as typeof fetch);
    assert.equal(seen?.url, '/api/admin/site-content/brands');
    assert.equal(seen?.init.method, 'PUT');
    assert.deepEqual(JSON.parse(String(seen?.init.body)), { items: [{ id: 'a', name: 'Dior', logoUrl: '' }] });

    await assert.rejects(
      saveSiteContent('banners', [], (async () => jsonResponse({ error: 'x', details: [{ path: 'items.0.title', message: 'Укажите заголовок' }] }, 400)) as typeof fetch),
      /items\.0\.title: Укажите заголовок/
    );
    await assert.rejects(saveSiteContent('banners', [], (async () => jsonResponse({}, 401)) as typeof fetch), /Сессия администратора истекла/);
  });

  it('resetSiteContent issues DELETE', async () => {
    let method = '';
    await resetSiteContent('banners', (async (_url: string, init: RequestInit) => { method = String(init.method); return new Response(null, { status: 204 }); }) as typeof fetch);
    assert.equal(method, 'DELETE');
  });
});
