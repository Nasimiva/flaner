import type { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { PRODUCT_TEXT_UZ, localizeVolume, type ProductTextUz } from './content.ts';
import type { Lang } from './seo.ts';

const SEED_BY_ID = new Map(INITIAL_PRODUCTS.map((product) => [product.id, product]));

/**
 * Display copy of a product in the shopper's language. The Uzbek text replaces a field only while the database
 * still holds the original seeded Russian text, so a description an administrator rewrote is never overridden
 * by a stale translation. The catalog itself is not modified: admin screens keep working with the raw product.
 */
export function localizeProduct(product: Product, lang: Lang): Product {
  if (lang === 'ru') return product;
  const translation = PRODUCT_TEXT_UZ[product.id];
  const seed = SEED_BY_ID.get(product.id);

  const pick = (field: keyof ProductTextUz): string | undefined => {
    const current = product[field];
    const translated = translation?.[field];
    return translated && seed && seed[field] === current ? translated : current;
  };

  return {
    ...product,
    volume: localizeVolume(product.volume, lang),
    description: pick('description') ?? product.description,
    howToUse: pick('howToUse'),
    skinType: pick('skinType')
  };
}
