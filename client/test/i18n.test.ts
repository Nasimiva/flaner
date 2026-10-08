// Tests for the two language versions: dictionaries, SEO metadata, generated HTML and the sitemap.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ru } from '../src/i18n/ru.ts';
import { uz } from '../src/i18n/uz.ts';
import { translate } from '../src/i18n/translate.ts';
import { DEFAULT_LANG, LANGS, SEO, hreflangLinks, langFromPath, langUrl } from '../src/i18n/seo.ts';
import { renderHtmlForLang, outputPathForLang } from '../src/i18n/renderHtml.ts';
import { DEFAULT_BANNER_TEXT_UZ, PRODUCT_TEXT_UZ, localizeBanners, localizeVolume } from '../src/i18n/content.ts';
import { formatPrice } from '../src/utils/formatters.ts';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8');
const indexHtml = read('../index.html');
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('Uzbek has exactly the Russian keys', () => {
    assert.deepEqual(Object.keys(uz).sort(), Object.keys(ru).sort());
  });

  it('keeps the same {placeholders} in every message', () => {
    for (const key of Object.keys(ru) as Array<keyof typeof ru>) {
      assert.deepEqual(placeholders(uz[key]), placeholders(ru[key]), key);
    }
  });

  it('Uzbek messages are written in Latin script and are not empty', () => {
    for (const [key, value] of Object.entries(uz)) {
      assert.ok(value.trim().length > 0, `${key} is empty`);
      assert.doesNotMatch(value, /[Ѐ-ӿ]/, `${key} contains Cyrillic`);
    }
  });

  it('translate fills placeholders and leaves unknown ones alone', () => {
    assert.equal(translate('ru', 'toast.maxQuantity', { n: 20 }), 'Максимум 20 шт. одного товара');
    assert.equal(translate('uz', 'toast.maxQuantity', { n: 20 }), "Bitta mahsulotdan ko'pi bilan 20 dona");
    assert.equal(translate('uz', 'catalog.found'), 'Topildi: {n} ta mahsulot');
  });
});

describe('language URLs', () => {
  it('reads the language from the path', () => {
    assert.equal(langFromPath('/'), 'ru');
    assert.equal(langFromPath('/index.html'), 'ru');
    assert.equal(langFromPath('/uz'), 'uz');
    assert.equal(langFromPath('/uz/'), 'uz');
    assert.equal(langFromPath('/UZ/'), 'uz');
    assert.equal(langFromPath('/uzbek'), 'ru');
  });

  it('gives every language its own absolute URL', () => {
    assert.equal(langUrl('ru'), 'https://flaner.uz/');
    assert.equal(langUrl('uz'), 'https://flaner.uz/uz/');
    assert.equal(outputPathForLang('uz'), 'uz/index.html');
  });

  it('hreflang covers both languages and x-default points at the default language', () => {
    const links = hreflangLinks();
    assert.deepEqual(
      links.map((link) => link.hreflang),
      ['ru', 'uz', 'x-default']
    );
    assert.equal(links.find((link) => link.hreflang === 'x-default')?.href, langUrl(DEFAULT_LANG));
  });
});

describe('SEO texts', () => {
  it('keeps the agreed Russian title and description', () => {
    assert.equal(SEO.ru.title, 'Flaner Cosmetics — люксовая косметика в Ташкенте');
    assert.equal(
      SEO.ru.description,
      'Flaner — магазин люксовой косметики в Ташкенте. Декоративная косметика, подарочные наборы, адвент-календари и уходовая косметика от популярных брендов.'
    );
  });

  it('gives each language a different title and description', () => {
    assert.notEqual(SEO.ru.title, SEO.uz.title);
    assert.notEqual(SEO.ru.description, SEO.uz.description);
    assert.doesNotMatch(SEO.uz.title + SEO.uz.description, /[Ѐ-ӿ]/);
  });
});

describe('static HTML per language', () => {
  const tag = (html: string, pattern: RegExp) => html.match(pattern)?.[1];

  it('the source index.html is the Russian version with the full hreflang set', () => {
    assert.equal(renderHtmlForLang(indexHtml, 'ru'), indexHtml);
    assert.equal(tag(indexHtml, /<html lang="([^"]+)"/), 'ru');
    assert.equal(tag(indexHtml, /<link rel="canonical" href="([^"]+)"/), 'https://flaner.uz/');
    for (const { hreflang, href } of hreflangLinks()) {
      assert.ok(indexHtml.includes(`<link rel="alternate" hreflang="${hreflang}" href="${href}" />`), hreflang);
    }
  });

  it('the Uzbek page has its own title, description, canonical and social tags', () => {
    const html = renderHtmlForLang(indexHtml, 'uz');
    assert.equal(tag(html, /<html lang="([^"]+)"/), 'uz');
    assert.equal(tag(html, /<title>([^<]+)<\/title>/), SEO.uz.title);
    assert.equal(tag(html, /<meta name="description" content="([^"]+)"/), SEO.uz.description);
    assert.equal(tag(html, /<link rel="canonical" href="([^"]+)"/), 'https://flaner.uz/uz/');
    assert.equal(tag(html, /<meta property="og:url" content="([^"]+)"/), 'https://flaner.uz/uz/');
    assert.equal(tag(html, /<meta property="og:title" content="([^"]+)"/), SEO.uz.title);
    assert.equal(tag(html, /<meta property="og:description" content="([^"]+)"/), SEO.uz.description);
    assert.equal(tag(html, /<meta name="twitter:title" content="([^"]+)"/), SEO.uz.title);
    assert.equal(tag(html, /<meta name="twitter:description" content="([^"]+)"/), SEO.uz.description);
    assert.equal(tag(html, /<meta property="og:locale" content="([^"]+)"/), 'uz_UZ');
    assert.equal(tag(html, /<meta property="og:locale:alternate" content="([^"]+)"/), 'ru_RU');
  });

  it('both pages carry the same hreflang set, so the annotations are reciprocal', () => {
    const hreflangs = (html: string) => [...html.matchAll(/<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>/g)].map((m) => m[0]);
    assert.deepEqual(hreflangs(renderHtmlForLang(indexHtml, 'uz')), hreflangs(indexHtml));
    assert.equal(hreflangs(indexHtml).length, LANGS.length + 1);
  });

  it('the Uzbek structured data and noscript text are localized and still valid', () => {
    const html = renderHtmlForLang(indexHtml, 'uz');
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    const site = json['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebSite');
    assert.equal(site.url, 'https://flaner.uz/uz/');
    assert.equal(site.inLanguage, 'uz');
    assert.equal(json['@graph'].find((node: { '@type': string }) => node['@type'] === 'Organization').url, 'https://flaner.uz/');
    assert.match(html, /<noscript>\s*<h1>Flaner — selektiv kosmetika/);
  });

  it('does not touch the scripts and styles of the page', () => {
    const withAssets = indexHtml.replace('</body>', '<script type="module" src="/assets/app.js"></script></body>');
    assert.ok(renderHtmlForLang(withAssets, 'uz').includes('<script type="module" src="/assets/app.js"></script>'));
  });

  it('fails loudly when a tag it must replace is missing', () => {
    assert.throws(() => renderHtmlForLang(indexHtml.replace(/<link rel="canonical"[^>]*>/, ''), 'uz'), /canonical/);
  });
});

describe('sitemap.xml', () => {
  const sitemap = read('../public/sitemap.xml');
  const urls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);

  it('lists every language version once', () => {
    const locs = urls.map((block) => block.match(/<loc>([^<]+)<\/loc>/)![1]);
    assert.deepEqual(locs, LANGS.map(langUrl));
  });

  it('declares all alternates, including itself and x-default, on every URL', () => {
    assert.match(sitemap, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    for (const block of urls) {
      for (const { hreflang, href } of hreflangLinks()) {
        assert.ok(block.includes(`<xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}" />`), hreflang);
      }
    }
  });
});

describe('translated content', () => {
  it('translates every product that ships with the catalog', () => {
    const ids = [...read('../src/data/initialProducts.ts').matchAll(/^\s+id: '(prod-\d+)'/gm)].map((m) => m[1]);
    assert.ok(ids.length > 0);
    for (const id of ids) {
      const text = PRODUCT_TEXT_UZ[id];
      assert.ok(text?.description && text.howToUse && text.skinType, `${id} has no Uzbek text`);
      assert.doesNotMatch(JSON.stringify(text), /[Ѐ-ӿ]/, `${id} contains Cyrillic`);
    }
  });

  it('translates every default banner', () => {
    const ids = [...read('../src/data/siteContentDefaults.ts').matchAll(/id: '(default-[a-z-]+)'/g)].map((m) => m[1]);
    assert.deepEqual(Object.keys(DEFAULT_BANNER_TEXT_UZ).sort(), ids.sort());
  });

  it('localizes volume units only for Uzbek', () => {
    assert.equal(localizeVolume('50 мл', 'ru'), '50 мл');
    assert.equal(localizeVolume('50 мл', 'uz'), '50 ml');
    assert.equal(localizeVolume('3.2 г', 'uz'), '3.2 g');
    assert.equal(localizeVolume('2 шт', 'uz'), '2 dona');
    assert.equal(localizeVolume('100 ml', 'uz'), '100 ml');
  });

  it('replaces default banner texts and leaves administrator banners alone', () => {
    const banners = [
      { id: 'default-makeup', title: 'Макияж с характером', text: 'x', ctaLabel: 'К макияжу', active: true },
      { id: 'custom-1', title: 'Своя акция', text: 'y', ctaLabel: 'Смотреть', active: true }
    ];
    assert.equal(localizeBanners(banners, 'ru'), banners);
    const [first, second] = localizeBanners(banners, 'uz');
    assert.equal(first.title, 'Xarakterli makiyaj');
    assert.equal(first.active, true);
    assert.deepEqual(second, banners[1]);
  });

  it('formats prices with the local currency word', () => {
    assert.match(formatPrice(1250000, 'UZS'), /сум$/);
    assert.match(formatPrice(1250000, 'UZS', 'uz'), /so'm$/);
    assert.equal(formatPrice(128000, 'USD', 'uz'), '$10.00');
  });
});
