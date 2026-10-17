// The hero banner button must open the real, current catalog categories (not a fixed list of three).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bannerCategoryOptions, DEFAULT_CATEGORIES, inCategory, resolveBannerCategory } from '../src/utils/categories.ts';

// The shape /api/categories returns on production (shortened).
const catalog = [
  { id: 'foundation', name: 'Тональные средства и консилеры', nameUz: 'Tonal vositalar', sortOrder: 10 },
  { id: 'blush', name: 'Румяна', nameUz: 'Rumyanalar', sortOrder: 20 },
  { id: 'contour', name: 'Контуринг и бронзеры', nameUz: 'Kontur va bronzerlar', sortOrder: 30 },
  { id: 'face-care', name: 'Уход за кожей', nameUz: 'Teri parvarishi', sortOrder: 100 },
  { id: 'cat-33cab89b', name: 'Уход за волосами', nameUz: '', sortOrder: 240 },
  { id: 'makeup', name: 'Декоративная косметика', nameUz: 'Dekorativ kosmetika', sortOrder: 200 }
];

describe('bannerCategoryOptions', () => {
  it('offers the whole catalog plus every existing category, in catalog order', () => {
    const options = bannerCategoryOptions(catalog, 'contour');
    assert.deepEqual(options.map((o) => o.value), ['all', ...catalog.map((c) => c.id)]);
    assert.equal(options[0].label, 'Весь каталог');
    assert.equal(options.find((o) => o.value === 'blush')?.label, 'Румяна');
    assert.equal(options.find((o) => o.value === 'cat-33cab89b')?.label, 'Уход за волосами');
  });

  it('is not limited to the three built-in categories', () => {
    assert.ok(bannerCategoryOptions(catalog, 'all').length > DEFAULT_CATEGORIES.length + 1);
  });

  it('keeps a deleted category visible instead of silently replacing it', () => {
    const options = bannerCategoryOptions(catalog, 'cat-gone');
    assert.equal(options.at(-1)?.value, 'cat-gone');
    assert.match(options.at(-1)!.label, /удалена/);
  });
});

describe('resolveBannerCategory', () => {
  const products = [{ category: 'contour' }, { category: 'blush' }, { category: 'face-care' }];

  it('opens the chosen category when it exists', () => {
    assert.equal(resolveBannerCategory('contour', catalog, products), 'contour');
    assert.equal(resolveBannerCategory('cat-33cab89b', catalog, products), 'cat-33cab89b');
    assert.equal(resolveBannerCategory('all', catalog, products), 'all');
  });

  it('falls back to the whole catalog for a deleted or unknown category', () => {
    assert.equal(resolveBannerCategory('cat-gone', catalog, products), 'all');
    assert.equal(resolveBannerCategory('brands', catalog, products), 'all');
  });

  it('still works when only the products are known (categories request failed)', () => {
    assert.equal(resolveBannerCategory('contour', DEFAULT_CATEGORIES, products), 'contour');
  });

  it('the resolved filter shows exactly the products of that category', () => {
    const shown = products.filter((p) => inCategory(p, resolveBannerCategory('contour', catalog, products)));
    assert.deepEqual(shown, [{ category: 'contour' }]);
  });
});
