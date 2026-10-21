// Catalog check: brand in the name vs the brand field, product type in the name vs the category.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkBrand, checkCategory, findBrands, productWarnings } from '../src/utils/productCheck.ts';

const categories = [
  { id: 'foundation', name: 'Тональные средства и консилеры' },
  { id: 'blush', name: 'Румяна' },
  { id: 'highlighter', name: 'Хайлайтеры' },
  { id: 'eyeshadow', name: 'Палетки и тени' },
  { id: 'mascara', name: 'Тушь и подводки' },
  { id: 'lips', name: 'Помады, блески и карандаши для губ' },
  { id: 'powder', name: 'Пудры' },
  { id: 'face-care', name: 'Уход за кожей' },
  { id: 'perfume', name: 'Парфюмерия' },
  { id: 'other', name: 'Другие товары' },
  { id: 'cat-sets', name: 'Наборы и адвент-календари' },
  { id: 'cat-hair', name: 'Уход за волосами' },
  { id: 'cat-body', name: 'Уход за телом' }
];

describe('brand check', () => {
  it('knows the spellings of a brand, Latin and Russian', () => {
    assert.deepEqual(findBrands('Тональный крем Christian Dior Forever'), ['Dior']);
    assert.deepEqual(findBrands('Помада Диор'), ['Dior']);
    assert.deepEqual(findBrands('Духи Ив Сен-Лоран Libre'), ['YSL']);
    assert.deepEqual(findBrands('Yves Saint Laurent Libre'), ['YSL']);
    assert.deepEqual(findBrands('Тональный крем IT Cosmetics CC+'), ['IT Cosmetics']);
  });

  it('does not see a brand inside another word', () => {
    assert.deepEqual(findBrands('Тушь Smokey Eye Mascara — Black'), []);
    assert.deepEqual(findBrands('Bobbi Brown Brow Pencil'), ['Bobbi Brown']);
  });

  it('flags another brand in the field with high confidence', () => {
    const result = checkBrand({ name: 'Тональный крем Dior Forever Skin Glow — 1N', brand: 'Chanel', category: 'foundation' });
    assert.equal(result.kind, 'mismatch');
    assert.equal(result.suggested, 'Dior');
    assert.equal(result.confidence, 'high');
  });

  it('flags typos and extra words in the brand field', () => {
    assert.equal(checkBrand({ name: 'Румяна YSL Make Me Blush', brand: 'YLS', category: 'blush' }).suggested, 'YSL');
    assert.equal(checkBrand({ name: 'Тинт Rhode Peptide Lip Tint', brand: 'Rhode Lip Tint Raspberry Jelly', category: 'lips' }).suggested, 'Rhode');
  });

  it('accepts aliases, and only reports spaces/case as spelling', () => {
    assert.equal(checkBrand({ name: 'Помада Yves Saint Laurent Rouge', brand: 'YSL', category: 'lips' }).kind, 'ok');
    assert.equal(checkBrand({ name: 'Румяна NARS Orgasm', brand: '  Nars ', category: 'blush' }).kind, 'spelling');
  });

  it('accepts an unknown brand written the same way in the name', () => {
    assert.equal(checkBrand({ name: 'Крем Medicube Zero Pore', brand: 'Medicube', category: 'face-care' }).kind, 'ok');
  });
});

describe('category check', () => {
  const check = (name: string, category: string, description?: string) =>
    checkCategory({ name, brand: '', category, description }, categories);

  it('flags a type that belongs to another category', () => {
    const mascara = check('Тушь для ресниц Chanel Le Volume', 'lips');
    assert.equal(mascara.kind, 'mismatch');
    assert.equal(mascara.suggested, 'mascara');
    assert.equal(mascara.confidence, 'high');
    assert.equal(check('Тональный крем Dior Forever', 'perfume').suggested, 'foundation');
    assert.equal(check('Бальзам для губ Dior Addict Lip Glow', 'foundation').suggested, 'lips');
  });

  it('keeps Cyrillic "й" so "теней" and "хайлайтер" are recognised', () => {
    assert.equal(check('Палетка теней Bobbi Brown Bare Nudes', 'eyeshadow').kind, 'ok');
    assert.equal(check('Хайлайтер-стик Dior Glow Stick', 'highlighter').kind, 'ok');
  });

  it('accepts any of several fitting categories', () => {
    assert.equal(check('Румяна-хайлайтер Charlotte Tilbury', 'highlighter').kind, 'ok');
    assert.equal(check('Набор блесков для губ Gisou Duo', 'cat-sets').kind, 'ok');
    assert.equal(check('Gisou Honey Infused Hair perfume', 'perfume').kind, 'ok');
    assert.equal(check('Gisou Honey Infused Hair perfume', 'cat-hair').kind, 'ok');
  });

  it('finds admin-made categories by name', () => {
    assert.equal(check('Крем для тела Charlotte Tilbury Magic Body Cream', 'face-care').suggested, 'cat-body');
    assert.equal(check('Gisou Маска для волос', 'other').suggested, 'cat-hair');
  });

  it('does not guess from an ambiguous description', () => {
    const result = check('Hourglass Wish', 'eyeshadow', 'Палетка: бронзер, румяна и пудра');
    assert.equal(result.kind, 'unknown');
    assert.equal(result.suggested, undefined);
  });

  it('a "Тональный крем" is foundation, not skin care', () => {
    assert.equal(check('Тональный крем Clarins Double Serum — M5N', 'foundation').kind, 'ok');
  });
});

describe('admin warnings', () => {
  it('warns about both a wrong brand and a wrong category', () => {
    const warnings = productWarnings({ name: 'Тушь для ресниц Dior Diorshow', brand: 'Chanel', category: 'lips' }, categories);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /Dior/);
    assert.match(warnings[1], /Тушь и подводки/);
  });

  it('is silent for a consistent product and for spacing-only brand differences', () => {
    assert.deepEqual(productWarnings({ name: 'Румяна NARS — Orgasm', brand: 'Nars ', category: 'blush' }, categories), []);
  });
});
