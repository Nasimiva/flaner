import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../../http/errors.js';

const categoryBody = z.object({
  name: z.string().trim().min(1, 'Укажите название категории').max(60),
  nameUz: z.string().trim().max(60).optional().default('')
});

interface CategoryRow {
  id: string;
  name_ru: string;
  name_uz: string;
  sort_order: number;
}

const serialize = (row: CategoryRow) => ({ id: row.id, name: row.name_ru, nameUz: row.name_uz, sortOrder: row.sort_order });

export function createCategoryRouters(pool: Pool) {
  // Compared in JS: PostgreSQL lower() depends on the database locale and may not fold Cyrillic.
  const assertNameFree = async (name: string, exceptId?: string) => {
    const { rows } = await pool.query<{ id: string; name_ru: string }>('SELECT id, name_ru FROM categories');
    const wanted = name.toLowerCase();
    if (rows.some((row) => row.id !== exceptId && row.name_ru.toLowerCase() === wanted)) {
      throw new HttpError(409, 'category_exists', 'Категория с таким названием уже есть');
    }
  };

  const publicRouter = Router();
  publicRouter.get('/', asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<CategoryRow>('SELECT id, name_ru, name_uz, sort_order FROM categories ORDER BY sort_order, created_at, id');
    res.set('Cache-Control', 'no-cache').json(rows.map(serialize));
  }));

  // Mounted behind requireAdmin by the caller.
  const adminRouter = Router();

  adminRouter.post('/', asyncHandler(async (req, res) => {
    const { name, nameUz } = categoryBody.parse(req.body);
    await assertNameFree(name);
    const { rows } = await pool.query<CategoryRow>(
      `INSERT INTO categories (id, name_ru, name_uz, sort_order)
       VALUES ($1, $2, $3, COALESCE((SELECT MAX(sort_order) FROM categories), 0) + 10)
       RETURNING id, name_ru, name_uz, sort_order`,
      [`cat-${randomUUID().slice(0, 8)}`, name, nameUz]
    );
    res.status(201).json(serialize(rows[0]));
  }));

  adminRouter.put('/:id', asyncHandler(async (req, res) => {
    const { name, nameUz } = categoryBody.parse(req.body);
    await assertNameFree(name, req.params.id);
    const { rows } = await pool.query<CategoryRow>(
      'UPDATE categories SET name_ru = $2, name_uz = $3 WHERE id = $1 RETURNING id, name_ru, name_uz, sort_order',
      [req.params.id, name, nameUz]
    );
    if (!rows.length) throw new HttpError(404, 'category_not_found', 'Категория не найдена');
    res.json(serialize(rows[0]));
  }));

  adminRouter.delete('/:id', asyncHandler(async (req, res) => {
    const used = await pool.query('SELECT COUNT(*)::int AS n FROM products WHERE category = $1', [req.params.id]);
    if (used.rows[0].n > 0) {
      throw new HttpError(409, 'category_in_use', `В категории ещё ${used.rows[0].n} товар(ов). Сначала перенесите их в другую категорию.`);
    }
    const result = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new HttpError(404, 'category_not_found', 'Категория не найдена');
    res.status(204).end();
  }));

  return { publicRouter, adminRouter };
}
