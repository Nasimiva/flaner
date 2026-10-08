import { ru, type MessageKey } from './ru.ts';
import { uz } from './uz.ts';
import type { Lang } from './seo.ts';

const DICTIONARIES: Record<Lang, Record<MessageKey, string>> = { ru, uz };

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Looks the key up in the language dictionary (Russian as the fallback) and fills the {placeholders}. */
export function translate(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  const template = DICTIONARIES[lang][key] ?? ru[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
