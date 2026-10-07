import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../../http/errors.js';

const CONTENT_KEYS = ['banners', 'brands'] as const;
type ContentKey = (typeof CONTENT_KEYS)[number];

// Only http(s) links and same-site paths: these values end up in href/src attributes.
const webUrl = z.string().trim().max(500).regex(/^(https?:\/\/\S+|\/\S*)$/, 'Нужна ссылка вида https://…');
const optionalWebUrl = z.union([z.literal(''), webUrl]);

export const bannerSchema = z.object({
  id: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1, 'Укажите заголовок').max(80),
  text: z.string().trim().max(220),
  ctaLabel: z.string().trim().max(30),
  ctaCategory: z.enum(['all', 'face-care', 'makeup', 'perfume']),
  ctaLink: optionalWebUrl,
  imageUrl: webUrl,
  active: z.boolean()
});

export const brandSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1, 'Укажите название бренда').max(40),
  logoUrl: optionalWebUrl
});

// The storefront uses ids as React keys, so two items with the same id would render wrongly.
const uniqueIds = (items: { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;

const bodySchemas = {
  banners: z.object({ items: z.array(bannerSchema).min(1).max(8).refine(uniqueIds, 'id элементов должны быть уникальными') }),
  brands: z.object({ items: z.array(brandSchema).min(1).max(30).refine(uniqueIds, 'id элементов должны быть уникальными') })
} satisfies Record<ContentKey, z.ZodType>;

function parseKey(value: unknown): ContentKey {
  if (typeof value === 'string' && (CONTENT_KEYS as readonly string[]).includes(value)) return value as ContentKey;
  throw new HttpError(404, 'content_not_found', 'Неизвестный раздел контента');
}

export function createSiteContentRouters(pool: Pool) {
  // Public read. A null value means "nothing saved yet: use the client defaults".
  const publicRouter = Router();
  publicRouter.get('/', asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<{ key: ContentKey; value: unknown }>('SELECT key, value FROM site_content');
    const content: Record<ContentKey, unknown> = { banners: null, brands: null };
    for (const row of rows) content[row.key] = row.value;
    res.set('Cache-Control', 'no-cache').json(content);
  }));

  // Mounted behind requireAdmin by the caller.
  const adminRouter = Router();
  adminRouter.put('/:key', asyncHandler(async (req, res) => {
    const key = parseKey(req.params.key);
    const { items } = bodySchemas[key].parse(req.body);
    await pool.query(
      `INSERT INTO site_content (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(items)]
    );
    res.json({ key, items });
  }));

  // Back to the bundled defaults.
  adminRouter.delete('/:key', asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM site_content WHERE key = $1', [parseKey(req.params.key)]);
    res.status(204).end();
  }));

  return { publicRouter, adminRouter };
}
