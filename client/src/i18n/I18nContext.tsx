import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Currency, Product } from '../types';
import { translate, type TFunction } from './translate.ts';
import { LANG_PATH, SEO, langFromPath, langUrl, hreflangLinks, type Lang } from './seo.ts';
import { localizeProduct } from './products';
import { localizeBanners } from './content.ts';
import { formatPrice as formatPriceBase } from '../utils/formatters';

interface I18nContextType {
  lang: Lang;
  /** Navigates to the other language version (/ or /uz/) without reloading the app. */
  setLang: (lang: Lang) => void;
  t: TFunction;
  localizeProduct: (product: Product) => Product;
  localizeBanners: <T extends { id: string; title: string; text: string; ctaLabel: string }>(banners: T[]) => T[];
  formatPrice: (amountInUzs: number, currency?: Currency) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const initialLang = (): Lang => (typeof window === 'undefined' ? 'ru' : langFromPath(window.location.pathname));

/** Keeps <html lang>, title, description, canonical and social tags in step with the language shown. */
function syncDocumentHead(lang: Lang) {
  const seo = SEO[lang];
  const doc = document;
  doc.documentElement.lang = seo.htmlLang;
  doc.title = seo.title;

  const setMeta = (selector: string, attribute: string, value: string, create?: () => HTMLElement) => {
    let element = doc.head.querySelector<HTMLElement>(selector);
    if (!element && create) {
      element = create();
      doc.head.appendChild(element);
    }
    element?.setAttribute(attribute, value);
  };
  const meta = (key: 'name' | 'property', name: string) => () => {
    const element = doc.createElement('meta');
    element.setAttribute(key, name);
    return element;
  };

  setMeta('meta[name="description"]', 'content', seo.description, meta('name', 'description'));
  setMeta('meta[property="og:title"]', 'content', seo.title, meta('property', 'og:title'));
  setMeta('meta[property="og:description"]', 'content', seo.description, meta('property', 'og:description'));
  setMeta('meta[name="twitter:title"]', 'content', seo.title, meta('name', 'twitter:title'));
  setMeta('meta[name="twitter:description"]', 'content', seo.description, meta('name', 'twitter:description'));
  setMeta('meta[property="og:url"]', 'content', langUrl(lang), meta('property', 'og:url'));
  setMeta('meta[property="og:locale"]', 'content', seo.ogLocale, meta('property', 'og:locale'));

  const otherLocales = (Object.keys(SEO) as Lang[]).filter((code) => code !== lang).map((code) => SEO[code].ogLocale);
  doc.head.querySelectorAll('meta[property="og:locale:alternate"]').forEach((element) => element.remove());
  for (const locale of otherLocales) {
    const element = doc.createElement('meta');
    element.setAttribute('property', 'og:locale:alternate');
    element.setAttribute('content', locale);
    doc.head.appendChild(element);
  }

  let canonical = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = doc.createElement('link');
    canonical.rel = 'canonical';
    doc.head.appendChild(canonical);
  }
  canonical.href = langUrl(lang);

  // The hreflang set is the same on every version; make sure it exists even when the HTML was served without it.
  for (const { hreflang, href } of hreflangLinks()) {
    if (!doc.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`)) {
      const link = doc.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      link.href = href;
      doc.head.appendChild(link);
    }
  }
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // Browser back/forward between / and /uz/ switches the language too.
  useEffect(() => {
    const onPopState = () => setLangState(langFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    syncDocumentHead(lang);
  }, [lang]);

  const langRef = useRef(lang);
  langRef.current = lang;

  const setLang = useCallback((next: Lang) => {
    if (langRef.current === next) return;
    const target = `${LANG_PATH[next]}${window.location.search}${window.location.hash}`;
    try {
      window.history.pushState(window.history.state, '', target);
    } catch {
      // History can be unavailable in an embedded webview; the language still switches on screen.
    }
    setLangState(next);
  }, []);

  const value = useMemo<I18nContextType>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      localizeProduct: (product) => localizeProduct(product, lang),
      localizeBanners: (banners) => localizeBanners(banners, lang),
      formatPrice: (amountInUzs, currency) => formatPriceBase(amountInUzs, currency, lang)
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
}
