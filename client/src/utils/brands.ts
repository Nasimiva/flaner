/** Sentinel used by the storefront for "no brand filter". */
export const ALL_BRANDS = 'all';

// Brands that are known under several names. Keys and values are already in normalised form.
const BRAND_ALIASES: Record<string, string> = {
  'yves saint laurent': 'ysl',
  'saint laurent': 'ysl',
  'make up for ever': 'makeup forever',
  'make up forever': 'makeup forever',
  'makeup for ever': 'makeup forever'
};

/**
 * Canonical form of a brand name for comparing: Unicode-normalised, accents removed ("Estée" = "Estee"), outer
 * whitespace removed, inner runs of whitespace collapsed to one space, lower-cased, known aliases folded
 * ("Yves Saint Laurent" = "YSL"). Brands are typed by hand in the admin panel, so the catalog holds the same brand
 * as "NARS ", "Nars" and "  Nars ".
 */
export function normalizeBrand(value: string): string {
  const plain = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return BRAND_ALIASES[plain] ?? plain;
}

export function isSameBrand(a: string, b: string): boolean {
  return normalizeBrand(a) === normalizeBrand(b);
}

/**
 * True when the product belongs to the selected brand (or no brand is selected). A product whose brand field has
 * extra words after the brand ("Rhode Lip Tint Raspberry Jelly") still belongs to that brand ("Rhode"); a mere
 * prefix of a word ("Hour" for "Hourglass") does not.
 */
export function matchesBrand(product: { brand: string }, selectedBrand: string): boolean {
  if (selectedBrand === ALL_BRANDS) return true;
  const wanted = normalizeBrand(selectedBrand);
  if (!wanted) return true;
  const actual = normalizeBrand(product.brand);
  return actual === wanted || actual.startsWith(`${wanted} `);
}

/**
 * The distinct brands of a catalog, one entry per brand however it is spelled, ordered by name. The label is the
 * most common trimmed spelling; a brand-name prefix with extra words is folded into its brand.
 */
export function catalogBrands(products: { brand: string }[]): string[] {
  const spellings = new Map<string, Map<string, number>>();
  for (const product of products) {
    const label = product.brand.replace(/\s+/g, ' ').trim();
    const key = normalizeBrand(label);
    if (!key) continue;
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(label, (counts.get(label) ?? 0) + 1);
    spellings.set(key, counts);
  }
  // "rhode lip tint raspberry jelly" belongs to "rhode" when that brand exists on its own.
  for (const key of [...spellings.keys()]) {
    const parent = [...spellings.keys()].find((other) => other !== key && key.startsWith(`${other} `));
    if (parent) spellings.delete(key);
  }
  return [...spellings.values()]
    .map((counts) => [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0])
    .sort((a, b) => a.localeCompare(b));
}
