import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Product, CartItem, Order, OrderStatus, CategoryId, Currency, TelegramWebAppUser } from '../types';
import { getTelegramUser, initTelegramApp, triggerHaptic } from '../utils/telegram';
import {
  CartLine,
  MAX_ITEMS_PER_LEAD,
  MAX_QUANTITY_PER_ITEM,
  cartSignature,
  parseStoredCart,
  parseStoredFavorites,
  upsertLine
} from '../utils/cartStorage';
import { LeadFormValues, LeadReceipt, LeadSubmitError, createIdempotencyKey, postLead } from '../utils/leadApi';
import { normalizeUzPhone } from '../utils/phone';

interface ShopContextType {
  products: Product[];
  /** Cart lines joined with the live catalog (names, images and prices are never stored). */
  cart: CartItem[];
  favorites: Product[];
  favoriteIds: string[];
  selectedCategory: CategoryId | 'all';
  selectedBrand: string | 'all';
  searchQuery: string;
  sortBy: 'popular' | 'price-asc' | 'price-desc' | 'rating';
  currency: Currency;
  orders: Order[];
  selectedProductForDetail: Product | null;
  isCartOpen: boolean;
  isLeadFormOpen: boolean;
  isFavoritesOpen: boolean;
  isAdminOpen: boolean;
  isTelegramFrame: boolean;
  isShareOpen: boolean;
  telegramUser: TelegramWebAppUser | null;
  toast: { message: string; type: 'success' | 'info' | 'error' } | null;

  // Actions
  setSelectedCategory: (cat: CategoryId | 'all') => void;
  setSelectedBrand: (brand: string | 'all') => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: 'popular' | 'price-asc' | 'price-desc' | 'rating') => void;
  setCurrency: (curr: Currency) => void;
  setIsCartOpen: (open: boolean) => void;
  setIsLeadFormOpen: (open: boolean) => void;
  setIsFavoritesOpen: (open: boolean) => void;
  setIsAdminOpen: (open: boolean) => void;
  setIsTelegramFrame: (frame: boolean) => void;
  setIsShareOpen: (open: boolean) => void;

  openProductDetail: (product: Product) => void;
  closeProductDetail: () => void;

  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;

  toggleFavorite: (productId: string) => void;
  /** Sends the cart as a lead. Clears the cart only after the server accepted it; throws LeadSubmitError otherwise. */
  submitLead: (values: LeadFormValues) => Promise<LeadReceipt>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  refreshOrders: () => Promise<void>;

  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductStock: (id: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  resetDemoData: () => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Local storage initialization
  const [products, setProducts] = useState<Product[]>([]);

  // The cart is stored as { productId, quantity } only. Names, images and prices come from the live catalog.
  const [cartLines, setCartLines] = useState<CartLine[]>(() => {
    try {
      return parseStoredCart(localStorage.getItem('flaner_cart') || localStorage.getItem('lumiere_cart'));
    } catch {
      return [];
    }
  });

  // Favorites are a separate, device-local list of product ids. They never feed into a lead.
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      return parseStoredFavorites(localStorage.getItem('flaner_favorites'));
    } catch {
      return [];
    }
  });
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [selectedBrand, setSelectedBrand] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'rating'>('popular');
  const [currency, setCurrency] = useState<Currency>('UZS');

  // Only the id is kept: the product itself is looked up in the live catalog, so an open card never shows stale data.
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isTelegramFrame, setIsTelegramFrame] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const [telegramUser, setTelegramUser] = useState<TelegramWebAppUser | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Initialize Telegram
  useEffect(() => {
    initTelegramApp();
    const user = getTelegramUser();
    if (user) {
      setTelegramUser(user);
    }
  }, []);

  // The catalog is always loaded from the shared server database.
  const catalogRequest = useRef<Promise<void> | null>(null);

  // `silent` refreshes (focus, timer, opening the cart) never toast: they keep the last good catalog on failure.
  const loadCatalog = (options: { silent?: boolean } = {}): Promise<void> => {
    // Parallel triggers (focus + visibility + timer) share one request.
    if (catalogRequest.current) return catalogRequest.current;
    const request = (async () => {
      try {
        const response = await fetch('/api/products', { cache: 'no-store' });
        if (!response.ok) throw new Error('Не удалось загрузить каталог с сервера.');
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Сервер вернул некорректный каталог товаров.');
        setProducts(data as Product[]);
        setCatalogLoaded(true);
      } catch (error: unknown) {
        console.error('Could not load product catalog:', error);
        if (!options.silent) showToast(error instanceof Error ? error.message : 'Не удалось загрузить каталог.', 'error');
      } finally {
        catalogRequest.current = null;
      }
    })();
    catalogRequest.current = request;
    return request;
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  // Keep prices and stock current while the page stays open: refetch when the shopper returns to the tab and every
  // minute while it is visible, so the site and the Telegram Mini App show the same catalog as the admin edits it.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadCatalog({ silent: true });
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);

  // The prices in the cart and in the lead form must be the ones the backend will use.
  useEffect(() => {
    if (isCartOpen || isLeadFormOpen) void loadCatalog({ silent: true });
  }, [isCartOpen, isLeadFormOpen]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const selectedProductForDetail: Product | null = selectedProductId ? productById.get(selectedProductId) ?? null : null;

  // Live view of the cart: each stored line joined with the current catalog entry.
  const cart: CartItem[] = useMemo(
    () => cartLines.flatMap((line) => {
      const product = productById.get(line.productId);
      return product ? [{ product, quantity: line.quantity }] : [];
    }),
    [cartLines, productById]
  );

  const favorites: Product[] = useMemo(
    () => favoriteIds.flatMap((id) => {
      const product = productById.get(id);
      return product ? [product] : [];
    }),
    [favoriteIds, productById]
  );

  // Once the real catalog is known, forget products that no longer exist (never before: an empty
  // catalog while loading must not wipe the shopper's saved cart).
  useEffect(() => {
    if (!catalogLoaded) return;
    const known = new Set(products.map((product) => product.id));
    const keptLines = cartLines.filter((line) => known.has(line.productId));
    if (keptLines.length !== cartLines.length) {
      setCartLines(keptLines);
      showToast('Некоторые товары больше недоступны и убраны из корзины', 'info');
    }
    const keptFavorites = favoriteIds.filter((id) => known.has(id));
    if (keptFavorites.length !== favoriteIds.length) setFavoriteIds(keptFavorites);
  }, [catalogLoaded, products]);

  useEffect(() => {
    try {
      localStorage.setItem('flaner_cart', JSON.stringify(cartLines));
    } catch (e) {
      console.error(e);
    }
  }, [cartLines]);

  useEffect(() => {
    try {
      localStorage.setItem('flaner_favorites', JSON.stringify(favoriteIds));
    } catch (e) {
      console.error(e);
    }
  }, [favoriteIds]);

  const refreshOrders = async () => {
    const response = await fetch('/api/orders');
    const result = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(result)) throw new Error('Failed to load orders from the server.');
    setOrders(result as Order[]);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const openProductDetail = (product: Product) => {
    triggerHaptic('light');
    setSelectedProductId(product.id);
  };

  const closeProductDetail = () => {
    setSelectedProductId(null);
  };

  const addToCart = (product: Product, quantity = 1) => {
    if (!product.inStock) {
      showToast(`«${product.name}» сейчас нет в наличии`, 'error');
      return;
    }
    const existing = cartLines.find((line) => line.productId === product.id);
    if (!existing && cartLines.length >= MAX_ITEMS_PER_LEAD) {
      showToast(`В заявке может быть не больше ${MAX_ITEMS_PER_LEAD} разных товаров`, 'error');
      return;
    }
    const nextQuantity = Math.min(MAX_QUANTITY_PER_ITEM, (existing?.quantity ?? 0) + quantity);
    if (existing && nextQuantity === existing.quantity) {
      showToast(`Максимум ${MAX_QUANTITY_PER_ITEM} шт. одного товара`, 'info');
      return;
    }
    triggerHaptic('medium');
    setCartLines((prev) => upsertLine(prev, product.id, nextQuantity));
    showToast(`«${product.name}» добавлен в корзину`);
  };

  const removeFromCart = (productId: string) => {
    triggerHaptic('light');
    setCartLines((prev) => prev.filter((line) => line.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    triggerHaptic('selection');
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      showToast(`Максимум ${MAX_QUANTITY_PER_ITEM} шт. одного товара`, 'info');
      return;
    }
    setCartLines((prev) => upsertLine(prev, productId, quantity));
  };

  const clearCart = () => {
    setCartLines([]);
  };

  const toggleFavorite = (productId: string) => {
    triggerHaptic('light');
    setFavoriteIds((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  };

  // One idempotency key per distinct submission (phone + cart). A retry after a timeout or a server error
  // reuses it, so the server can recognise it and never creates a second lead.
  const idempotencyRef = useRef<{ key: string; fingerprint: string } | null>(null);

  const submitLead = async (values: LeadFormValues): Promise<LeadReceipt> => {
    // Only the cart goes into a lead. Favorites are never read here.
    const items = cartLines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
    if (!items.length) throw new LeadSubmitError('Корзина пуста', 'empty_cart');

    const fingerprint = `${normalizeUzPhone(values.phone) ?? values.phone}|${cartSignature(cartLines)}`;
    if (!idempotencyRef.current || idempotencyRef.current.fingerprint !== fingerprint) {
      idempotencyRef.current = { key: createIdempotencyKey(), fingerprint };
    }

    try {
      const receipt = await postLead({ ...values, items, idempotencyKey: idempotencyRef.current.key });
      // Success (200 or 201): only now is the cart emptied.
      idempotencyRef.current = null;
      setCartLines([]);
      triggerHaptic('success');
      return receipt;
    } catch (error) {
      // Cart stays intact. If the catalog changed under the shopper, refresh it so the cart shows the truth.
      if (error instanceof LeadSubmitError && (error.code === 'product_unavailable' || error.code === 'out_of_stock')) {
        void loadCatalog();
      }
      triggerHaptic('error');
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    triggerHaptic('medium');
    const targetOrder = orders.find((ord) => ord.id === orderId);
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    const updated = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(updated.error || 'Could not update order status.');
    setOrders((prev) => prev.map((ord) => ord.id === orderId ? updated as Order : ord));
    showToast(`Статус заказа обновлен: ${status}`);

    if (targetOrder) {
      try {
        fetch('/api/telegram/send-status-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: targetOrder.orderNumber,
            customerName: targetOrder.customer.fullName,
            newStatus: status,
            phone: targetOrder.customer.phone,
            chatId: targetOrder.customer.telegramId
          })
        }).catch((e) => console.warn('Could not dispatch status to TG:', e));
      } catch (e) {
        console.warn('Status update TG error:', e);
      }
    }
  };

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не удалось сохранить товар.');
    setProducts((prev) => [result as Product, ...prev]);
    showToast('Товар добавлен в каталог!');
  };

  const updateProduct = async (id: string, updatedFields: Partial<Product>) => {
    const existing = products.find((product) => product.id === id);
    if (!existing) throw new Error('Товар не найден в каталоге.');
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...existing, ...updatedFields })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не удалось сохранить товар.');
    setProducts((prev) => prev.map((product) => product.id === id ? result as Product : product));
    showToast('Товар успешно обновлен');
  };

  const deleteProduct = async (id: string) => {
    triggerHaptic('warning');
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Не удалось удалить товар.');
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast('Товар удален из каталога', 'info');
  };

  const toggleProductStock = async (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product) throw new Error('Товар не найден в каталоге.');
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inStock: !product.inStock })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не удалось обновить наличие.');
    setProducts((prev) => prev.map((item) => item.id === id ? result as Product : item));
  };

  const resetDemoData = () => {
    setCartLines([]);
    refreshOrders().then(
      () => showToast('Список заказов обновлён из базы данных.', 'info'),
      () => showToast('Не удалось обновить список заказов.', 'error')
    );
  };

  return (
    <ShopContext.Provider
      value={{
        products,
        cart,
        favorites,
        favoriteIds,
        selectedCategory,
        selectedBrand,
        searchQuery,
        sortBy,
        currency,
        orders,
        selectedProductForDetail,
        isCartOpen,
        isLeadFormOpen,
        isFavoritesOpen,
        isAdminOpen,
        isTelegramFrame,
        isShareOpen,
        telegramUser,
        toast,
        setSelectedCategory,
        setSelectedBrand,
        setSearchQuery,
        setSortBy,
        setCurrency,
        setIsCartOpen,
        setIsLeadFormOpen,
        setIsFavoritesOpen,
        setIsAdminOpen,
        setIsTelegramFrame,
        setIsShareOpen,
        openProductDetail,
        closeProductDetail,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        toggleFavorite,
        submitLead,
        updateOrderStatus,
        refreshOrders,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductStock,
        showToast,
        resetDemoData
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
