import type { Category } from '../types';

/** Shown until the server answers (and if it never does), so the storefront nav is never empty. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'face-care', name: 'Уход за лицом', nameUz: 'Yuz parvarishi', sortOrder: 10 },
  { id: 'makeup', name: 'Декоративная косметика', nameUz: 'Dekorativ kosmetika', sortOrder: 20 },
  { id: 'perfume', name: 'Парфюмерия', nameUz: 'Parfyumeriya', sortOrder: 30 }
];

export function categoryLabel(category: Pick<Category, 'name' | 'nameUz'>, lang: 'ru' | 'uz'): string {
  return (lang === 'uz' && category.nameUz) || category.name;
}

/** Name for a product's category id; an unknown id (deleted or not loaded yet) falls back to the id itself. */
export function categoryLabelById(categories: Category[], id: string, lang: 'ru' | 'uz'): string {
  const found = categories.find((category) => category.id === id);
  return found ? categoryLabel(found, lang) : id;
}

/**
 * Category ids of the decorative-cosmetics categories (migration 006). The old umbrella category "makeup" is kept
 * for banner buttons and older clients: choosing it shows every decorative product.
 */
export const MAKEUP_CATEGORY = 'makeup';
export const MAKEUP_GROUP: readonly string[] = [
  MAKEUP_CATEGORY, 'foundation', 'blush', 'contour', 'highlighter', 'eyeshadow', 'eye-pencil', 'mascara', 'lips', 'powder'
];

/** True when the product is shown under the given catalog filter ('all' and 'brands' show everything). */
export function inCategory(product: { category: string }, selected: string): boolean {
  if (selected === 'all' || selected === 'brands') return true;
  if (selected === MAKEUP_CATEGORY) return MAKEUP_GROUP.includes(product.category);
  return product.category === selected;
}

/**
 * The catalog filter a banner button should apply. The banner stores a category id chosen in the admin panel; if that
 * category has since been deleted (or is not a category at all) the button opens the whole catalog instead of an empty page.
 */
export function resolveBannerCategory(
  banner: string,
  categories: Pick<Category, 'id'>[],
  products: { category: string }[]
): string {
  if (banner === 'all') return 'all';
  const exists = categories.some((category) => category.id === banner) || products.some((product) => product.category === banner);
  return exists ? banner : 'all';
}

/**
 * Choices for the banner button in the admin panel: the whole catalog plus every category that exists now (same list
 * and order as the storefront). A value that is no longer a category stays visible so it is not silently replaced.
 */
export function bannerCategoryOptions(categories: Category[], current: string): { value: string; label: string }[] {
  const options = [
    { value: 'all', label: 'Весь каталог' },
    ...categories.map((category) => ({ value: category.id, label: category.name }))
  ];
  if (!options.some((option) => option.value === current)) {
    options.push({ value: current, label: 'Категория удалена (кнопка откроет весь каталог)' });
  }
  return options;
}
