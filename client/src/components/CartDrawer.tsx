import { ProductImage } from './ProductImage';
import React from 'react';
import { useShop } from '../context/ShopContext';
import { useI18n } from '../i18n/I18nContext';
import { triggerHaptic } from '../utils/telegram';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, PhoneCall } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    clearCart,
    currency,
    setIsLeadFormOpen
  } = useShop();
  const { t, formatPrice, localizeProduct } = useI18n();

  if (!isCartOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const hasUnavailable = cart.some((item) => !item.product.inStock);

  const handleProceed = () => {
    triggerHaptic('medium');
    setIsCartOpen(false);
    setIsLeadFormOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div
        className="w-full max-w-md bg-[#FAF8F5] h-full flex flex-col shadow-2xl border-l border-[#EAE3DC] animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-white border-b border-[#EAE3DC] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-[#2A2421]" />
            <h2 className="text-base font-bold text-[#2A2421]">{t('cart.title')}</h2>
            <span className="text-xs bg-[#EFE9E2] text-[#6E5C51] font-semibold px-2 py-0.5 rounded-full">
              {totalQuantity}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {cart.length > 0 && (
              <button
                onClick={() => {
                  triggerHaptic('warning');
                  clearCart();
                }}
                className="text-xs text-[#8A796F] hover:text-[#A64B2A] transition-colors p-2.5"
                title={t('cart.clear')}
                aria-label={t('cart.clear')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsCartOpen(false)}
              aria-label={t('cart.close')}
              className="w-10 h-10 rounded-full bg-[#EFE9E2] hover:bg-[#E2D8CE] flex items-center justify-center text-[#4A3E37] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#EFE9E2] flex items-center justify-center text-[#8A796F]">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#2A2421]">{t('cart.emptyTitle')}</h3>
              <p className="text-xs text-[#8A796F] max-w-xs leading-relaxed">
                {t('cart.emptyText')}
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="mt-2 bg-[#2A2421] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[#3D3531] transition-colors"
              >
                {t('common.toCatalog')}
              </button>
            </div>
          ) : (
            cart.map((line) => {
              const item = { ...line, product: localizeProduct(line.product) };
              return (
              <div
                key={item.product.id}
                data-testid="cart-item"
                className="bg-white p-3 rounded-2xl border border-[#EAE3DC] flex items-center space-x-3 shadow-xs"
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F5EFEB] flex-shrink-0 border border-[#EFE9E2]">
                  <ProductImage
                    src={item.product.images[0]}
                    alt={item.product.name}
                    brand={item.product.brand}
                    compact
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A796F]">
                    {item.product.brand}
                  </span>
                  <h4 className="text-xs font-semibold text-[#2A2421] truncate">
                    {item.product.name}
                  </h4>
                  <div className="flex items-center space-x-2 text-[11px] text-[#7A6B62] mt-0.5">
                    <span>{item.product.volume}</span>
                    <span>•</span>
                    <span className="font-semibold text-[#2A2421]">
                      {formatPrice(item.product.price, currency)}
                    </span>
                  </div>
                  {!item.product.inStock && (
                    <span className="text-[10px] font-semibold text-red-600">{t('cart.unavailableInline')}</span>
                  )}
                </div>

                {/* Stepper */}
                <div className="flex flex-col items-end space-y-1.5">
                  <div className="flex items-center bg-[#F5EFEB] rounded-xl p-0.5 border border-[#DFD6CD]">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      aria-label={t('product.decrease')}
                      className="w-9 h-9 shrink-0 rounded-lg bg-white hover:bg-[#EBE3DB] flex items-center justify-center text-[#2A2421] transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-[#2A2421]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      aria-label={t('product.increase')}
                      className="w-9 h-9 shrink-0 rounded-lg bg-white hover:bg-[#EBE3DB] flex items-center justify-center text-[#2A2421] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-[#2A2421]">
                    {formatPrice(item.product.price * item.quantity, currency)}
                  </span>
                  {!item.product.inStock && (
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-[10px] text-red-600 hover:underline"
                    >
                      {t('common.remove')}
                    </button>
                  )}
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Footer & lead action */}
        {cart.length > 0 && (
          <div className="p-4 bg-white border-t border-[#EAE3DC] space-y-3">
            <div className="space-y-1.5 text-xs text-[#6E5C51]">
              <div className="flex justify-between">
                <span>{t('cart.items', { n: totalQuantity })}</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#2A2421] pt-2 border-t border-[#EAE3DC]">
                <span>{t('cart.total')}</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              <p className="text-[11px] text-[#8A796F] leading-relaxed flex items-start space-x-1.5 pt-1">
                <PhoneCall className="w-3.5 h-3.5 text-[#C9A227] shrink-0 mt-0.5" />
                <span>{t('cart.noPayment')}</span>
              </p>
            </div>

            {hasUnavailable && (
              <div role="alert" className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                {t('cart.unavailableAlert')}
              </div>
            )}

            <button
              onClick={handleProceed}
              disabled={hasUnavailable}
              className="w-full bg-[#2A2421] hover:bg-[#3D3531] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 shadow-md hover:shadow-lg active:scale-98 transition-all"
            >
              <span>{t('cart.submit')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
