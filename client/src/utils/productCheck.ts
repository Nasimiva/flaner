/**
 * Catalog consistency check: does the brand field match the brand written in the product name, and does the
 * category fit the product type written in the name ("Тушь ..." must not sit in "Помады").
 * Used by the admin form (warning before save) and by scripts/audit-catalog.ts (read-only report).
 * Nothing here changes data: it only compares text and suggests.
 */

export interface CheckCategory {
  id: string;
  name: string;
}

export interface CheckProduct {
  name: string;
  brand: string;
  category: string;
  description?: string;
}

export type Confidence = 'high' | 'low';

export interface BrandCheck {
  /** ok; spelling = same brand, only spaces/case/accents differ; mismatch = another brand; unknown = cannot tell. */
  kind: 'ok' | 'spelling' | 'mismatch' | 'unknown';
  suggested?: string;
  confidence?: Confidence;
  reason?: string;
}

export interface CategoryCheck {
  /** ok; mismatch = the type found in the name belongs to another category; unknown = type not found. */
  kind: 'ok' | 'mismatch' | 'unknown';
  suggested?: string;
  confidence?: Confidence;
  reason?: string;
}

/**
 * Lower-case, accents removed from Latin letters only (Estée = Estee; Cyrillic "й" stays "й"), ё = е,
 * dashes and runs of spaces folded.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/(?<=\p{Script=Latin})\p{M}+/gu, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[‐-―_]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------------------------------------------
// Brands. Key = how the brand should be written; values = every spelling that means this brand (Latin and Russian).

const BRANDS: Record<string, string[]> = {
  'YSL': ['ysl', 'yves saint laurent', 'saint laurent', 'ив сен лоран', 'ив сен-лоран', 'сен лоран', 'сен-лоран'],
  'Dior': ['dior', 'christian dior', 'диор', 'кристиан диор'],
  'Chanel': ['chanel', 'шанель'],
  'Charlotte Tilbury': ['charlotte tilbury', 'шарлотт тилбери', 'шарлотта тилбери', 'шарлотт тилбьюри'],
  'Clarins': ['clarins', 'кларанс'],
  'Clinique': ['clinique', 'клиник'],
  'Bobbi Brown': ['bobbi brown', 'бобби браун'],
  'Estée Lauder': ['estee lauder', 'эсте лаудер', 'эсти лаудер', 'эстэ лаудер'],
  'Gisou': ['gisou', 'гису', 'жису'],
  'Hourglass': ['hourglass', 'аурглас', 'аургласс'],
  'Huda Beauty': ['huda beauty', 'huda', 'худа бьюти'],
  'IT Cosmetics': ['it cosmetics', 'ит косметикс'],
  'Lancôme': ['lancome', 'ланком'],
  'Make Up For Ever': ['make up for ever', 'make up forever', 'makeup forever', 'makeup for ever', 'мейк ап фор эвер'],
  'NARS': ['nars', 'нарс'],
  'Patrick Ta': ['patrick ta', 'патрик та'],
  'Rare Beauty': ['rare beauty', 'рейр бьюти', 'рэйр бьюти'],
  'Rhode': ['rhode', 'роуд'],
  'Sol de Janeiro': ['sol de janeiro', 'сол де жанейро', 'соль де жанейро'],
  'Biodance': ['biodance', 'биоданс'],
  'Dyson': ['dyson', 'дайсон'],
  // Not in the catalog yet, kept so a new product of these brands is recognised too.
  'Fenty Beauty': ['fenty beauty', 'fenty', 'фенти'],
  'Benefit': ['benefit cosmetics', 'benefit', 'бенефит'],
  'MAC': ['mac cosmetics', 'm.a.c', 'mac'],
  'Tom Ford': ['tom ford', 'том форд'],
  'Guerlain': ['guerlain', 'герлен'],
  'Givenchy': ['givenchy', 'живанши'],
  'Giorgio Armani': ['giorgio armani', 'armani', 'армани'],
  'Sisley': ['sisley', 'сислей'],
  'Shiseido': ['shiseido', 'шисейдо'],
  'Laura Mercier': ['laura mercier', 'лаура мерсье'],
  'Too Faced': ['too faced'],
  'Urban Decay': ['urban decay'],
  'Kylie Cosmetics': ['kylie cosmetics', 'kylie'],
  'Natasha Denona': ['natasha denona'],
  'Anastasia Beverly Hills': ['anastasia beverly hills'],
  'Laneige': ['laneige', 'ланеж'],
  'Glossier': ['glossier'],
  'Summer Fridays': ['summer fridays'],
  'Kiehl\'s': ['kiehl\'s', 'kiehls', 'килс'],
  'La Mer': ['la mer', 'ла мер'],
  'Byredo': ['byredo'],
  'Kilian': ['kilian'],
  'Maison Francis Kurkdjian': ['maison francis kurkdjian', 'kurkdjian', 'mfk'],
  'Creed': ['creed']
};

const BRAND_BY_ALIAS = new Map<string, string>();
for (const [display, aliases] of Object.entries(BRANDS)) {
  for (const alias of [display, ...aliases]) BRAND_BY_ALIAS.set(normalizeText(alias), display);
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word pattern for an already normalised phrase; a space also matches a dash ("Ив Сен-Лоран", "Gisou-Cherry"). */
function phrasePattern(phrase: string): RegExp {
  const body = phrase.split(' ').map(escapeRegExp).join('[\\s-]+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'gu');
}

const BRAND_PATTERNS = [...BRAND_BY_ALIAS.entries()].map(([alias, display]) => ({ display, re: phrasePattern(alias) }));

/** Brands written in the text, in order of appearance. A short alias inside a longer one ("it" in "IT Cosmetics") is ignored. */
export function findBrands(text: string): string[] {
  const plain = normalizeText(text);
  const hits: { start: number; end: number; display: string }[] = [];
  for (const { display, re } of BRAND_PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(plain); m; m = re.exec(plain)) hits.push({ start: m.index, end: m.index + m[0].length, display });
  }
  const kept = hits.filter((hit) => !hits.some((other) => other !== hit && other.start <= hit.start && other.end >= hit.end
    && other.end - other.start > hit.end - hit.start));
  kept.sort((a, b) => a.start - b.start);
  return [...new Set(kept.map((hit) => hit.display))];
}

/** The brand a brand-field value stands for, or null when the value is not a known spelling of a brand. */
export function canonicalBrand(value: string): string | null {
  return BRAND_BY_ALIAS.get(normalizeText(value)) ?? null;
}

const tidy = (value: string) => value.replace(/\s+/g, ' ').trim();

export function checkBrand(product: CheckProduct): BrandCheck {
  const field = tidy(product.brand);
  const known = canonicalBrand(field);
  const inName = findBrands(product.name);

  if (inName.length > 0) {
    if (known && inName.includes(known)) {
      // Same brand; only report a pure spelling difference (spaces, case, accents) of the brand's own name.
      if (product.brand !== known && normalizeText(field) === normalizeText(known)) {
        return { kind: 'spelling', suggested: known, confidence: 'high', reason: `написание бренда: «${product.brand}» → «${known}»` };
      }
      return { kind: 'ok' };
    }
    const reason = known
      ? `в названии бренд ${inName.join(', ')}, а в поле бренда ${known}`
      : `в поле бренда «${field}» (опечатка или лишние слова), в названии ${inName.join(', ')}`;
    return { kind: 'mismatch', suggested: inName[0], confidence: inName.length === 1 ? 'high' : 'low',
      reason: inName.length === 1 ? reason : `${reason}; в названии несколько брендов` };
  }

  // No known brand in the name: an unknown brand typed the same way in the name and the field is fine.
  if (field && phrasePattern(normalizeText(field)).test(normalizeText(product.name))) return { kind: 'ok' };

  const inDescription = product.description ? findBrands(product.description) : [];
  if (known && (inDescription.length === 0 || inDescription.includes(known))) return { kind: 'ok' };
  if (inDescription.length === 1) {
    return { kind: 'mismatch', suggested: inDescription[0], confidence: 'low',
      reason: `в названии бренда нет, в описании ${inDescription[0]}, в поле «${field}»` };
  }
  return { kind: 'unknown', confidence: 'low', reason: `бренд «${field}» не найден ни в названии, ни в словаре брендов` };
}

// ---------------------------------------------------------------------------------------------------------------
// Product types. Patterns run on normalizeText() output: lower case, "ё" written as "е".

type TypeKey =
  | 'sets' | 'tools' | 'misc' | 'brushes' | 'hair' | 'body' | 'lips' | 'mascara' | 'eye-pencil' | 'eyeshadow'
  | 'foundation' | 'contour' | 'highlighter' | 'blush' | 'powder' | 'perfume' | 'face-care';

const B = '(?<![\\p{L}\\p{N}])'; // word start
const E = '(?![\\p{L}\\p{N}])'; // word end
const re = (source: string) => new RegExp(source, 'u');

/** In priority order: when the name fits several types, the first one is suggested. */
const TYPE_RULES: { key: TypeKey; label: string; patterns: RegExp[] }[] = [
  { key: 'sets', label: 'набор', patterns: [re(`${B}(набор|наборчик|мини-набор|адвент)`), re(`${B}(set|kit|duo|trio|bag)${E}`), re(`${B}косметичк`), re('talklip kit')] },
  { key: 'tools', label: 'техника/аксессуар', patterns: [re(`${B}расческ`), re(`${B}фен${E}`), re(`hair ?dryer|airwrap|выпрямител|${B}щипц`)] },
  { key: 'misc', label: 'фиксатор макияжа', patterns: [re(`${B}(фиксатор|setting spray|fixing spray)`)] },
  { key: 'brushes', label: 'кисть', patterns: [re(`${B}кист(ь|и|очк)`), re(`${B}brush`)] },
  { key: 'hair', label: 'уход за волосами', patterns: [re('для волос'), re(`${B}(шампун|кондиционер|shampoo|conditioner)`), re(`${B}hair${E}`)] },
  { key: 'body', label: 'уход за телом', patterns: [re('для тела'), re(`${B}body (cream|lotion|butter|oil|wash|scrub)`), re(`${B}скраб`)] },
  { key: 'lips', label: 'средство для губ', patterns: [re('для губ'), re(`${B}(помад|блеск|тинт|lipstick|gloss)`), re(`${B}lips?${E}`), re(`${B}lip ?(gloss|oil|balm|tint|liner|stick|shine|glow|maximizer|perfector|cheat|comfort)`)] },
  { key: 'mascara', label: 'тушь/подводка', patterns: [re(`${B}туш(ь|и)${E}`), re(`${B}(mascara|подводк|eye ?liner)`)] },
  { key: 'eye-pencil', label: 'карандаш для глаз/бровей', patterns: [re(`${B}карандаш(и)? для (глаз|бровей|век)`), re(`${B}(eye ?pencil|eyebrow|brows?${E})`), re(`${B}бров`)] },
  { key: 'eyeshadow', label: 'тени/палетка теней', patterns: [re(`${B}(тени|теней)${E}`), re(`${B}тени-`), re(`${B}(eye ?shadow|shadow|eye ?palette|глиттер|glitter)`), re(`${B}палетк(а|и) теней`), re('база для век')] },
  { key: 'foundation', label: 'тональное средство/консилер/база', patterns: [re(`${B}(тональн|консилер|корректор|кушон|праймер)`), re(`${B}(concealer|foundation|cushion|primer|skin tint|glow tint|tinted moisturi)`), re(`${B}(cc|bb)\\+?${E}`), re('база под макияж|flawless filter|флюид для сияния')] },
  { key: 'contour', label: 'контуринг/бронзер', patterns: [re(`${B}(контур|бронзер|contour|bronzer)`)] },
  { key: 'highlighter', label: 'хайлайтер', patterns: [re(`${B}(хайлайт|highlight|luminiz|illuminat)`), re('палетка для лица|face palette')] },
  { key: 'blush', label: 'румяна', patterns: [re(`${B}(румян|blush|cheek|rouge)`)] },
  { key: 'powder', label: 'пудра', patterns: [re(`${B}(пудр|powder)`)] },
  { key: 'perfume', label: 'парфюм', patterns: [re(`${B}(духи|парфюм|perfume|parfum|eau de|fragrance|cheirosa)`), re('туалетн(ая|ой) вод|body mist|мист для тела')] },
  { key: 'face-care', label: 'уход за кожей', patterns: [re('для лица|для кожи вокруг глаз'), re(`${B}(сыворотк|тонер|toner|пэд|pads|умывалк|cleanser|пенка|молочко|патч|эссенц|essence)`), re(`${B}маск(а|и)(?! для (волос|губ))`), re(`${B}крем для (лица|глаз|век|рук)`)] }
];

/** Only when nothing above matched: a bare "крем"/"serum" is most likely skin care. */
const GENERIC_RULES: { key: TypeKey; label: string; patterns: RegExp[] }[] = [
  { key: 'face-care', label: 'уход за кожей', patterns: [re(`${B}(крем|cream|serum|spf|skincare|уход)`)] }
];

/** Where each type lives. Built-in categories have fixed ids; the ones made in the admin panel are found by name. */
const TYPE_CATEGORY: Record<TypeKey, { ids: string[]; name?: RegExp }> = {
  'sets': { ids: ['sets'], name: /набор/i },
  'tools': { ids: ['other'] },
  'misc': { ids: ['other'] },
  'brushes': { ids: ['brushes'], name: /кист/i },
  'hair': { ids: ['hair', 'hair-care'], name: /волос/i },
  'body': { ids: ['body', 'body-care'], name: /тел[оа]/i },
  'lips': { ids: ['lips'] },
  'mascara': { ids: ['mascara'] },
  'eye-pencil': { ids: ['eye-pencil'] },
  'eyeshadow': { ids: ['eyeshadow'] },
  'foundation': { ids: ['foundation'] },
  'contour': { ids: ['contour'] },
  'highlighter': { ids: ['highlighter'] },
  'blush': { ids: ['blush'] },
  'powder': { ids: ['powder'] },
  'perfume': { ids: ['perfume'] },
  'face-care': { ids: ['face-care'] }
};

function categoryFor(key: TypeKey, categories: CheckCategory[]): CheckCategory | null {
  const where = TYPE_CATEGORY[key];
  return categories.find((c) => where.ids.includes(c.id)) ?? (where.name ? categories.find((c) => where.name!.test(c.name)) : undefined) ?? null;
}

interface TypeHit { key: TypeKey; label: string; word: string; generic: boolean }

/** Product types the text names, most specific first; generic skin-care words count only if nothing else matched. */
export function detectTypes(text: string): TypeHit[] {
  const plain = normalizeText(text);
  const run = (rules: typeof TYPE_RULES, generic: boolean): TypeHit[] => rules.flatMap((rule) => {
    for (const pattern of rule.patterns) {
      const m = pattern.exec(plain);
      if (m) return [{ key: rule.key, label: rule.label, word: m[0], generic }];
    }
    return [];
  });
  const specific = run(TYPE_RULES, false);
  return specific.length > 0 ? specific : run(GENERIC_RULES, true);
}

export function checkCategory(product: CheckProduct, categories: CheckCategory[]): CategoryCheck {
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  let hits = detectTypes(product.name);
  let source: 'name' | 'description' = 'name';
  if (hits.length === 0 && product.description) {
    hits = detectTypes(product.description);
    source = 'description';
  }
  if (hits.length === 0) return { kind: 'unknown', confidence: 'low', reason: 'тип товара по названию не определён' };

  const fits = hits.map((hit) => ({ hit, category: categoryFor(hit.key, categories) }));
  if (fits.some((fit) => fit.category?.id === product.category)) return { kind: 'ok' };

  const where = source === 'name' ? 'в названии' : 'в описании';
  const found = hits.map((hit) => `«${hit.word}» (${hit.label})`).join(', ');
  const target = fits.find((fit) => fit.category);
  if (!target?.category) {
    return { kind: 'mismatch', confidence: 'low', reason: `${where} ${found}, подходящей категории нет` };
  }
  const distinct = new Set(fits.map((fit) => fit.category?.id).filter(Boolean));
  // A description mentions many things ("наносите кистью поверх тонального крема"): suggest only if it is unambiguous.
  if (source === 'description' && distinct.size > 1) {
    return { kind: 'unknown', confidence: 'low', reason: `тип по названию не определён; в описании ${found}` };
  }
  const confidence: Confidence = source === 'name' && distinct.size === 1 && !target.hit.generic ? 'high' : 'low';
  return {
    kind: 'mismatch',
    suggested: target.category.id,
    confidence,
    reason: `${where} ${found}, а категория «${nameOf(product.category)}»`
  };
}

export interface ProductCheck {
  brand: BrandCheck;
  category: CategoryCheck;
}

export function checkProduct(product: CheckProduct, categories: CheckCategory[]): ProductCheck {
  return { brand: checkBrand(product), category: checkCategory(product, categories) };
}

/** Short warnings for the admin form; empty when the product looks consistent. Spelling-only differences are not warned. */
export function productWarnings(product: CheckProduct, categories: CheckCategory[]): string[] {
  const { brand, category } = checkProduct(product, categories);
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const warnings: string[] = [];
  if (brand.kind === 'mismatch' && brand.suggested) {
    warnings.push(tidy(product.brand)
      ? `Бренд в названии — ${brand.suggested}, а выбран «${tidy(product.brand)}».`
      : `Укажите бренд: в названии — ${brand.suggested}.`);
  }
  if (category.kind === 'mismatch') {
    warnings.push(category.suggested
      ? `Тип товара не подходит к категории «${nameOf(product.category)}». Похоже на «${nameOf(category.suggested)}».`
      : `Тип товара не подходит к категории «${nameOf(product.category)}».`);
  }
  return warnings;
}
