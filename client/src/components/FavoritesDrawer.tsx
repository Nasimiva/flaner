import React from 'react';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../utils/formatters';
import { X, Heart, ShoppingBag, Check } from 'lucide-react';

// The favorites list is only a wish list kept on this device. Nothing here is ever sent with a lead;
// a product reaches the cart only when the shopper presses "В корзину".
export const FavoritesDrawer: React.FC = () => {
  const {
    favorites,
    cart,
    isFavoritesOpen,
    setIsFavoritesOpen,
    toggleFavorite,
    addToCart,
    openProductDetail,
    currency
  } = useShop();

  if (!isFavoritesOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Избранное"
    >
      <div className="w-full max-w-md bg-[#FAF8F5] h-full flex flex-col shadow-2xl border-l border-[#EAE3DC] animate-slide-left">
        <div className="p-4 bg-white border-b border-[#EAE3DC] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-[#A64B2A] fill-[#A64B2A]/20" />
            <h2 className="text-base font-bold text-[#2A2421]">Избранное</h2>
            <span className="text-xs bg-[#EFE9E2] text-[#6E5C51] font-semibold px-2 py-0.5 rounded-full">
              {favorites.length}
            </span>
          </div>
          <button
            onClick={() => setIsFavoritesOpen(false)}
            aria-label="Закрыть избранное"
            className="w-8 h-8 rounded-full bg-[#EFE9E2] hover:bg-[#E2D8CE] flex items-center justify-center text-[#4A3E37] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {favorites.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#EFE9E2] flex items-center justify-center text-[#8A796F]">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#2A2421]">В избранном пока пусто</h3>
              <p className="text-xs text-[#8A796F] max-w-xs leading-relaxed">
                Нажмите на сердечко у товара, чтобы сохранить его здесь. Избранное — это просто список понравившихся
                товаров, в заявку он не попадает.
              </p>
              <button
                onClick={() => setIsFavoritesOpen(false)}
                className="mt-2 bg-[#2A2421] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[#3D3531] transition-colors"
              >
                Перейти в каталог
              </button>
            </div>
          ) : (
            favorites.map((product) => {
              const inCart = cart.some((line) => line.product.id === product.id);
              return (
                <div
                  key={product.id}
                  data-testid="favorite-item"
                  className="bg-white p-3 rounded-2xl border border-[#EAE3DC] flex items-center space-x-3 shadow-xs"
                >
                  <button
                    onClick={() => {
                      setIsFavoritesOpen(false);
                      openProductDetail(product);
                    }}
                    className="w-16 h-16 rounded-xl overflow-hidden bg-[#F5EFEB] flex-shrink-0 border border-[#EFE9E2]"
                    aria-label={`Открыть ${product.name}`}
                  >
                    <img src={product.images[0]} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A796F]">{product.brand}</span>
                    <h4 className="text-xs font-semibold text-[#2A2421] truncate">{product.name}</h4>
                    <div className="flex items-center space-x-2 text-[11px] text-[#7A6B62] mt-0.5">
                      <span>{product.volume}</span>
                      <span>•</span>
                      <span className="font-semibold text-[#2A2421]">{formatPrice(product.price, currency)}</span>
                    </div>
                    {!product.inStock && <span className="text-[10px] font-semibold text-red-600">Нет в наличии</span>}
                  </div>

                  <div className="flex flex-col items-end space-y-1.5">
                    <button
                      onClick={() => toggleFavorite(product.id)}
                      aria-label={`Убрать ${product.name} из избранного`}
                      title="Убрать из избранного"
                      className="w-7 h-7 rounded-full bg-[#FBEFEA] hover:bg-[#F5DCD2] flex items-center justify-center text-[#A64B2A] transition-colors"
                    >
                      <Heart className="w-3.5 h-3.5 fill-[#A64B2A]" />
                    </button>
                    {inCart ? (
                      <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-700">
                        <Check className="w-3.5 h-3.5" />
                        <span>В корзине</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => addToCart(product, 1)}
                        disabled={!product.inStock}
                        className="flex items-center space-x-1 bg-[#F5EFEB] hover:bg-[#2A2421] hover:text-white disabled:opacity-50 disabled:hover:bg-[#F5EFEB] disabled:hover:text-[#2A2421] text-[#2A2421] text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-[#DFD6CD] transition-all"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>В корзину</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
