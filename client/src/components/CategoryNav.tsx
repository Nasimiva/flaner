import React from 'react';
import { useShop } from '../context/ShopContext';
import { CategoryId } from '../types';
import { Sparkles, Smile, Palette, Flame, Award, Tag, Search, X, ArrowUpDown, Gift, Sun, Eye, Brush, Droplet, Heart, Star, PenLine, Package } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';
import { useI18n } from '../i18n/I18nContext';
import { categoryLabel, inCategory } from '../utils/categories';
import { catalogBrands, isSameBrand } from '../utils/brands';

interface CategoryConfig {
  id: CategoryId | 'all';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// The original categories keep their icons; categories added in the admin panel get a generic tag.
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'face-care': Smile,
  makeup: Palette,
  perfume: Flame,
  foundation: Droplet,
  blush: Heart,
  contour: Sun,
  highlighter: Star,
  eyeshadow: Palette,
  'eye-pencil': PenLine,
  mascara: Eye,
  lips: Brush,
  powder: Sparkles,
  other: Package,
  sets: Gift
};

export const CategoryNav: React.FC = () => {
  const {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    selectedBrand,
    setSelectedBrand,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy
  } = useShop();
  const { t, lang } = useI18n();

  // Get count per category
  const getCategoryCount = (id: CategoryId | 'all') => products.filter((p) => inCategory(p, id)).length;

  // Empty categories are not offered as filters (unless one is selected, e.g. from a banner).
  const CATEGORIES: CategoryConfig[] = [
    { id: 'all', label: t('category.all'), icon: Sparkles },
    ...categories.filter((category) => category.id === selectedCategory || getCategoryCount(category.id) > 0).map((category) => ({
      id: category.id,
      label: categoryLabel(category, lang),
      icon: CATEGORY_ICONS[category.id] ?? Tag
    })),
    { id: 'brands', label: t('category.brands'), icon: Award }
  ];

  const handleCategoryClick = (catId: CategoryId | 'all') => {
    triggerHaptic('selection');
    setSelectedCategory(catId);
    if (catId !== 'brands' && selectedBrand !== 'all') {
      setSelectedBrand('all');
    }
  };

  const handleBrandClick = (brand: string) => {
    triggerHaptic('selection');
    if (isSameBrand(selectedBrand, brand)) {
      setSelectedBrand('all');
    } else {
      setSelectedBrand(brand);
    }
  };

  // Brand chips come from the catalog itself, one chip per brand however it is spelled.
  const brandChips = React.useMemo(() => catalogBrands(products), [products]);

  return (
    <div className="space-y-3.5 mb-6">
      {/* Search and Sort row */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A796F]" />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-white/90 border border-[#E0D7CE] rounded-full focus:outline-none focus:border-[#6E4F3E] focus:ring-1 focus:ring-[#6E4F3E] transition-all placeholder:text-[#A89A90] text-[#2A2421]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label={t('search.clear')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A796F] hover:text-[#2A2421] p-2.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center space-x-2 bg-white/90 border border-[#E0D7CE] rounded-full px-3 py-0 min-h-10 text-xs text-[#52443C] self-end sm:self-auto w-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#8A796F]" />
          <span className="text-[#8A796F] hidden xs:inline">{t('sort.label')}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent font-medium focus:outline-none cursor-pointer text-[#2A2421] min-h-10 py-2"
          >
            <option value="popular">{t('sort.popular')}</option>
            <option value="price-asc">{t('sort.priceAsc')}</option>
            <option value="price-desc">{t('sort.priceDesc')}</option>
            <option value="rating">{t('sort.rating')}</option>
          </select>
        </div>
      </div>

      {/* Main Categories Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          const count = getCategoryCount(cat.id);

          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 min-h-10 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-[#2A2421] text-[#F9F7F5] shadow-sm'
                  : 'bg-white/80 text-[#5B4C43] border border-[#E5DDD4] hover:bg-[#F0E8E0] hover:text-[#2A2421]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C9A227]' : 'text-[#8A796F]'}`} />
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[#EDE5DD] text-[#7A6B62]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-bar: Brands selector (visible when 'brands' or as a quick filter) */}
      {(selectedCategory === 'brands' || selectedBrand !== 'all') && (
        <div className="p-3 bg-[#EFE9E2]/70 rounded-2xl border border-[#DFD5CB] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E5C51]">
              {t('brandFilter.title')}
            </span>
            {selectedBrand !== 'all' && (
              <button
                onClick={() => setSelectedBrand('all')}
                className="text-[11px] text-[#A64B2A] hover:underline font-medium"
              >
                {t('brandFilter.reset')}
              </button>
            )}
          </div>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
            {brandChips.map((brand) => {
              const isSelected = isSameBrand(selectedBrand, brand);
              return (
                <button
                  key={brand}
                  onClick={() => handleBrandClick(brand)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    isSelected
                      ? 'bg-[#6E4F3E] text-white shadow-sm'
                      : 'bg-white text-[#4A3E37] border border-[#D8CEC4] hover:border-[#6E4F3E]'
                  }`}
                >
                  {brand}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
