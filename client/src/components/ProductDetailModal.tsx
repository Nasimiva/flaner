import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegram';
import { X, Star, ShoppingBag, Plus, Minus, Check, Shield, Sparkles, Droplets, Info, Truck } from 'lucide-react';

export const ProductDetailModal: React.FC = () => {
  const {
    selectedProductForDetail,
    closeProductDetail,
    addToCart,
    cart,
    currency
  } = useShop();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'desc' | 'composition' | 'usage'>('desc');
  const [quantity, setQuantity] = useState(1);

  if (!selectedProductForDetail) return null;

  const product = selectedProductForDetail;
  const inCartItem = cart.find((item) => item.product.id === product.id);
  const alreadyInCartCount = inCartItem ? inCartItem.quantity : 0;

  const handleAdd = () => {
    triggerHaptic('medium');
    addToCart(product, quantity);
    closeProductDetail();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div
        className="w-full max-w-lg bg-[#FAF8F5] rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#EBE4DD] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with drag indicator on mobile and close button */}
        <div className="relative pt-3 pb-2 px-4 flex items-center justify-between border-b border-[#EAE3DC] bg-white/70">
          <div className="w-12 h-1 bg-[#D8CEC4] rounded-full mx-auto sm:hidden absolute left-1/2 -translate-x-1/2 top-2"></div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-widest font-bold text-[#8A796F]">
              {product.brand}
            </span>
            <span className="text-[10px] bg-[#EBE3DB] text-[#5A4D44] px-2 py-0.5 rounded-full font-medium">
              {product.volume}
            </span>
          </div>
          <button
            onClick={closeProductDetail}
            className="w-8 h-8 rounded-full bg-[#EFE9E2] hover:bg-[#E2D8CE] flex items-center justify-center text-[#4A3E37] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
          {/* Main Photo Gallery */}
          <div className="space-y-3">
            <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-[#F2ECE5] border border-[#E8DFD6]">
              <img
                src={product.images[activeImageIndex] || product.images[0]}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center transition-all duration-300"
              />

              {product.oldPrice && product.oldPrice > product.price && (
                <div className="absolute top-3 left-3 bg-[#A64B2A] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                  Скидка -{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
                </div>
              )}

              {/* Status pill */}
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs text-[#2A2421] text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#DFD6CD] flex items-center space-x-1">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>В наличии ({product.stockCount} шт)</span>
              </div>
            </div>

            {/* Thumbnails if multiple images */}
            {product.images.length > 1 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      triggerHaptic('selection');
                      setActiveImageIndex(idx);
                    }}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      activeImageIndex === idx
                        ? 'border-[#2A2421] ring-1 ring-[#2A2421]'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title and Rating */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#8A796F]">
                {product.category === 'face-care'
                  ? 'Уход за лицом'
                  : product.category === 'makeup'
                  ? 'Декоративная косметика'
                  : 'Парфюмерия'}
              </span>
              <div className="flex items-center space-x-1 bg-[#F5EFEB] px-2 py-0.5 rounded-full text-xs">
                <Star className="w-3.5 h-3.5 fill-[#C9A227] text-[#C9A227]" />
                <span className="font-bold text-[#2A2421]">{product.rating}</span>
                <span className="text-[#8A796F]">({product.reviewsCount} отзывов)</span>
              </div>
            </div>

            <h2 className="text-xl font-bold text-[#2A2421] leading-snug">
              {product.name}
            </h2>

            {/* Price display */}
            <div className="flex items-baseline space-x-3 mt-2.5">
              <span className="text-2xl font-bold text-[#2A2421]">
                {formatPrice(product.price, currency)}
              </span>
              {product.oldPrice && (
                <span className="text-sm text-[#A89A90] line-through">
                  {formatPrice(product.oldPrice, currency)}
                </span>
              )}
            </div>

            {product.skinType && (
              <div className="mt-2 text-xs text-[#6E5C51] bg-[#EFE9E2] px-3 py-1.5 rounded-xl inline-flex items-center space-x-1.5 mr-2">
                <Droplets className="w-3.5 h-3.5 text-[#6E4F3E]" />
                <span>{product.skinType}</span>
              </div>
            )}

            {/* Free shipping perk badge */}
            <div className="mt-2 text-xs text-[#5C4515] bg-[#FAF5E8] border border-[#E8DCBF] px-3 py-1.5 rounded-xl inline-flex items-center space-x-1.5">
              <Truck className="w-3.5 h-3.5 text-[#C9A227] shrink-0" />
              <span>Бесплатная доставка от <strong className="font-bold text-[#2A2421]">2 000 000 сум</strong></span>
            </div>
          </div>

          {/* Tabs Navigation: Описание, Состав, Применение */}
          <div>
            <div className="flex border-b border-[#E2D8CE] text-xs font-semibold">
              <button
                onClick={() => setActiveTab('desc')}
                className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'desc'
                    ? 'border-[#2A2421] text-[#2A2421]'
                    : 'border-transparent text-[#8A796F] hover:text-[#2A2421]'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Описание</span>
              </button>
              <button
                onClick={() => setActiveTab('composition')}
                className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'composition'
                    ? 'border-[#2A2421] text-[#2A2421]'
                    : 'border-transparent text-[#8A796F] hover:text-[#2A2421]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Состав (INCI)</span>
              </button>
              {product.howToUse && (
                <button
                  onClick={() => setActiveTab('usage')}
                  className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
                    activeTab === 'usage'
                      ? 'border-[#2A2421] text-[#2A2421]'
                      : 'border-transparent text-[#8A796F] hover:text-[#2A2421]'
                  }`}
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>Применение</span>
                </button>
              )}
            </div>

            {/* Tab content */}
            <div className="pt-3.5">
              {activeTab === 'desc' && (
                <p className="text-sm text-[#4A3E37] leading-relaxed">
                  {product.description}
                </p>
              )}

              {activeTab === 'composition' && (
                <div className="space-y-2">
                  <div className="p-3 bg-white rounded-xl border border-[#E5DDD4] text-xs text-[#52443C] leading-relaxed font-mono">
                    {product.composition}
                  </div>
                  <p className="text-[11px] text-[#8A796F] flex items-center space-x-1">
                    <Shield className="w-3 h-3 text-emerald-600" />
                    <span>Оригинальная сертифицированная продукция с маркировкой</span>
                  </p>
                </div>
              )}

              {activeTab === 'usage' && (
                <p className="text-sm text-[#4A3E37] leading-relaxed p-3 bg-white rounded-xl border border-[#E5DDD4]">
                  {product.howToUse}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar (Telegram Web App friendly) */}
        <div className="p-4 bg-white border-t border-[#EAE3DC] flex items-center space-x-3">
          {/* Quantity Selector */}
          <div className="flex items-center bg-[#F3ECE5] rounded-2xl p-1 border border-[#DFD6CD]">
            <button
              onClick={() => {
                triggerHaptic('selection');
                setQuantity(Math.max(1, quantity - 1));
              }}
              className="w-8 h-8 rounded-xl bg-white hover:bg-[#EBE3DB] flex items-center justify-center text-[#2A2421] transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-[#2A2421]">
              {quantity}
            </span>
            <button
              onClick={() => {
                triggerHaptic('selection');
                setQuantity(quantity + 1);
              }}
              className="w-8 h-8 rounded-xl bg-white hover:bg-[#EBE3DB] flex items-center justify-center text-[#2A2421] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Cart button */}
          <button
            onClick={handleAdd}
            className="flex-1 bg-[#2A2421] hover:bg-[#3D3531] text-white py-3.5 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center space-x-2 shadow-md hover:shadow-lg active:scale-98 transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-[#E8DDD4]" />
            <span>
              В корзину • {formatPrice(product.price * quantity, currency)}
            </span>
          </button>
        </div>

        {alreadyInCartCount > 0 && (
          <div className="bg-[#EFE9E2] text-[#6E5C51] text-[11px] py-1 text-center font-medium">
            Уже в корзине: {alreadyInCartCount} шт
          </div>
        )}
      </div>
    </div>
  );
};
