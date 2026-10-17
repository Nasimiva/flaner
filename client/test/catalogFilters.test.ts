// Catalog filters: brand carousel/chips and type categories must reach every product of the catalog.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogBrands, matchesBrand } from '../src/utils/brands.ts';
import { inCategory, MAKEUP_GROUP } from '../src/utils/categories.ts';

describe('brand filter across the real catalog spellings', () => {
  const catalog = [
    { brand: 'YSL' }, { brand: 'YSL' }, { brand: 'Estee Lauder ' }, { brand: '  Estee Lauder ' },
    { brand: 'Rhode' }, { brand: 'Rhode ' }, { brand: 'Rhode Lip Tint Raspberry Jelly' }, { brand: 'Hourglass' }
  ];
  const shown = (brand: string) => catalog.filter((p) => matchesBrand(p, brand)).length;

  it('treats accents and known aliases as the same brand', () => {
    assert.equal(shown('Estée Lauder'), 2);
    assert.equal(shown('Yves Saint Laurent'), 2);
    assert.equal(shown('Saint Laurent'), 2);
  });

  it('keeps a product whose brand field has extra words, but not a word prefix', () => {
    assert.equal(shown('Rhode'), 3);
    assert.equal(shown('Hour'), 0);
  });

  it('lists each brand once, with its most common spelling', () => {
    assert.deepEqual(catalogBrands(catalog), ['Estee Lauder', 'Hourglass', 'Rhode', 'YSL']);
  });
});

describe('category filter', () => {
  const p = (category: string) => ({ category });

  it('shows only the chosen type category', () => {
    assert.equal(inCategory(p('blush'), 'blush'), true);
    assert.equal(inCategory(p('lips'), 'blush'), false);
  });

  it('"all" and "brands" show everything; the old makeup umbrella shows every decorative category', () => {
    assert.equal(inCategory(p('perfume'), 'all'), true);
    assert.equal(inCategory(p('perfume'), 'brands'), true);
    for (const id of MAKEUP_GROUP) assert.equal(inCategory(p(id), 'makeup'), true, id);
    assert.equal(inCategory(p('face-care'), 'makeup'), false);
    assert.equal(inCategory(p('perfume'), 'makeup'), false);
  });
});
