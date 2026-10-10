// The storefront has no review system: stars and "N reviews" may only appear for a product with real reviews.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasReviews } from '../src/utils/formatters.ts';

describe('hasReviews', () => {
  it('is true only when the product has at least one review and a rating', () => {
    assert.equal(hasReviews({ rating: 4.7, reviewsCount: 3 }), true);
    assert.equal(hasReviews({ rating: 5, reviewsCount: 1 }), true);
  });

  it('is false for products without reviews or without a rating', () => {
    assert.equal(hasReviews({ rating: 0, reviewsCount: 0 }), false);
    assert.equal(hasReviews({ rating: 5, reviewsCount: 0 }), false);
    assert.equal(hasReviews({ rating: 0, reviewsCount: 2 }), false);
    assert.equal(hasReviews({ rating: Number.NaN, reviewsCount: 1 }), false);
    assert.equal(hasReviews({ rating: 4, reviewsCount: 1.5 }), false);
  });
});
