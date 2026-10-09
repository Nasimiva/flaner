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
