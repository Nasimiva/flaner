import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem, Order, OrderStatus, CategoryId, Currency, TelegramWebAppUser } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
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

  createOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;

  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleProductStock: (id: string) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  resetDemoData: () => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const SEED_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: 'FL-4819',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
    customer: {
      fullName: 'Дильноза Каримова',
      phone: '+998 90 123 45 67',
      telegramUsername: '@dilnoza_beauty',
      address: 'Узбекистан, г. Ташкент',
      city: 'Ташкент',
      deliveryType: 'courier',
      comment: 'Домофон работает, позвоните за 15 минут'
    },
    items: [
      {
        productId: 'prod-1',
        productName: 'Advanced Night Repair Serum',
        brand: 'Estée Lauder',
        image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
        price: 980000,
        volume: '50 мл',
        quantity: 1
      },
      {
        productId: 'prod-5',
        productName: 'Dior Addict Lip Glow Balm',
        brand: 'Dior',
        image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80',
        price: 520000,
        volume: '3.2 г',
        quantity: 1
      }
    ],
    subtotal: 1500000,
    discount: 150000,
    deliveryFee: 0,
    total: 1350000,
    paymentMethod: 'card_online',
    paymentStatus: 'paid',
    status: 'processing',
    promoCode: 'BEAUTY10'
  },
  {
    id: 'ord-102',
    orderNumber: 'FL-3912',
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    customer: {
      fullName: 'Малика Усманова',
      phone: '+998 93 987 65 43',
      telegramUsername: '@malika_u',
      address: 'Узбекистан, г. Ташкент',
      city: 'Ташкент',
      deliveryType: 'express'
    },
    items: [
      {
        productId: 'prod-9',
        productName: 'Lost Cherry Eau de Parfum',
        brand: 'Tom Ford',
        image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
        price: 3450000,
        volume: '50 мл',
        quantity: 1
      }
    ],
    subtotal: 3450000,
    discount: 0,
    deliveryFee: 30000,
    total: 3480000,
    paymentMethod: 'click',
    paymentStatus: 'paid',
    status: 'shipped'
  }
];

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Local storage initialization
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('flaner_products') || localStorage.getItem('lumiere_products');
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('flaner_cart') || localStorage.getItem('lumiere_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('flaner_orders') || localStorage.getItem('lumiere_orders');
      return saved ? JSON.parse(saved) : SEED_ORDERS;
    } catch {
      return SEED_ORDERS;
    }
  });

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

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('flaner_products', JSON.stringify(products));
    } catch (e) {
      console.error(e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('flaner_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('flaner_orders', JSON.stringify(orders));
    } catch (e) {
      console.error(e);
    }
  }, [orders]);

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

  const createOrder = (order: Order) => {
    triggerHaptic('success');
    setOrders((prev) => [order, ...prev]);
    clearCart();
    showToast(`Заказ ${order.orderNumber} успешно оформлен!`, 'success');

    // Notify Telegram bot
    try {
      fetch('/api/telegram/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order,
          customerChatId: order.customer.telegramId || telegramUser?.id
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.recipientsSent && data.recipientsSent.length > 0) {
            showToast(`Уведомление о заказе ${order.orderNumber} отправлено в Telegram (@flaneruz_bot)`, 'success');
          }
        })
        .catch((err) => {
          console.warn('Telegram notification network error:', err);
        });
    } catch (e) {
      console.warn('Telegram dispatch error:', e);
    }
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    triggerHaptic('medium');
    const targetOrder = orders.find((ord) => ord.id === orderId);

    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status } : ord))
    );
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

  const addProduct = (productData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}`
    };
    setProducts((prev) => [newProduct, ...prev]);
    showToast('Товар добавлен в каталог!');
  };

  const updateProduct = (id: string, updatedFields: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updatedFields } : p))
    );
    showToast('Товар успешно обновлен');
  };

  const deleteProduct = (id: string) => {
    triggerHaptic('warning');
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast('Товар удален из каталога', 'info');
  };

  const toggleProductStock = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, inStock: !p.inStock } : p))
    );
  };

  const resetDemoData = () => {
    setProducts(INITIAL_PRODUCTS);
    setOrders(SEED_ORDERS);
    setCart([]);
    showToast('Данные сброшены к демонстрационному набору');
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
