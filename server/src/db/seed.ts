import { INITIAL_PRODUCTS } from '../../../client/src/data/initialProducts.js';
import { pool } from './pool.js';

async function seed() {
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if (result.rows[0].count > 0) {
    console.log(`Seed skipped: products table already contains ${result.rows[0].count} products.`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const product of INITIAL_PRODUCTS) {
      await client.query(
        `INSERT INTO products (
          id, name, brand, category, price, old_price, rating, reviews_count,
          volume, images, description, composition, how_to_use, skin_type,
          in_stock, stock_count, is_new, is_bestseller
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14,
          $15, $16, $17, $18
        ) ON CONFLICT (id) DO NOTHING`,
        [
          product.id, product.name, product.brand, product.category, product.price,
          product.oldPrice ?? null, product.rating, product.reviewsCount,
          product.volume, JSON.stringify(product.images), product.description,
          product.composition, product.howToUse ?? null, product.skinType ?? null,
          product.inStock, product.stockCount, product.isNew ?? null,
          product.isBestseller ?? null
        ]
      );
    }
    await client.query('COMMIT');
    console.log(`Seeded ${INITIAL_PRODUCTS.length} products from initialProducts.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

seed().catch((error: unknown) => {
  console.error('Product seed failed:', error);
  process.exitCode = 1;
}).finally(() => pool.end());
