// The storefront must only show (and the admin form only save) an old price that is a real discount.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasOldPrice, oldPriceToSave } from '../src/utils/formatters.ts';

describe('hasOldPrice', () => {
  it('is true only when the old price is higher than the price', () => {
    assert.equal(hasOldPrice({ price: 400000, oldPrice: 520000 }), true);
    assert.equal(hasOldPrice({ price: 400000, oldPrice: 400001 }), true);
  });

  it('is false for a missing, zero, equal, lower or invalid old price (production has price === oldPrice rows)', () => {
    assert.equal(hasOldPrice({ price: 800000 }), false);
    assert.equal(hasOldPrice({ price: 800000, oldPrice: undefined }), false);
    assert.equal(hasOldPrice({ price: 800000, oldPrice: null }), false);
    assert.equal(hasOldPrice({ price: 400000, oldPrice: 0 }), false);
    assert.equal(hasOldPrice({ price: 800000, oldPrice: 800000 }), false);
    assert.equal(hasOldPrice({ price: 800000, oldPrice: 700000 }), false);
    assert.equal(hasOldPrice({ price: 800000, oldPrice: Number.NaN }), false);
  });
});

describe('oldPriceToSave', () => {
  it('keeps a real discount and drops everything else', () => {
    assert.equal(oldPriceToSave(400000, 520000), 520000);
    assert.equal(oldPriceToSave(400000, 400000), undefined, 'the form re-fills the price when old price is empty');
    assert.equal(oldPriceToSave(400000, 0), undefined);
    assert.equal(oldPriceToSave(400000, 300000), undefined);
    assert.equal(oldPriceToSave(400000, Number.NaN), undefined);
  });
});
