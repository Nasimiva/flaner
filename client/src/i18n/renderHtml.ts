// Build-time helper: turns the Russian index.html into the static HTML of another language version.
// Pure string work with no imports from the app, so Vite and the Node tests can both use it.
import { LANG_PATH, SEO, langUrl, type Lang } from './seo.ts';

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Replaces the single match of `pattern` with the string returned by `build`. A tag that is missing or duplicated
 * fails the build instead of silently shipping the wrong SEO.
 */
function replaceOnce(html: string, pattern: RegExp, build: (match: RegExpMatchArray) => string, label: string): string {
  const found = html.match(new RegExp(pattern.source, `${pattern.flags}g`));
  if (!found || found.length !== 1) {
    throw new Error(`index.html: expected exactly one ${label}, found ${found ? found.length : 0}`);
  }
  return html.replace(pattern, (...args) => build(args as unknown as RegExpMatchArray));
}

/**
 * Returns the HTML of `lang`. The Russian page is the source file itself and is returned unchanged;
 * every other language gets its own title, description, canonical, social tags, structured data and noscript text.
 */
export function renderHtmlForLang(html: string, lang: Lang): string {
  if (lang === 'ru') return html;
  const seo = SEO[lang];
  const url = langUrl(lang);
  let out = html;

  out = replaceOnce(out, /<html lang="[^"]*"/, () => `<html lang="${seo.htmlLang}"`, '<html lang>');
  out = replaceOnce(out, /<title>[^<]*<\/title>/, () => `<title>${escapeText(seo.title)}</title>`, '<title>');

  const setMeta = (attribute: 'name' | 'property', key: string, value: string) => {
    out = replaceOnce(
      out,
      new RegExp(`(<meta ${attribute}="${key}" content=")[^"]*(")`),
      (m) => `${m[1]}${escapeAttr(value)}${m[2]}`,
      `<meta ${key}>`
    );
  };
  setMeta('name', 'description', seo.description);
  setMeta('property', 'og:title', seo.title);
  setMeta('property', 'og:description', seo.description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:locale', seo.ogLocale);
  setMeta('name', 'twitter:title', seo.title);
  setMeta('name', 'twitter:description', seo.description);
  // The page is no longer Russian, so Russian becomes the alternate locale.
  setMeta('property', 'og:locale:alternate', SEO.ru.ogLocale);

  out = replaceOnce(out, /(<link rel="canonical" href=")[^"]*(")/, (m) => `${m[1]}${url}${m[2]}`, '<link rel="canonical">');

  out = replaceOnce(
    out,
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    (m) => {
      const data = JSON.parse(m[2]);
      for (const node of data['@graph'] ?? []) {
        if (node['@type'] === 'WebSite') {
          node['@id'] = `${url}#website`;
          node.url = url;
          node.inLanguage = seo.htmlLang;
          node.description = seo.description;
        }
      }
      const json = JSON.stringify(data, null, 2)
        .split('\n')
        .map((line) => `      ${line}`)
        .join('\n');
      return `${m[1]}\n${json}\n    ${m[3]}`;
    },
    'ld+json block'
  );

  out = replaceOnce(
    out,
    /(<noscript>\s*)<h1>[^<]*<\/h1>\s*<p>[^<]*<\/p>(\s*<\/noscript>)/,
    (m) => `${m[1]}<h1>${escapeText(seo.noscriptTitle)}</h1>\n      <p>${escapeText(seo.noscriptText)}</p>${m[2]}`,
    '<noscript> block'
  );

  return out;
}

/** Path of the generated file inside the build output, for example "uz/index.html". */
export const outputPathForLang = (lang: Lang): string => `${LANG_PATH[lang].replace(/^\//, '')}index.html`;
