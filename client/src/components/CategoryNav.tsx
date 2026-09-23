import React from 'react';
import { useShop } from '../context/ShopContext';
import { CategoryId } from '../types';
import { POPULAR_BRANDS } from '../data/initialProducts';
import { Sparkles, Smile, Palette, Flame, Award, Search, X, ArrowUpDown } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';

interface CategoryConfig {
  id: CategoryId | 'all';
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'all', name: 'Все товары', icon: Sparkles },
  { id: 'face-care', name: 'Уход за лицом', icon: Smile },
  { id: 'makeup', name: 'Декоративная косметика', icon: Palette },
  { id: 'perfume', name: 'Парфюмерия', icon: Flame },
  { id: 'brands', name: 'Бренды', icon: Award }
];

export const CategoryNav: React.FC = () => {
  const {
    products,
    selectedCategory,
    setSelectedCategory,
    selectedBrand,
    setSelectedBrand,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy
  } = useShop();

  const handleCategoryClick = (catId: CategoryId | 'all') => {
    triggerHaptic('selection');
    setSelectedCategory(catId);
    if (catId !== 'brands' && selectedBrand !== 'all') {
      setSelectedBrand('all');
    }
  };

  const handleBrandClick = (brand: string) => {
    triggerHaptic('selection');
    if (selectedBrand === brand) {
      setSelectedBrand('all');
    } else {
      setSelectedBrand(brand);
    }
  };

  // Get count per category
  const getCategoryCount = (id: CategoryId | 'all') => {
    if (id === 'all') return products.length;
    if (id === 'brands') return products.length;
    return products.filter((p) => p.category === id).length;
  };

  return (
    <div className="space-y-3.5 mb-6">
      {/* Search and Sort row */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A796F]" />
          <input
            type="text"
            placeholder="Поиск косметики, парфюма или бренда..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-white/90 border border-[#E0D7CE] rounded-full focus:outline-none focus:border-[#6E4F3E] focus:ring-1 focus:ring-[#6E4F3E] transition-all placeholder:text-[#A89A90] text-[#2A2421]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A796F] hover:text-[#2A2421] p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center space-x-2 bg-white/90 border border-[#E0D7CE] rounded-full px-3 py-2 text-xs text-[#52443C] self-end sm:self-auto w-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#8A796F]" />
          <span className="text-[#8A796F] hidden xs:inline">Сортировка:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent font-medium focus:outline-none cursor-pointer text-[#2A2421]"
          >
            <option value="popular">По популярности</option>
            <option value="price-asc">Сначала дешевле</option>
            <option value="price-desc">Сначала дороже</option>
            <option value="rating">Высокий рейтинг</option>
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
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-[#2A2421] text-[#F9F7F5] shadow-sm'
                  : 'bg-white/80 text-[#5B4C43] border border-[#E5DDD4] hover:bg-[#F0E8E0] hover:text-[#2A2421]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C9A227]' : 'text-[#8A796F]'}`} />
              <span>{cat.name}</span>
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
              Выберите бренд:
            </span>
            {selectedBrand !== 'all' && (
              <button
                onClick={() => setSelectedBrand('all')}
                className="text-[11px] text-[#A64B2A] hover:underline font-medium"
              >
                Сбросить фильтр бренда
              </button>
            )}
          </div>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
            {POPULAR_BRANDS.map((brand) => {
              const isSelected = selectedBrand === brand;
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
