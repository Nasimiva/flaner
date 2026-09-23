import React from 'react';
import { ShopProvider, useShop } from './context/ShopContext';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { AdminAccess } from './components/AdminAccess';
import { TelegramFrame } from './components/TelegramFrame';
import { ShareModal } from './components/ShareModal';
import { formatPrice } from './utils/formatters';
import {
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Truck,
  CreditCard,
  Heart,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

const ShopContent: React.FC = () => {
  const {
    products,
    selectedCategory,
    selectedBrand,
    searchQuery,
    sortBy,
    cart,
    setIsCartOpen,
    isAdminOpen,
    currency,
    isShareOpen,
    setIsShareOpen,
    toast
  } = useShop();

  if (isAdminOpen) {
    return <AdminAccess />;
  }

  // Filter products
  const filteredProducts = products.filter((product) => {
    // Category filter
    if (selectedCategory !== 'all' && selectedCategory !== 'brands') {
      if (product.category !== selectedCategory) return false;
    }

    // Brand filter
    if (selectedBrand !== 'all') {
      if (product.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = product.name.toLowerCase().includes(q);
      const matchBrand = product.brand.toLowerCase().includes(q);
      const matchDesc = product.description.toLowerCase().includes(q);
      const matchComposition = product.composition.toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchDesc && !matchComposition) return false;
    }

    return true;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'rating') return b.rating - a.rating;
    // Default popular: bestsellers first then reviews
    const aScore = (a.isBestseller ? 1000 : 0) + a.reviewsCount;
    const bScore = (b.isBestseller ? 1000 : 0) + b.reviewsCount;
    return bScore - aScore;
  });

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <TelegramFrame>
      <div className="min-h-screen bg-[#F9F7F5] flex flex-col justify-between selection:bg-[#E8DDD4]">
        <div>
          {/* Header */}
          <Header />

          {/* Main Container */}
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-6">
            {/* Elegant Boutique Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#2A2421] via-[#382F2B] to-[#2A2421] text-white p-5 sm:p-7 shadow-sm border border-[#443831]">
              <div className="absolute right-0 top-0 w-64 h-64 bg-[#C9A227]/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 max-w-xl space-y-2.5">
                <div className="inline-flex items-center space-x-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-medium text-[#E8DDD4]">
                  <Sparkles className="w-3 h-3 text-[#C9A227]" />
                  <span>Официальный бутик в Telegram</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                  Селективная косметика & нишевая парфюмерия
                </h1>

                <p className="text-xs sm:text-sm text-[#D3C7BD] leading-relaxed">
                  Оригинальная продукция ведущих мировых домов красоты с моментальной оплатой через Telegram Payments, Payme, Click и Stripe.
                </p>

                {/* Highlights bar */}
                <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-[#E8DDD4]">
                  <span className="flex items-center space-x-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-[#C9A227]" />
                    <span>100% Оригинал</span>
                  </span>
                  <span className="flex items-center space-x-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                    <Truck className="w-3 h-3 text-[#C9A227]" />
                    <span>Бесплатная доставка от 2 000 000 сум</span>
                  </span>
                  <span className="flex items-center space-x-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                    <CreditCard className="w-3 h-3 text-[#C9A227]" />
                    <span>Payme / Click / Telegram</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Category Navigation & Search */}
            <CategoryNav />

            {/* Product Catalog Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#2A2421]">
                    {selectedCategory === 'face-care'
                      ? 'Уход за лицом'
                      : selectedCategory === 'makeup'
                      ? 'Декоративная косметика'
                      : selectedCategory === 'perfume'
                      ? 'Парфюмерия'
                      : selectedCategory === 'brands'
                      ? selectedBrand !== 'all' ? `Бренд: ${selectedBrand}` : 'Все бренды'
                      : 'Каталог продукции'}
                  </h2>
                  <p className="text-xs text-[#8A796F]">
                    Найдено: {sortedProducts.length} позиций
                  </p>
                </div>
              </div>

              {/* Products Grid */}
              {sortedProducts.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-[#EAE3DC] space-y-3 shadow-xs">
                  <div className="w-16 h-16 rounded-full bg-[#FAF8F5] flex items-center justify-center mx-auto text-[#8A796F]">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-[#2A2421]">
                    Товары не найдены
                  </h3>
                  <p className="text-xs text-[#8A796F] max-w-sm mx-auto">
                    К сожалению, по вашему запросу ничего не нашлось. Попробуйте сбросить фильтры или ввести другое название.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {sortedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>

        {/* Boutique Footer */}
        <footer className="mt-12 bg-white border-t border-[#EAE3DC] py-8 px-4 text-xs text-[#6E5C51]">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="font-serif text-lg font-bold tracking-widest text-[#2A2421] block">
                  FLANER COSMETICS
                </span>
                <span className="text-[11px] text-[#8A796F]">
                  Бутик селективной косметики и нишевой парфюмерии в Telegram (@flaneruz_bot)
                </span>
              </div>

              {/* Supported Payment Badges */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="px-2.5 py-1 rounded-md bg-[#2B5278]/10 text-[#2B5278] font-bold text-[10px]">
                  Telegram Payments
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#19C5B2]/10 text-[#0E7A6E] font-bold text-[10px]">
                  Payme
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#0089D0]/10 text-[#006BB3] font-bold text-[10px]">
                  Click
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#635BFF]/10 text-[#4B45C6] font-bold text-[10px]">
                  Stripe
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F2ECE5] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#A89A90]">
              <span>© {new Date().getFullYear()} flaner_cosmetics (@flaneruz_bot). Все права защищены.</span>
              <div className="flex space-x-4">
                <span>Узбекистан, г. Ташкент</span>
                <span>•</span>
                <span>Бот магазина: @flaneruz_bot</span>
              </div>
            </div>
          </div>
        </footer>

        {/* Floating Telegram MainButton / Cart Bar */}
        {cartItemsCount > 0 && (
          <div className="sticky bottom-3 z-30 px-4 max-w-lg mx-auto w-full animate-slide-up">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-[#2A2421] hover:bg-[#3D3531] text-white py-3.5 px-4 rounded-2xl shadow-xl flex items-center justify-between font-bold text-xs sm:text-sm active:scale-98 transition-all border border-white/10"
            >
              <div className="flex items-center space-x-2">
                <span className="bg-[#C9A227] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {cartItemsCount}
                </span>
                <span>Корзина</span>
              </div>

              <div className="flex items-center space-x-2">
                <span>{formatPrice(cartSubtotal, currency)}</span>
                <ArrowRight className="w-4 h-4 text-[#C9A227]" />
              </div>
            </button>
          </div>
        )}

        {/* Modals */}
        <ProductDetailModal />
        <CartDrawer />
        <CheckoutModal />
        <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />

        {/* Global Toast Notification */}
        {toast && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
            <div
              className={`px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center space-x-2 border ${
                toast.type === 'error'
                  ? 'bg-rose-900 text-white border-rose-700'
                  : toast.type === 'info'
                  ? 'bg-[#2A2421] text-white border-[#443831]'
                  : 'bg-[#2A2421] text-white border-[#C9A227]/40'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-300" />
              ) : (
                <CheckCircle className="w-4 h-4 text-[#C9A227]" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </TelegramFrame>
  );
};

export default function App() {
  return (
    <ShopProvider>
      <ShopContent />
    </ShopProvider>
  );
}
