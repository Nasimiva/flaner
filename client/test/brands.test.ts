// Brand filter: choosing a brand in the carousel must show every product of that brand, however the admin typed it.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_BRANDS, isSameBrand, matchesBrand, normalizeBrand } from '../src/utils/brands.ts';

let n = 0;
const product = (brand: string, name = `Product ${++n}`) => ({ id: `p${n}`, name, brand });

// The brand spellings that really exist in the production catalog (note the stray spaces and mixed case).
const catalog = [
  product('NARS '), product('NARS '), product('NARS '), product('NARS '),
  product('Nars'),
  ...Array.from({ length: 7 }, () => product('Nars ')),
  product('  Nars '), product('  Nars '),
  ...Array.from({ length: 4 }, () => product('Sol De Janeiro ')),
  product('Sol de Janeiro '),
  product(' Sol De Janeiro '),
  product('Sol De Janeiro'), product('Sol De Janeiro'),
  product('Gisou '), product('Gisou '), product('Gisou '), product('Gisou'), product(' Gisou'),
  product('Hourglass '), product('Hourglass'),
  product('Makeup Forever '),
  product('Charlotte Tilbury')
];

const visible = (selectedBrand: string) => catalog.filter((p) => matchesBrand(p, selectedBrand));
const count = (brand: string) => catalog.filter((p) => normalizeBrand(p.brand) === normalizeBrand(brand)).length;

describe('normalizeBrand', () => {
  it('ignores case and outer/inner whitespace', () => {
    assert.equal(normalizeBrand('  Nars '), 'nars');
    assert.equal(normalizeBrand('NARS'), 'nars');
    assert.equal(normalizeBrand('Sol   De\tJaneiro'), 'sol de janeiro');
    assert.equal(normalizeBrand('Makeup\u00A0Forever\u00A0'), 'makeup forever', 'non-breaking spaces count as spaces');
  });

  it('treats composed and decomposed accents as the same letters, and folds Cyrillic case', () => {
    assert.equal(normalizeBrand('Estée Lauder'), normalizeBrand('Este\u0301e Lauder'));
    assert.equal(normalizeBrand('  ЛЮКС  Бренд'), 'люкс бренд');
  });
});

describe('isSameBrand', () => {
  it('matches the same brand written differently and nothing else', () => {
    assert.equal(isSameBrand('Nars', 'NARS '), true);
    assert.equal(isSameBrand(' gisou', 'GISOU'), true);
    assert.equal(isSameBrand('Nars', 'Narsil'), false, 'no substring matching');
    assert.equal(isSameBrand('Nars', 'Sol De Janeiro'), false);
    assert.equal(isSameBrand('Sol De Janeiro', 'SolDeJaneiro'), false, 'spaces inside a name still matter');
  });
});

describe('matchesBrand (carousel selection)', () => {
  it('"all" shows everything', () => {
    assert.equal(visible(ALL_BRANDS).length, catalog.length);
  });

  it('NARS from the carousel shows every NARS product, whatever its spelling', () => {
    const shown = visible('Nars'); // the carousel stores the name as "Nars"
    assert.equal(shown.length, 14);
    assert.equal(shown.length, count('NARS'));
    assert.ok(shown.every((p) => normalizeBrand(p.brand) === 'nars'));
    assert.equal(visible('NARS').length, 14, 'selecting by another case gives the same result');
    assert.equal(visible('  nars  ').length, 14);
  });

  it('shows all products of each carousel brand and never another brand', () => {
    const expected: Record<string, number> = { 'Sol De Janeiro': 8, Nars: 14, 'Makeup Forever': 1, Gisou: 5 };
    for (const [brand, total] of Object.entries(expected)) {
      const shown = visible(brand);
      assert.equal(shown.length, total, brand);
      assert.ok(shown.every((p) => isSameBrand(p.brand, brand)), `${brand}: only its own products`);
      for (const other of Object.keys(expected).filter((b) => b !== brand)) {
        assert.ok(!shown.some((p) => isSameBrand(p.brand, other)), `${brand} must not include ${other}`);
      }
    }
  });

  it('a brand with no products shows nothing, and brands that merely share letters do not leak in', () => {
    assert.equal(visible('Chanel').length, 0);
    assert.equal(visible('Hour').length, 0, 'prefix of a brand is not that brand');
    assert.equal(visible('Hourglass').length, 2);
  });
});
