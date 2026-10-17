// Pure helpers for the cart and the favorites list kept in localStorage.
// The cart stores only { productId, quantity }; names, images and prices always come from the live catalog.
// No imports on purpose: this file is unit-tested directly by Node.

export interface CartLine {
  productId: string;
  quantity: number;
}

/** Same limits as the leads API (server/src/modules/leads/leadSchemas.ts). */
export const MAX_QUANTITY_PER_ITEM = 20;
export const MAX_ITEMS_PER_LEAD = 30;

const clampQuantity = (value: unknown): number => {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) ? Math.min(MAX_QUANTITY_PER_ITEM, Math.max(1, quantity)) : 1;
};

/**
 * Reads the stored cart. Understands the current format ([{ productId, quantity }]) and the legacy one
 * ([{ product: { id, ... }, quantity }]) so existing shoppers keep their cart. Garbage is dropped,
 * duplicates are merged and limits are enforced.
 */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const merged = new Map<string, number>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as { productId?: unknown; product?: { id?: unknown }; quantity?: unknown };
    const productId = typeof candidate.productId === 'string' ? candidate.productId : candidate.product?.id;
    if (typeof productId !== 'string' || !productId.trim()) continue;
    const previous = merged.get(productId) ?? 0;
    merged.set(productId, Math.min(MAX_QUANTITY_PER_ITEM, previous + clampQuantity(candidate.quantity)));
  }
  return [...merged].slice(0, MAX_ITEMS_PER_LEAD).map(([productId, quantity]) => ({ productId, quantity }));
}

/** Sets the quantity of one line (adding it when missing). The result never exceeds the limits. */
export function upsertLine(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  const next = clampQuantity(quantity);
  if (lines.some((line) => line.productId === productId)) {
    return lines.map((line) => (line.productId === productId ? { ...line, quantity: next } : line));
  }
  return lines.length >= MAX_ITEMS_PER_LEAD ? lines : [...lines, { productId, quantity: next }];
}

export function parseStoredFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.trim() !== ''))];
  } catch {
    return [];
  }
}

/** Order-independent description of a cart, used to decide whether a retry is the same submission. */
export function cartSignature(lines: CartLine[]): string {
  return lines
    .map((line) => `${line.productId}:${line.quantity}`)
    .sort()
    .join('|');
}
