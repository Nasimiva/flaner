import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { DEFAULT_BANNERS, DEFAULT_BRANDS } from '../data/siteContentDefaults';
import {
  fetchSiteContent,
  resetSiteContent,
  saveSiteContent,
  type Banner,
  type BannerCategory,
  type BrandItem,
  type ContentKey
} from '../utils/siteContentApi';

const MAX_BANNERS = 8;
const MAX_BRANDS = 30;

const CATEGORY_LABELS: Record<BannerCategory, string> = {
  all: 'Весь каталог',
  'face-care': 'Уход за лицом',
  makeup: 'Декоративная косметика',
  perfume: 'Парфюмерия'
};

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const isWebUrl = (value: string) => /^(https?:\/\/\S+|\/\S*)$/.test(value.trim());

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-[#E0D7CE] rounded-xl focus:outline-none focus:border-[#6E4F3E] focus:ring-1 focus:ring-[#6E4F3E] text-[#2A2421] placeholder:text-[#A89A90]';
const labelClass = 'block text-[11px] font-semibold text-[#6E5C51] mb-1';
const iconButton =
  'w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[#E0D7CE] text-[#52443C] bg-white hover:bg-[#F0E8E0] disabled:opacity-40 disabled:hover:bg-white transition-colors';

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = items.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

function validateBanners(banners: Banner[]): string | null {
  for (const [i, banner] of banners.entries()) {
    const n = i + 1;
    if (!banner.title.trim()) return `Баннер ${n}: укажите заголовок`;
    if (!isWebUrl(banner.imageUrl)) return `Баннер ${n}: укажите ссылку на изображение (https://…)`;
    if (banner.ctaLink.trim() && !isWebUrl(banner.ctaLink)) return `Баннер ${n}: ссылка кнопки должна начинаться с https://`;
    if (banner.ctaLabel.trim() === '' && banner.ctaLink.trim()) return `Баннер ${n}: укажите текст кнопки или очистите ссылку`;
  }
  if (!banners.some((banner) => banner.active)) return 'Включите хотя бы один баннер или сбросьте на стандартные';
  return null;
}

function validateBrands(brands: BrandItem[]): string | null {
  for (const [i, brand] of brands.entries()) {
    if (!brand.name.trim()) return `Бренд ${i + 1}: укажите название`;
    if (brand.logoUrl.trim() && !isWebUrl(brand.logoUrl)) return `Бренд ${i + 1}: ссылка на логотип должна начинаться с https://`;
  }
  return null;
}

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; message: string } | { kind: 'error'; message: string };

const StatusLine: React.FC<{ state: SaveState }> = ({ state }) => {
  if (state.kind === 'saved') return <span role="status" className="text-xs font-semibold text-emerald-700">{state.message}</span>;
  if (state.kind === 'error') return <span role="alert" className="text-xs font-semibold text-rose-700">{state.message}</span>;
  return null;
};

export const AdminContent: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_BANNERS);
  const [brands, setBrands] = useState<BrandItem[]>(DEFAULT_BRANDS);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [bannerState, setBannerState] = useState<SaveState>({ kind: 'idle' });
  const [brandState, setBrandState] = useState<SaveState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    fetchSiteContent().then(
      (content) => {
        if (cancelled) return;
        setBanners(content.banners ?? DEFAULT_BANNERS);
        setBrands(content.brands ?? DEFAULT_BRANDS);
        setLoaded(true);
      },
      () => {
        if (cancelled) return;
        setLoadError('Не удалось загрузить сохранённый контент. Показаны стандартные значения.');
        setLoaded(true);
      }
    );
    return () => { cancelled = true; };
  }, []);

  const save = async (key: ContentKey) => {
    const setState = key === 'banners' ? setBannerState : setBrandState;
    const problem = key === 'banners' ? validateBanners(banners) : validateBrands(brands);
    if (problem) return setState({ kind: 'error', message: problem });
    setState({ kind: 'saving' });
    try {
      if (key === 'banners') {
        await saveSiteContent('banners', banners.map((b) => ({ ...b, title: b.title.trim(), text: b.text.trim(), ctaLabel: b.ctaLabel.trim(), ctaLink: b.ctaLink.trim(), imageUrl: b.imageUrl.trim() })));
      } else {
        await saveSiteContent('brands', brands.map((b) => ({ ...b, name: b.name.trim(), logoUrl: b.logoUrl.trim() })));
      }
      setState({ kind: 'saved', message: 'Сохранено. Изменения уже на сайте.' });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Не удалось сохранить' });
    }
  };

  const reset = async (key: ContentKey) => {
    const label = key === 'banners' ? 'баннеры' : 'бренды';
    if (!window.confirm(`Вернуть стандартные ${label}? Ваши изменения будут удалены.`)) return;
    const setState = key === 'banners' ? setBannerState : setBrandState;
    setState({ kind: 'saving' });
    try {
      await resetSiteContent(key);
      if (key === 'banners') setBanners(DEFAULT_BANNERS); else setBrands(DEFAULT_BRANDS);
      setState({ kind: 'saved', message: 'Стандартные значения восстановлены.' });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Не удалось сбросить' });
    }
  };

  const patchBanner = (id: string, patch: Partial<Banner>) => {
    setBannerState({ kind: 'idle' });
    setBanners((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };
  const patchBrand = (id: string, patch: Partial<BrandItem>) => {
    setBrandState({ kind: 'idle' });
    setBrands((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  if (!loaded) return <p className="text-sm text-[#8A796F]">Загрузка…</p>;

  return (
    <div className="space-y-8" data-testid="admin-content">
      {loadError && <p role="alert" className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{loadError}</p>}

      {/* ---------------- Banners ---------------- */}
      <section className="space-y-4" aria-labelledby="content-banners">
        <div>
          <h2 id="content-banners" className="text-base font-bold text-[#2A2421]">Рекламные баннеры</h2>
          <p className="text-xs text-[#8A796F] mt-0.5">
            Слайдер в начале главной страницы. Лучше всего подходят горизонтальные или квадратные фото от 1200 px по ширине. Баннеры сменяются в том порядке, в котором стоят здесь.
          </p>
        </div>

        <ul className="space-y-3">
          {banners.map((banner, i) => (
            <li key={banner.id} className="bg-white rounded-2xl border border-[#EAE3DC] p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-[#EFE8DF] border border-[#E4DBD1]">
                    {isWebUrl(banner.imageUrl) && (
                      <img src={banner.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} onLoad={(e) => { e.currentTarget.style.visibility = 'visible'; }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#2A2421] truncate">{banner.title || 'Без заголовка'}</p>
                    <label className="inline-flex items-center gap-2 text-xs text-[#6E5C51] min-h-9 cursor-pointer">
                      <input type="checkbox" checked={banner.active} onChange={(e) => patchBanner(banner.id, { active: e.target.checked })} className="w-4 h-4 accent-[#2A2421]" />
                      Показывать на сайте
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" className={iconButton} aria-label="Выше" disabled={i === 0} onClick={() => { setBannerState({ kind: 'idle' }); setBanners((items) => move(items, i, i - 1)); }}><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" className={iconButton} aria-label="Ниже" disabled={i === banners.length - 1} onClick={() => { setBannerState({ kind: 'idle' }); setBanners((items) => move(items, i, i + 1)); }}><ArrowDown className="w-4 h-4" /></button>
                  <button
                    type="button"
                    className={`${iconButton} hover:text-rose-700`}
                    aria-label="Удалить баннер"
                    disabled={banners.length === 1}
                    onClick={() => { setBannerState({ kind: 'idle' }); setBanners((items) => items.filter((item) => item.id !== banner.id)); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor={`b-title-${banner.id}`}>Заголовок</label>
                  <input id={`b-title-${banner.id}`} className={inputClass} maxLength={80} value={banner.title} onChange={(e) => patchBanner(banner.id, { title: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`b-image-${banner.id}`}>Ссылка на изображение</label>
                  <input id={`b-image-${banner.id}`} className={inputClass} inputMode="url" placeholder="https://…" value={banner.imageUrl} onChange={(e) => patchBanner(banner.id, { imageUrl: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor={`b-text-${banner.id}`}>Короткий текст</label>
                  <textarea id={`b-text-${banner.id}`} className={`${inputClass} resize-none`} rows={2} maxLength={220} value={banner.text} onChange={(e) => patchBanner(banner.id, { text: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`b-cta-${banner.id}`}>Текст кнопки</label>
                  <input id={`b-cta-${banner.id}`} className={inputClass} maxLength={30} placeholder="Например, Смотреть уход" value={banner.ctaLabel} onChange={(e) => patchBanner(banner.id, { ctaLabel: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`b-cat-${banner.id}`}>Кнопка открывает раздел каталога</label>
                  <select id={`b-cat-${banner.id}`} className={inputClass} value={banner.ctaCategory} disabled={Boolean(banner.ctaLink.trim())} onChange={(e) => patchBanner(banner.id, { ctaCategory: e.target.value as BannerCategory })}>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor={`b-link-${banner.id}`}>Или своя ссылка (необязательно)</label>
                  <input id={`b-link-${banner.id}`} className={inputClass} inputMode="url" placeholder="https://t.me/… Если заполнить, кнопка откроет её вместо каталога" value={banner.ctaLink} onChange={(e) => patchBanner(banner.id, { ctaLink: e.target.value })} />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={banners.length >= MAX_BANNERS}
            onClick={() => {
              setBannerState({ kind: 'idle' });
              setBanners((items) => [...items, { id: newId('banner'), title: '', text: '', ctaLabel: 'Смотреть', ctaCategory: 'all', ctaLink: '', imageUrl: '', active: true }]);
            }}
            className="inline-flex items-center gap-1.5 px-4 min-h-10 rounded-full text-xs font-semibold border border-[#2A2421] text-[#2A2421] hover:bg-[#2A2421] hover:text-white disabled:opacity-40 transition-colors"
          >
            <Plus className="w-4 h-4" /> Добавить баннер
          </button>
          <button type="button" onClick={() => save('banners')} disabled={bannerState.kind === 'saving'} className="inline-flex items-center gap-1.5 px-5 min-h-10 rounded-full text-xs font-semibold bg-[#2A2421] text-white hover:bg-[#3D3531] disabled:opacity-60 transition-colors">
            <Save className="w-4 h-4" /> {bannerState.kind === 'saving' ? 'Сохранение…' : 'Сохранить баннеры'}
          </button>
          <button type="button" onClick={() => reset('banners')} disabled={bannerState.kind === 'saving'} className="inline-flex items-center gap-1.5 px-3 min-h-10 rounded-full text-xs font-medium text-[#6E5C51] hover:bg-[#EAE1D7] transition-colors">
            <RotateCcw className="w-4 h-4" /> Стандартные
          </button>
          <StatusLine state={bannerState} />
        </div>
      </section>

      {/* ---------------- Brands ---------------- */}
      <section className="space-y-4" aria-labelledby="content-brands">
        <div>
          <h2 id="content-brands" className="text-base font-bold text-[#2A2421]">Бренды в бегущей строке</h2>
          <p className="text-xs text-[#8A796F] mt-0.5">
            Название должно совпадать с названием бренда в карточках товаров: по нажатию покупатель увидит товары этого бренда. Логотип необязателен: без него бренд набирается шрифтом.
          </p>
        </div>

        <ul className="space-y-2">
          {brands.map((brand, i) => (
            <li key={brand.id} className="bg-white rounded-2xl border border-[#EAE3DC] p-3 flex flex-col sm:flex-row sm:items-center gap-2 shadow-xs">
              <div className="flex-1 grid sm:grid-cols-2 gap-2">
                <input aria-label={`Название бренда ${i + 1}`} className={inputClass} maxLength={40} placeholder="Название" value={brand.name} onChange={(e) => patchBrand(brand.id, { name: e.target.value })} />
                <input aria-label={`Логотип бренда ${i + 1}`} className={inputClass} inputMode="url" placeholder="Ссылка на логотип (необязательно)" value={brand.logoUrl} onChange={(e) => patchBrand(brand.id, { logoUrl: e.target.value })} />
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button type="button" className={iconButton} aria-label="Выше" disabled={i === 0} onClick={() => { setBrandState({ kind: 'idle' }); setBrands((items) => move(items, i, i - 1)); }}><ArrowUp className="w-4 h-4" /></button>
                <button type="button" className={iconButton} aria-label="Ниже" disabled={i === brands.length - 1} onClick={() => { setBrandState({ kind: 'idle' }); setBrands((items) => move(items, i, i + 1)); }}><ArrowDown className="w-4 h-4" /></button>
                <button type="button" className={`${iconButton} hover:text-rose-700`} aria-label="Удалить бренд" disabled={brands.length === 1} onClick={() => { setBrandState({ kind: 'idle' }); setBrands((items) => items.filter((item) => item.id !== brand.id)); }}><Trash2 className="w-4 h-4" /></button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={brands.length >= MAX_BRANDS}
            onClick={() => { setBrandState({ kind: 'idle' }); setBrands((items) => [...items, { id: newId('brand'), name: '', logoUrl: '' }]); }}
            className="inline-flex items-center gap-1.5 px-4 min-h-10 rounded-full text-xs font-semibold border border-[#2A2421] text-[#2A2421] hover:bg-[#2A2421] hover:text-white disabled:opacity-40 transition-colors"
          >
            <Plus className="w-4 h-4" /> Добавить бренд
          </button>
          <button type="button" onClick={() => save('brands')} disabled={brandState.kind === 'saving'} className="inline-flex items-center gap-1.5 px-5 min-h-10 rounded-full text-xs font-semibold bg-[#2A2421] text-white hover:bg-[#3D3531] disabled:opacity-60 transition-colors">
            <Save className="w-4 h-4" /> {brandState.kind === 'saving' ? 'Сохранение…' : 'Сохранить бренды'}
          </button>
          <button type="button" onClick={() => reset('brands')} disabled={brandState.kind === 'saving'} className="inline-flex items-center gap-1.5 px-3 min-h-10 rounded-full text-xs font-medium text-[#6E5C51] hover:bg-[#EAE1D7] transition-colors">
            <RotateCcw className="w-4 h-4" /> Стандартные
          </button>
          <StatusLine state={brandState} />
        </div>
      </section>
    </div>
  );
};
