import { randomUUID } from 'node:crypto';
import { RequestHandler, Router } from 'express';
import { pool } from './db/pool.js';

interface ProductRecord {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  old_price: number | null;
  rating: number;
  reviews_count: number;
  volume: string;
  images: string[];
  description: string;
  composition: string;
  how_to_use: string | null;
  skin_type: string | null;
  in_stock: boolean;
  stock_count: number;
  is_new: boolean | null;
  is_bestseller: boolean | null;
}

const routes = Router();
let adminGuard: RequestHandler = (_req, _res, next) => next();
const productWriteGuard: RequestHandler = (req, res, next) => adminGuard(req, res, next);

function serializeProduct(row: ProductRecord) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    price: Number(row.price),
    ...(row.old_price !== null ? { oldPrice: Number(row.old_price) } : {}),
    rating: Number(row.rating),
    reviewsCount: row.reviews_count,
    volume: row.volume,
    images: row.images,
    description: row.description,
    composition: row.composition,
    ...(row.how_to_use !== null ? { howToUse: row.how_to_use } : {}),
    ...(row.skin_type !== null ? { skinType: row.skin_type } : {}),
    inStock: row.in_stock,
    stockCount: row.stock_count,
    ...(row.is_new !== null ? { isNew: row.is_new } : {}),
    ...(row.is_bestseller !== null ? { isBestseller: row.is_bestseller } : {})
  };
}

function validateProduct(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Product body must be an object';
  const product = value as Record<string, unknown>;
  if (typeof product.name !== 'string' || !product.name.trim()) return 'name is required';
  if (typeof product.brand !== 'string' || !product.brand.trim()) return 'brand is required';
  if (typeof product.category !== 'string' || !product.category) return 'category is invalid';
  if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) return 'price must be a non-negative number';
  if (typeof product.rating !== 'number' || !Number.isFinite(product.rating)) return 'rating must be a number';
  if (!Number.isInteger(product.reviewsCount) || Number(product.reviewsCount) < 0) return 'reviewsCount must be a non-negative integer';
  if (typeof product.volume !== 'string') return 'volume is required';
  if (!Array.isArray(product.images) || !product.images.every((image) => typeof image === 'string')) return 'images must be an array of strings';
  if (typeof product.description !== 'string' || typeof product.composition !== 'string') return 'description and composition are required';
  if (typeof product.inStock !== 'boolean') return 'inStock must be a boolean';
  if (!Number.isInteger(product.stockCount) || Number(product.stockCount) < 0) return 'stockCount must be a non-negative integer';
  if (product.oldPrice !== undefined && product.oldPrice !== null && (typeof product.oldPrice !== 'number' || !Number.isFinite(product.oldPrice) || product.oldPrice < 0)) return 'oldPrice must be a non-negative number';
  for (const key of ['howToUse', 'skinType']) {
    if (product[key] !== undefined && product[key] !== null && typeof product[key] !== 'string') return `${key} must be a string`;
  }
  for (const key of ['isNew', 'isBestseller']) {
    if (product[key] !== undefined && product[key] !== null && typeof product[key] !== 'boolean') return `${key} must be a boolean`;
  }
  return null;
}

// Categories are managed in the admin panel, so a product may only use one that exists ('brands' is the legacy storefront filter).
async function categoryExists(category: unknown): Promise<boolean> {
  if (category === 'brands') return true;
  const result = await pool.query('SELECT 1 FROM categories WHERE id=$1', [category]);
  return Boolean(result.rowCount);
}

function values(product: Record<string, unknown>) {
  return [
    product.name, product.brand, product.category, product.price, product.oldPrice ?? null,
    product.rating, product.reviewsCount, product.volume, JSON.stringify(product.images),
    product.description, product.composition, product.howToUse ?? null, product.skinType ?? null,
    product.inStock, product.stockCount, product.isNew ?? null, product.isBestseller ?? null
  ];
}

const columns = `name, brand, category, price, old_price, rating, reviews_count, volume,
  images, description, composition, how_to_use, skin_type, in_stock, stock_count, is_new, is_bestseller`;
const setters = `name=$2, brand=$3, category=$4, price=$5, old_price=$6, rating=$7,
  reviews_count=$8, volume=$9, images=$10::jsonb, description=$11, composition=$12,
  how_to_use=$13, skin_type=$14, in_stock=$15, stock_count=$16, is_new=$17,
  is_bestseller=$18, updated_at=NOW()`;

// Public catalog read endpoint for the storefront and Telegram Mini Apps.
routes.get('/', async (_req, res) => {
  try {
    const result = await pool.query<ProductRecord>(`SELECT id, ${columns} FROM products ORDER BY created_at DESC, id`);
    res.json(result.rows.map(serializeProduct));
  } catch (error) {
    console.error('Could not load products:', error);
    res.status(503).json({ error: 'Product catalog is temporarily unavailable' });
  }
});

routes.post('/', productWriteGuard, async (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ error });
  const id = `prod-${randomUUID()}`;
  try {
    if (!(await categoryExists(req.body.category))) return res.status(400).json({ error: 'category does not exist' });
    const result = await pool.query<ProductRecord>(
      `INSERT INTO products (id, ${columns}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id, ${columns}`,
      [id, ...values(req.body)]
    );
    res.status(201).json(serializeProduct(result.rows[0]));
  } catch (cause) {
    console.error('Could not create product:', cause);
    res.status(503).json({ error: 'Could not save product' });
  }
});

routes.put('/:id', productWriteGuard, async (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ error });
  try {
    if (!(await categoryExists(req.body.category))) return res.status(400).json({ error: 'category does not exist' });
    const result = await pool.query<ProductRecord>(
      `UPDATE products SET ${setters} WHERE id=$1 RETURNING id, ${columns}`,
      [req.params.id, ...values(req.body)]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found' });
    res.json(serializeProduct(result.rows[0]));
  } catch (cause) {
    console.error('Could not update product:', cause);
    res.status(503).json({ error: 'Could not save product changes' });
  }
});

routes.patch('/:id/stock', productWriteGuard, async (req, res) => {
  if (typeof req.body?.inStock !== 'boolean') return res.status(400).json({ error: 'inStock must be a boolean' });
  try {
    const result = await pool.query<ProductRecord>(
      `UPDATE products SET in_stock=$2, updated_at=NOW() WHERE id=$1 RETURNING id, ${columns}`,
      [req.params.id, req.body.inStock]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found' });
    res.json(serializeProduct(result.rows[0]));
  } catch (cause) {
    console.error('Could not update product stock:', cause);
    res.status(503).json({ error: 'Could not update product stock' });
  }
});

routes.delete('/:id', productWriteGuard, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found' });
    res.sendStatus(204);
  } catch (cause) {
    console.error('Could not delete product:', cause);
    res.status(503).json({ error: 'Could not delete product' });
  }
});

export function createProductRoutes(requireAdmin: RequestHandler) {
  adminGuard = requireAdmin;
  return routes;
}
