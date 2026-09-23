import React from 'react';
import { Product } from '../types';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../utils/formatters';
import { Star, Plus, Minus, ShoppingBag, Eye } from 'lucide-react';
import { triggerHaptic } from '../utils/telegram';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { cart, addToCart, updateQuantity, openProductDetail, currency } = useShop();

  const cartItem = cart.find((item) => item.product.id === product.id);
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQuantity(product.id, currentQuantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQuantity(product.id, currentQuantity - 1);
  };

  const handleCardClick = () => {
    openProductDetail(product);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group bg-white rounded-2xl border border-[#EBE4DD] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer hover:border-[#D5C9BE] relative"
    >
      {/* Product Image Area */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#F5EFEB]">
        <img
          src={product.images[0]}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
          {product.isBestseller && (
            <span className="bg-[#2A2421]/90 backdrop-blur-xs text-[#E8DDD4] text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Хит продаж
            </span>
          )}
          {product.isNew && (
            <span className="bg-[#4A6B82]/90 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Новинка
            </span>
          )}
          {product.oldPrice && product.oldPrice > product.price && (
            <span className="bg-[#A64B2A]/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              -{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
            </span>
          )}
        </div>

        {/* Volume badge */}
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
          {product.volume}
        </div>

        {/* Quick view hover icon on desktop */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="bg-white/90 text-[#2A2421] text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm flex items-center space-x-1.5 backdrop-blur-xs">
            <Eye className="w-3.5 h-3.5" />
            <span>Подробнее</span>
          </span>
        </div>
      </div>

      {/* Product Content Details */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <div>
          {/* Brand & Rating */}
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A796F]">
              {product.brand}
            </span>
            <div className="flex items-center space-x-1 text-[#C9A227]">
              <Star className="w-3 h-3 fill-[#C9A227]" />
              <span className="text-[11px] font-semibold text-[#4A3E37]">
                {product.rating}
              </span>
            </div>
          </div>

          {/* Product Title */}
          <h3 className="text-sm font-semibold text-[#2A2421] line-clamp-2 leading-snug group-hover:text-[#6E4F3E] transition-colors mb-1.5">
            {product.name}
          </h3>

          {/* Short description preview */}
          <p className="text-xs text-[#7A6B62] line-clamp-2 mb-3 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Pricing and Add to Cart Area */}
        <div className="pt-2 border-t border-[#F2ECE5]">
          <div className="flex items-baseline space-x-2 mb-2.5">
            <span className="text-base font-bold text-[#2A2421]">
              {formatPrice(product.price, currency)}
            </span>
            {product.oldPrice && (
              <span className="text-xs text-[#A89A90] line-through">
                {formatPrice(product.oldPrice, currency)}
              </span>
            )}
          </div>

          {/* Add to Cart button or stepper */}
          {currentQuantity === 0 ? (
            <button
              onClick={handleAddToCart}
              className="w-full flex items-center justify-center space-x-2 bg-[#F5EFEB] hover:bg-[#2A2421] text-[#2A2421] hover:text-white py-2 px-3 rounded-xl font-medium text-xs transition-all border border-[#DFD6CD] hover:border-[#2A2421] active:scale-95"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>В корзину</span>
            </button>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full flex items-center justify-between bg-[#2A2421] text-white py-1 px-1.5 rounded-xl border border-[#2A2421]"
            >
              <button
                onClick={handleDecrement}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors active:scale-90"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold px-2">
                {currentQuantity} шт
              </span>
              <button
                onClick={handleIncrement}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors active:scale-90"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
