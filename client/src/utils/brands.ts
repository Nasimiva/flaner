/** Sentinel used by the storefront for "no brand filter". */
export const ALL_BRANDS = 'all';

/**
 * Canonical form of a brand name for comparing: Unicode-normalised, outer whitespace removed, inner runs of
 * whitespace collapsed to one space, lower-cased. Brands are typed by hand in the admin panel, so the catalog
 * holds the same brand as "NARS ", "Nars" and "  Nars ".
 */
export function normalizeBrand(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isSameBrand(a: string, b: string): boolean {
  return normalizeBrand(a) === normalizeBrand(b);
}

/** True when the product belongs to the selected brand (or no brand is selected). */
export function matchesBrand(product: { brand: string }, selectedBrand: string): boolean {
  if (selectedBrand === ALL_BRANDS) return true;
  return isSameBrand(product.brand, selectedBrand);
}
