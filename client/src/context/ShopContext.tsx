import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem, Order, OrderStatus, CategoryId, Currency, TelegramWebAppUser } from '../types';
import { getTelegramUser, initTelegramApp, triggerHaptic } from '../utils/telegram';

interface ShopContextType {
  products: Product[];
  cart: CartItem[];
  selectedCategory: CategoryId | 'all';
  selectedBrand: string | 'all';
  searchQuery: string;
  sortBy: 'popular' | 'price-asc' | 'price-desc' | 'rating';
  currency: Currency;
  orders: Order[];
  selectedProductForDetail: Product | null;
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
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
  setIsCheckoutOpen: (open: boolean) => void;
  setIsAdminOpen: (open: boolean) => void;
  setIsTelegramFrame: (frame: boolean) => void;
  setIsShareOpen: (open: boolean) => void;

  openProductDetail: (product: Product) => void;
  closeProductDetail: () => void;

  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;

  createOrder: (order: Omit<Order, 'orderNumber'>) => Promise<Order>;
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

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('flaner_cart') || localStorage.getItem('lumiere_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<Order[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [selectedBrand, setSelectedBrand] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'rating'>('popular');
  const [currency, setCurrency] = useState<Currency>('UZS');

  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
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
  useEffect(() => {
    fetch('/api/products')
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить каталог с сервера.');
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('Сервер вернул некорректный каталог товаров.');
        setProducts(data as Product[]);
      })
      .catch((error: unknown) => {
        console.error('Could not load product catalog:', error);
        showToast(error instanceof Error ? error.message : 'Не удалось загрузить каталог.', 'error');
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('flaner_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

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
    setSelectedProductForDetail(product);
  };

  const closeProductDetail = () => {
    setSelectedProductForDetail(null);
  };

  const addToCart = (product: Product, quantity = 1) => {
    triggerHaptic('medium');
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    showToast(`«${product.name}» добавлен в корзину`);
  };

  const removeFromCart = (productId: string) => {
    triggerHaptic('light');
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    triggerHaptic('selection');
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const createOrder = async (order: Omit<Order, 'orderNumber'>): Promise<Order> => {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    const saved = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(saved.error || 'Could not save order.');
    const persistedOrder = saved as Order;
    triggerHaptic('success');
    setOrders((prev) => [persistedOrder, ...prev.filter((existing) => existing.id !== persistedOrder.id)]);
    clearCart();
    showToast(`Заказ ${persistedOrder.orderNumber} успешно оформлен!`, 'success');

    // Notify Telegram bot
    try {
      fetch('/api/telegram/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: persistedOrder,
          customerChatId: persistedOrder.customer.telegramId || telegramUser?.id
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.recipientsSent && data.recipientsSent.length > 0) {
            showToast(`Уведомление о заказе ${persistedOrder.orderNumber} отправлено в Telegram (@flaneruz_bot)`, 'success');
          }
        })
        .catch((err) => {
          console.warn('Telegram notification network error:', err);
        });
    } catch (e) {
      console.warn('Telegram dispatch error:', e);
    }
    return persistedOrder;
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
    setCart([]);
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
        selectedCategory,
        selectedBrand,
        searchQuery,
        sortBy,
        currency,
        orders,
        selectedProductForDetail,
        isCartOpen,
        isCheckoutOpen,
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
        setIsCheckoutOpen,
        setIsAdminOpen,
        setIsTelegramFrame,
        setIsShareOpen,
        openProductDetail,
        closeProductDetail,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        createOrder,
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
