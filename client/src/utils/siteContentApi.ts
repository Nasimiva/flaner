// Editable storefront content: hero banners and the brand strip (/api/site-content).
// Free of React and of imports so Node can unit-test it directly. The shop never depends on it:
// any failure or missing value falls back to the defaults in data/siteContentDefaults.ts.

export type BannerCategory = 'all' | 'face-care' | 'makeup' | 'perfume';
export const BANNER_CATEGORIES: readonly BannerCategory[] = ['all', 'face-care', 'makeup', 'perfume'];

export interface Banner {
  id: string;
  title: string;
  text: string;
  ctaLabel: string;
  /** Catalog filter applied by the button. Ignored when ctaLink is set. */
  ctaCategory: BannerCategory;
  /** Optional external link (https://...). Wins over ctaCategory. */
  ctaLink: string;
  imageUrl: string;
  active: boolean;
}

export interface BrandItem {
  id: string;
  name: string;
  /** Optional logo. Without it the brand is typeset as a wordmark. */
  logoUrl: string;
}

export type ContentKey = 'banners' | 'brands';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const safeUrl = (value: unknown) => {
  const url = str(value).trim();
  return /^(https?:\/\/\S+|\/\S*)$/.test(url) ? url : '';
};

/** Ids are React keys: make a repeated or missing id unique instead of trusting stored data. */
const uniqueId = (raw: unknown, fallback: string, seen: Set<string>) => {
  let id = str(raw) || fallback;
  while (seen.has(id)) id = `${id}-${seen.size}`;
  seen.add(id);
  return id;
};

/** Keeps only well-formed banners. Returns null when nothing usable came back, so the caller uses defaults. */
export function normalizeBanners(value: unknown): Banner[] | null {
  if (!Array.isArray(value)) return null;
  const banners: Banner[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const title = str(raw.title).trim();
    const imageUrl = safeUrl(raw.imageUrl);
    if (!title || !imageUrl) continue;
    const category = BANNER_CATEGORIES.find((c) => c === raw.ctaCategory) ?? 'all';
    banners.push({
      id: uniqueId(raw.id, `banner-${banners.length}`, seen),
      title,
      text: str(raw.text).trim(),
      ctaLabel: str(raw.ctaLabel).trim(),
      ctaCategory: category,
      ctaLink: safeUrl(raw.ctaLink),
      imageUrl,
      active: raw.active !== false
    });
  }
  return banners.length ? banners : null;
}

export function normalizeBrands(value: unknown): BrandItem[] | null {
  if (!Array.isArray(value)) return null;
  const brands: BrandItem[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const name = str(raw.name).trim();
    if (!name) continue;
    brands.push({ id: uniqueId(raw.id, `brand-${brands.length}`, seen), name, logoUrl: safeUrl(raw.logoUrl) });
  }
  return brands.length ? brands : null;
}

export interface SiteContent {
  banners: Banner[] | null;
  brands: BrandItem[] | null;
}

export async function fetchSiteContent(fetchImpl: typeof fetch = fetch): Promise<SiteContent> {
  const response = await fetchImpl('/api/site-content', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`site-content ${response.status}`);
  const data: unknown = await response.json();
  const record = isRecord(data) ? data : {};
  return { banners: normalizeBanners(record.banners), brands: normalizeBrands(record.brands) };
}

async function adminRequest(key: ContentKey, init: RequestInit, fetchImpl: typeof fetch) {
  const response = await fetchImpl(`/api/admin/site-content/${key}`, init);
  if (response.ok) return response;
  let message = response.status === 401 ? 'Сессия администратора истекла. Войдите заново.' : 'Не удалось сохранить';
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      const details = Array.isArray(body.details) ? body.details.find(isRecord) : undefined;
      if (details && typeof details.message === 'string') {
        message = `${typeof details.path === 'string' && details.path ? `${details.path}: ` : ''}${details.message}`;
      } else if (typeof body.error === 'string') message = body.error;
    }
  } catch { /* keep the generic message */ }
  throw new Error(message);
}

export async function saveSiteContent(key: ContentKey, items: Banner[] | BrandItem[], fetchImpl: typeof fetch = fetch): Promise<void> {
  await adminRequest(key, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  }, fetchImpl);
}

export async function resetSiteContent(key: ContentKey, fetchImpl: typeof fetch = fetch): Promise<void> {
  await adminRequest(key, { method: 'DELETE' }, fetchImpl);
}
