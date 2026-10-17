// Language versions of the storefront and their SEO metadata.
// Pure data with no imports: it is shared by the React app (runtime head sync), the Vite build
// (static dist/uz/index.html) and the unit tests that run directly in Node.

export type Lang = 'ru' | 'uz';

export const LANGS: readonly Lang[] = ['ru', 'uz'];
export const DEFAULT_LANG: Lang = 'ru';
export const SITE_ORIGIN = 'https://flaner.uz';

/** Every language lives on its own indexable URL: Russian at the root, Uzbek under /uz/. */
export const LANG_PATH: Record<Lang, string> = { ru: '/', uz: '/uz/' };

export interface LangSeo {
  /** Value of <html lang>. */
  htmlLang: string;
  /** Value of og:locale. */
  ogLocale: string;
  /** Short text on the language switcher button. */
  label: string;
  /** The language's own name, used as the switcher tooltip. */
  nativeName: string;
  title: string;
  description: string;
  /** Fallback content for visitors without JavaScript. */
  noscriptTitle: string;
  noscriptText: string;
}

export const SEO: Record<Lang, LangSeo> = {
  ru: {
    htmlLang: 'ru',
    ogLocale: 'ru_RU',
    label: 'RU',
    nativeName: 'Русский',
    title: 'Flaner Cosmetics — люксовая косметика в Ташкенте',
    description:
      'Flaner — магазин люксовой косметики в Ташкенте. Декоративная косметика, подарочные наборы, адвент-календари и уходовая косметика от популярных брендов.',
    noscriptTitle: 'Flaner — селективная косметика и нишевая парфюмерия',
    noscriptText:
      'Оригинальная продукция ведущих мировых домов красоты. Для просмотра каталога включите JavaScript или откройте бутик в Telegram: @flaneruz_bot.'
  },
  uz: {
    htmlLang: 'uz',
    ogLocale: 'uz_UZ',
    label: 'UZ',
    nativeName: "O'zbekcha",
    title: "Flaner Cosmetics — Toshkentda lyuks kosmetika",
    description:
      "Flaner — Toshkentdagi lyuks kosmetika do'koni. Dekorativ kosmetika, sovg'a to'plamlari, advent-kalendarlar va mashhur brendlarning parvarish kosmetikasi.",
    noscriptTitle: "Flaner — selektiv kosmetika va nish parfyumeriyasi",
    noscriptText:
      "Dunyoning yetakchi go'zallik uylarining original mahsulotlari. Katalogni ko'rish uchun JavaScript'ni yoqing yoki Telegramdagi butikni oching: @flaneruz_bot."
  }
};

export const langUrl = (lang: Lang): string => `${SITE_ORIGIN}${LANG_PATH[lang]}`;

/** hreflang alternates, identical on every language version (each page also references itself). */
export function hreflangLinks(): Array<{ hreflang: string; href: string }> {
  return [
    ...LANGS.map((lang) => ({ hreflang: SEO[lang].htmlLang, href: langUrl(lang) })),
    { hreflang: 'x-default', href: langUrl(DEFAULT_LANG) }
  ];
}

/** "/uz", "/uz/" and "/uz/anything" are Uzbek; everything else is the default language. */
export function langFromPath(pathname: string): Lang {
  return /^\/uz(\/|$)/i.test(pathname) ? 'uz' : 'ru';
}
