import React from 'react';
import { useShop } from '../context/ShopContext';
import { ShoppingBag, Sparkles, Smartphone, ShieldCheck, User, Truck, Share2, QrCode } from 'lucide-react';
import { Currency } from '../types';

export const Header: React.FC = () => {
  const {
    cart,
    setIsCartOpen,
    currency,
    setCurrency,
    isAdminOpen,
    setIsAdminOpen,
    isTelegramFrame,
    setIsTelegramFrame,
    setIsShareOpen,
    telegramUser
  } = useShop();

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-30 bg-[#F9F7F5]/90 backdrop-blur-md border-b border-[#EAE3DC] transition-all">
      {/* Top micro-bar: Telegram status & quick controls */}
      <div className="bg-[#2A2421] text-[#E8DDD4] text-xs px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-medium tracking-wide">Telegram Mini App Live</span>
          {telegramUser ? (
            <span className="hidden sm:inline-flex items-center text-[#C4B7AB] ml-1">
              • Привет, {telegramUser.first_name || telegramUser.username}!
            </span>
          ) : (
            <span className="hidden sm:inline-flex text-[#C4B7AB] ml-1">
              • Бутик селективной косметики
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* Currency Switcher */}
          <div className="flex items-center bg-[#3D3531] rounded-full p-0.5 border border-[#524843]">
            {(['UZS', 'RUB', 'USD'] as Currency[]).map((curr) => (
              <button
                key={curr}
                onClick={() => setCurrency(curr)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full transition-colors ${
                  currency === curr
                    ? 'bg-[#E8DDD4] text-[#2A2421]'
                    : 'text-[#C4B7AB] hover:text-white'
                }`}
                title={`Переключить валюту на ${curr}`}
              >
                {curr}
              </button>
            ))}
          </div>

          {/* Telegram Device Frame Toggle (Useful for testing) */}
          <button
            onClick={() => setIsTelegramFrame(!isTelegramFrame)}
            className={`hidden md:flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] transition-colors ${
              isTelegramFrame
                ? 'bg-[#4B6B94] text-white'
                : 'bg-[#3D3531] text-[#C4B7AB] hover:text-white'
            }`}
            title="Переключить рамку Telegram Mini App"
          >
            <Smartphone className="w-3 h-3" />
            <span>{isTelegramFrame ? 'Telegram вид' : 'Широкий вид'}</span>
          </button>
        </div>
      </div>

      {/* Free Shipping Announcement Banner */}
      <div className="bg-[#FAF5E8] border-b border-[#E8DCBF] px-3 py-1.5 text-center text-xs font-medium text-[#5C4515] flex items-center justify-center space-x-1.5">
        <Truck className="w-3.5 h-3.5 text-[#C9A227] shrink-0" />
        <span>
          Бесплатная доставка по всему Узбекистану при покупке от <strong className="font-bold text-[#2A2421]">2 000 000 сум</strong>
        </span>
      </div>

      {/* Main navigation header */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAdminOpen(false)}
            className="text-left group focus:outline-none"
          >
            <div className="flex items-center space-x-1.5">
              <span className="font-serif text-2xl font-bold tracking-widest text-[#2A2421] group-hover:text-[#6E4F3E] transition-colors">
                FLANER
              </span>
              <Sparkles className="w-4 h-4 text-[#C9A227] fill-[#C9A227]/30" />
            </div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8A796F] font-medium">
              Cosmetics & Fragrance
            </p>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-2">
          {/* Share / Open on Phone Button */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium border bg-[#FAF5E8] hover:bg-[#F3EBDA] text-[#5C4515] border-[#E8DCBF] transition-all shadow-2xs"
            title="Открыть на телефоне или поделиться ссылкой"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#C9A227]" />
            <span className="hidden sm:inline font-semibold">На телефон</span>
            <QrCode className="w-3 h-3 text-[#7A6B62] hidden md:inline ml-0.5" />
          </button>

          {/* Admin panel toggle button */}
          <button
            onClick={() => setIsAdminOpen(!isAdminOpen)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              isAdminOpen
                ? 'bg-[#2A2421] text-white border-[#2A2421] shadow-sm'
                : 'bg-white/80 text-[#5B4C43] border-[#DFD5CC] hover:bg-[#F3EBE3]'
            }`}
            title="Панель администратора (товары и заказы)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#C9A227]" />
            <span className="hidden sm:inline">
              {isAdminOpen ? 'В магазин' : 'Админ-панель'}
            </span>
            <span className="sm:hidden">
              {isAdminOpen ? 'Магазин' : 'Админ'}
            </span>
          </button>

          {/* Telegram User Avatar / Status */}
          {telegramUser && (
            <div className="hidden sm:flex items-center space-x-1.5 bg-white/70 border border-[#E5DCD3] px-2.5 py-1 rounded-full text-xs text-[#52443C]">
              <div className="w-5 h-5 rounded-full bg-[#E5DCD3] text-[#443831] flex items-center justify-center font-bold text-[10px]">
                {telegramUser.first_name ? telegramUser.first_name[0] : <User className="w-3 h-3" />}
              </div>
              <span className="max-w-[80px] truncate font-medium">
                {telegramUser.first_name || telegramUser.username}
              </span>
            </div>
          )}

          {/* Cart button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center space-x-2 bg-[#2A2421] hover:bg-[#3D3531] text-white px-3.5 py-2 rounded-full shadow-sm hover:shadow transition-all active:scale-95"
            title="Открыть корзину"
          >
            <ShoppingBag className="w-4 h-4 text-[#E8DDD4]" />
            <span className="text-xs font-semibold tracking-wide">Корзина</span>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#C9A227] text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-scale">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
