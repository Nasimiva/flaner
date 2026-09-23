import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegram';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Tag, Truck } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    clearCart,
    currency,
    setIsCheckoutOpen
  } = useShop();

  const [promoInput, setPromoInput] = useState('');
  const [promoDiscountRate, setPromoDiscountRate] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [appliedCode, setAppliedCode] = useState('');

  if (!isCartOpen) return null;

  const FREE_SHIPPING_THRESHOLD = 2000000; // in UZS (2 000 000 сум)
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discount = Math.round(subtotal * promoDiscountRate);
  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : 35000;
  const total = Math.max(0, subtotal - discount + deliveryFee);
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    if (code === 'BEAUTY10') {
      setPromoDiscountRate(0.1);
      setAppliedCode('BEAUTY10 (-10%)');
      setPromoError('');
      triggerHaptic('success');
    } else if (code === 'TELEGRAM') {
      setPromoDiscountRate(0.15);
      setAppliedCode('TELEGRAM (-15%)');
      setPromoError('');
      triggerHaptic('success');
    } else {
      setPromoError('Неверный промокод. Попробуйте BEAUTY10 или TELEGRAM');
      triggerHaptic('error');
    }
  };

  const handleProceedToCheckout = () => {
    triggerHaptic('medium');
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
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
            <h2 className="text-base font-bold text-[#2A2421]">Ваша корзина</h2>
            <span className="text-xs bg-[#EFE9E2] text-[#6E5C51] font-semibold px-2 py-0.5 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {cart.length > 0 && (
              <button
                onClick={() => {
                  triggerHaptic('warning');
                  clearCart();
                }}
                className="text-xs text-[#8A796F] hover:text-[#A64B2A] transition-colors p-1"
                title="Очистить корзину"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsCartOpen(false)}
              className="w-8 h-8 rounded-full bg-[#EFE9E2] hover:bg-[#E2D8CE] flex items-center justify-center text-[#4A3E37] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Free delivery progress bar */}
        {cart.length > 0 && (
          <div className="px-4 py-2.5 bg-[#F3ECE5] border-b border-[#E5DDD4] text-xs">
            <div className="flex items-center justify-between text-[#52443C] mb-1.5 font-medium">
              <span className="flex items-center space-x-1.5">
                <Truck className="w-3.5 h-3.5 text-[#6E4F3E]" />
                <span>
                  {amountToFreeShipping === 0
                    ? '🎉 Бесплатная доставка активна (от 2 000 000 сум)!'
                    : `До бесплатной доставки: ${formatPrice(amountToFreeShipping, currency)}`}
                </span>
              </span>
              <span>{freeShippingProgress}%</span>
            </div>
            <div className="w-full bg-[#DFD6CD] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2A2421] h-full rounded-full transition-all duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              ></div>
            </div>
            {amountToFreeShipping > 0 && (
              <span className="block text-[10px] text-[#8A796F] mt-1">
                Бесплатная доставка при заказе от 2 000 000 сум
              </span>
            )}
          </div>
        )}

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#EFE9E2] flex items-center justify-center text-[#8A796F]">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#2A2421]">Корзина пуста</h3>
              <p className="text-xs text-[#8A796F] max-w-xs leading-relaxed">
                Добавьте премиальную косметику или селективную парфюмерию из каталога, чтобы сделать заказ.
              </p>
              <div className="inline-flex items-center space-x-1 text-[11px] text-[#5C4515] bg-[#FAF5E8] border border-[#E8DCBF] px-3 py-1 rounded-full">
                <Truck className="w-3 h-3 text-[#C9A227]" />
                <span>Бесплатная доставка при покупке от 2 000 000 сум</span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="mt-2 bg-[#2A2421] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[#3D3531] transition-colors"
              >
                Перейти в каталог
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="bg-white p-3 rounded-2xl border border-[#EAE3DC] flex items-center space-x-3 shadow-xs"
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F5EFEB] flex-shrink-0 border border-[#EFE9E2]">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    referrerPolicy="no-referrer"
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
                </div>

                {/* Stepper */}
                <div className="flex flex-col items-end space-y-1.5">
                  <div className="flex items-center bg-[#F5EFEB] rounded-xl p-0.5 border border-[#DFD6CD]">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg bg-white hover:bg-[#EBE3DB] flex items-center justify-center text-[#2A2421] transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-[#2A2421]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-white hover:bg-[#EBE3DB] flex items-center justify-center text-[#2A2421] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-[#2A2421]">
                    {formatPrice(item.product.price * item.quantity, currency)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer & Checkout Area */}
        {cart.length > 0 && (
          <div className="p-4 bg-white border-t border-[#EAE3DC] space-y-3">
            {/* Promo Code Form */}
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A796F]" />
                <input
                  type="text"
                  placeholder="Промокод (BEAUTY10, TELEGRAM)"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421] uppercase text-[#2A2421]"
                />
              </div>
              <button
                type="submit"
                className="bg-[#EFE9E2] hover:bg-[#E2D8CE] text-[#4A3E37] text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
              >
                Применить
              </button>
            </form>

            {appliedCode && (
              <div className="text-[11px] text-emerald-600 font-medium flex items-center justify-between bg-emerald-50 px-2.5 py-1 rounded-lg">
                <span>Промокод применен: {appliedCode}</span>
                <button
                  onClick={() => {
                    setAppliedCode('');
                    setPromoDiscountRate(0);
                  }}
                  className="text-xs text-emerald-700 hover:underline"
                >
                  ✕
                </button>
              </div>
            )}

            {promoError && (
              <div className="text-[11px] text-red-600 font-medium">
                {promoError}
              </div>
            )}

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs text-[#6E5C51] pt-1 border-t border-[#F2ECE5]">
              <div className="flex justify-between">
                <span>Товары ({cart.reduce((s, i) => s + i.quantity, 0)} шт)</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Скидка по промокоду</span>
                  <span>-{formatPrice(discount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Доставка</span>
                <span className={deliveryFee === 0 && subtotal > 0 ? 'text-emerald-700 font-bold' : ''}>
                  {deliveryFee === 0 && subtotal > 0
                    ? 'Бесплатно (от 2 млн сум)'
                    : deliveryFee === 0
                    ? 'Бесплатно'
                    : formatPrice(deliveryFee, currency)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#2A2421] pt-2 border-t border-[#EAE3DC]">
                <span>Итого к оплате:</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={handleProceedToCheckout}
              className="w-full bg-[#2A2421] hover:bg-[#3D3531] text-white py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 shadow-md hover:shadow-lg active:scale-98 transition-all"
            >
              <span>Оформить заказ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
