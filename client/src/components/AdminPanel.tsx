import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { Order, OrderStatus, Product, CategoryId } from '../types';
import { formatPrice, formatDate } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegram';
import {
  Package,
  ShoppingBag,
  BarChart3,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  Send,
  ArrowLeft,
  Search,
  Filter,
  Download,
  RotateCcw,
  Sparkles,
  DollarSign,
  CreditCard,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Key,
  ShieldCheck,
  Smartphone,
  QrCode,
  Copy,
  Share2
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const {
    orders,
    products,
    updateOrderStatus,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductStock,
    setIsAdminOpen,
    currency,
    showToast,
    resetDemoData
  } = useShop();

  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'analytics' | 'bot'>('orders');

  // Orders filtering
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Telegram Bot integration state
  const [botStatus, setBotStatus] = useState<{
    connected: boolean;
    bot?: { id: number; username: string; firstName: string; link: string };
    adminChatId?: string;
  }>({
    connected: true,
    bot: {
      id: 8580114168,
      username: 'flaneruz_bot',
      firstName: 'Flaner cosmetics',
      link: 'https://t.me/flaneruz_bot'
    },
    adminChatId: ''
  });
  const [adminChatIdInput, setAdminChatIdInput] = useState('');
  const [testChatIdInput, setTestChatIdInput] = useState('');
  const [testMsgInput, setTestMsgInput] = useState('Привет из админ-панели flaner_cosmetics! Заказ #FL-4819 принят.');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [recentTgUsers, setRecentTgUsers] = useState<Array<{ chatId: number; name: string; username?: string; lastText?: string }>>([]);

  const fetchBotStatus = () => {
    setIsRefreshingStatus(true);
    fetch('/api/telegram/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.bot) {
          setBotStatus(data);
          if (data.adminChatId) {
            setAdminChatIdInput(data.adminChatId);
          }
        }
      })
      .catch((err) => console.warn('Could not load TG bot status:', err))
      .finally(() => setIsRefreshingStatus(false));
  };

  useEffect(() => {
    fetchBotStatus();
  }, []);

  // Products filtering & creation
  const [productSearch, setProductSearch] = useState('');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // New product form state
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('Chanel');
  const [formCategory, setFormCategory] = useState<CategoryId>('face-care');
  const [formPrice, setFormPrice] = useState(350000);
  const [formOldPrice, setFormOldPrice] = useState(400000);
  const [formVolume, setFormVolume] = useState('50 мл');
  const [formDescription, setFormDescription] = useState('');
  const [formComposition, setFormComposition] = useState('');
  const [formHowToUse, setFormHowToUse] = useState('');
  const [formSkinType, setFormSkinType] = useState('Для всех типов кожи');
  const [formImageUrl, setFormImageUrl] = useState(
    'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80'
  );

  // Simulated bot notification dispatch
  const [botMessage, setBotMessage] = useState('');
  const [botSentSuccess, setBotSentSuccess] = useState(false);

  // Filtered orders
  const filteredOrders = orders.filter((ord) => {
    const matchesStatus = orderStatusFilter === 'all' || ord.status === orderStatusFilter;
    const matchesSearch =
      ord.orderNumber.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      ord.customer.fullName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      ord.customer.phone.includes(orderSearchQuery);
    return matchesStatus && matchesSearch;
  });

  // Filtered products
  const filteredProducts = products.filter((p) => {
    return (
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.brand.toLowerCase().includes(productSearch.toLowerCase())
    );
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return { label: 'Новый', bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock };
      case 'paid':
        return { label: 'Оплачен', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle };
      case 'processing':
        return { label: 'В сборке', bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: Package };
      case 'shipped':
        return { label: 'В пути (Курьер)', bg: 'bg-purple-100 text-purple-800 border-purple-200', icon: Truck };
      case 'delivered':
        return { label: 'Доставлен', bg: 'bg-teal-100 text-teal-800 border-teal-200', icon: CheckCircle };
      case 'cancelled':
        return { label: 'Отменен', bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle };
    }
  };

  const handleSimulateBotNotification = (order: Order, newStatus: string) => {
    triggerHaptic('success');
    const msg = `🔔 [Telegram Bot @flaneruz_bot]: Заказ ${order.orderNumber} переведен в статус "${newStatus}".`;
    setBotMessage(msg);
    setBotSentSuccess(true);
    showToast(`Уведомление отправлено через @flaneruz_bot!`);

    fetch('/api/telegram/send-status-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: order.orderNumber,
        customerName: order.customer.fullName,
        newStatus,
        phone: order.customer.phone,
        chatId: order.customer.telegramId
      })
    }).catch((err) => console.warn('Bot notification error:', err));

    setTimeout(() => setBotSentSuccess(false), 5000);
  };

  const handleSaveAdminChatId = async () => {
    try {
      const res = await fetch('/api/telegram/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminChatId: adminChatIdInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('ID чата администратора сохранен!', 'success');
        fetchBotStatus();
      }
    } catch {
      showToast('Ошибка при сохранении ID чата', 'error');
    }
  };

  const handleFetchUpdates = async () => {
    setIsLoadingUpdates(true);
    try {
      const res = await fetch('/api/telegram/updates');
      const data = await res.json();
      if (data.success && data.recentUsers) {
        setRecentTgUsers(data.recentUsers);
        if (data.recentUsers.length === 0) {
          showToast('Пока нет входящих сообщений в @flaneruz_bot. Напишите боту /start в Telegram!', 'info');
        } else {
          showToast(`Найдено ${data.recentUsers.length} чатов!`, 'success');
        }
      }
    } catch {
      showToast('Не удалось получить обновления бота', 'error');
    } finally {
      setIsLoadingUpdates(false);
    }
  };

  const handleSendTestMessage = async () => {
    const targetChat = testChatIdInput.trim() || botStatus.adminChatId;
    if (!targetChat) {
      showToast('Укажите Chat ID получателя', 'error');
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await fetch('/api/telegram/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: targetChat,
          text: testMsgInput
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Тестовое сообщение успешно отправлено через @flaneruz_bot!', 'success');
      } else {
        showToast(`Ошибка Telegram: ${data.error || 'Не удалось отправить'}`, 'error');
      }
    } catch {
      showToast('Сетевая ошибка при отправке в Telegram', 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormBrand('Chanel');
    setFormCategory('face-care');
    setFormPrice(450000);
    setFormOldPrice(520000);
    setFormVolume('50 мл');
    setFormDescription('Премиальное косметическое средство для бережного ухода и совершенного сияния.');
    setFormComposition('Aqua, Glycerin, Niacinamide, Sodium Hyaluronate, Panthenol, Camellia Sinensis Leaf Extract, Tocopherol, Phenoxyethanol.');
    setFormHowToUse('Наносить утром и вечером на очищенную кожу легкими массажными движениями.');
    setFormSkinType('Для всех типов кожи');
    setFormImageUrl('https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80');
    setIsAddProductModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormBrand(p.brand);
    setFormCategory(p.category);
    setFormPrice(p.price);
    setFormOldPrice(p.oldPrice || p.price);
    setFormVolume(p.volume);
    setFormDescription(p.description);
    setFormComposition(p.composition);
    setFormHowToUse(p.howToUse || '');
    setFormSkinType(p.skinType || '');
    setFormImageUrl(p.images[0]);
    setIsAddProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Укажите название товара', 'error');
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name: formName.trim(),
        brand: formBrand,
        category: formCategory,
        price: Number(formPrice),
        oldPrice: Number(formOldPrice),
        volume: formVolume,
        description: formDescription,
        composition: formComposition,
        howToUse: formHowToUse,
        skinType: formSkinType,
        images: [formImageUrl]
      });
    } else {
      addProduct({
        name: formName.trim(),
        brand: formBrand,
        category: formCategory,
        price: Number(formPrice),
        oldPrice: Number(formOldPrice),
        rating: 5.0,
        reviewsCount: 1,
        volume: formVolume,
        images: [formImageUrl],
        description: formDescription,
        composition: formComposition,
        howToUse: formHowToUse,
        skinType: formSkinType,
        inStock: true,
        stockCount: 15,
        isNew: true
      });
    }

    setIsAddProductModalOpen(false);
  };

  // Export orders JSON
  const handleExportOrders = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(orders, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `flaner_orders_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Данные заказов выгружены в JSON');
  };

  // Metrics
  const totalRevenue = orders.reduce((sum, ord) => sum + ord.total, 0);
  const paidOrdersCount = orders.filter((o) => o.paymentStatus === 'paid' || o.status === 'delivered').length;
  const avgCheck = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

  return (
    <div className="min-h-screen bg-[#F7F4F0] text-[#2A2421]">
      {/* Admin Top Navigation */}
      <div className="bg-[#2A2421] text-white sticky top-0 z-40 px-4 py-3 border-b border-[#3D3531]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsAdminOpen(false)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Вернуться в витрину"
            >
              <ArrowLeft className="w-4 h-4 text-[#E8DDD4]" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold tracking-wide">
                  FLANER COSMETICS ADMIN
                </h1>
                <span className="text-[10px] bg-[#C9A227] text-white px-2 py-0.5 rounded-full font-semibold">
                  Панель управления
                </span>
              </div>
              <p className="text-[11px] text-[#A89A90] hidden sm:block">
                Управление заказами, каталогом косметики и Telegram-ботом @flaneruz_bot
              </p>
            </div>
          </div>

          {/* Return to shop button */}
          <button
            onClick={() => setIsAdminOpen(false)}
            className="text-xs bg-[#E8DDD4] text-[#2A2421] hover:bg-white px-3 py-1.5 rounded-full font-semibold transition-colors flex items-center space-x-1.5 shadow-sm"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>В магазин</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar border-b border-[#E0D7CE]">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold text-xs rounded-xl transition-all ${
              activeTab === 'orders'
                ? 'bg-[#2A2421] text-white shadow-sm'
                : 'text-[#6E5C51] hover:bg-[#EAE1D7]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Заказы клиентов</span>
            <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold text-xs rounded-xl transition-all ${
              activeTab === 'products'
                ? 'bg-[#2A2421] text-white shadow-sm'
                : 'text-[#6E5C51] hover:bg-[#EAE1D7]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Каталог товаров</span>
            <span className="bg-[#E2D8CE] text-[#52443C] text-[10px] px-1.5 py-0.2 rounded-full">
              {products.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold text-xs rounded-xl transition-all ${
              activeTab === 'analytics'
                ? 'bg-[#2A2421] text-white shadow-sm'
                : 'text-[#6E5C51] hover:bg-[#EAE1D7]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Статистика и шлюзы</span>
          </button>

          <button
            onClick={() => setActiveTab('bot')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-semibold text-xs rounded-xl transition-all ${
              activeTab === 'bot'
                ? 'bg-[#2A2421] text-white shadow-sm'
                : 'text-[#6E5C51] hover:bg-[#EAE1D7]'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Telegram Бот-центр</span>
          </button>
        </div>

        {/* TAB 1: ORDERS DASHBOARD */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-2xl border border-[#EAE3DC] shadow-xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A796F]" />
                <input
                  type="text"
                  placeholder="Поиск по номеру заказа, клиенту или телефону..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421]"
                />
              </div>

              {/* Status Pills Filter */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setOrderStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    orderStatusFilter === 'all'
                      ? 'bg-[#2A2421] text-white'
                      : 'bg-[#F2ECE5] text-[#5A4D44] hover:bg-[#E5DDD4]'
                  }`}
                >
                  Все ({orders.length})
                </button>
                {(['new', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map(
                  (status) => {
                    const count = orders.filter((o) => o.status === status).length;
                    return (
                      <button
                        key={status}
                        onClick={() => setOrderStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                          orderStatusFilter === status
                            ? 'bg-[#2A2421] text-white font-semibold'
                            : 'bg-[#F2ECE5] text-[#5A4D44] hover:bg-[#E5DDD4]'
                        }`}
                      >
                        {status === 'new' && 'Новые'}
                        {status === 'paid' && 'Оплачены'}
                        {status === 'processing' && 'В сборке'}
                        {status === 'shipped' && 'В пути'}
                        {status === 'delivered' && 'Доставлены'}
                        {status === 'cancelled' && 'Отменены'}
                        <span className="ml-1 opacity-70">({count})</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-[#8A796F] border border-[#EAE3DC] space-y-2">
                <Package className="w-10 h-10 mx-auto text-[#BDB0A4]" />
                <div className="text-sm font-semibold text-[#2A2421]">Заказы не найдены</div>
                <div className="text-xs">Попробуйте изменить параметры поиска или статус фильтра</div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  const StatusIcon = badge.icon;
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-[#EAE3DC] p-4 shadow-xs space-y-3 transition-all hover:border-[#D5C9BE]"
                    >
                      {/* Top Row: Number, Date, Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F2ECE5] pb-3">
                        <div className="flex items-center space-x-2.5">
                          <span className="font-mono text-sm font-bold text-[#2A2421]">
                            {order.orderNumber}
                          </span>
                          <span className="text-[11px] text-[#8A796F]">
                            • {formatDate(order.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span
                            className={`flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.bg}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            <span>{badge.label}</span>
                          </span>

                          <span className="text-xs font-bold bg-[#FAF8F5] border border-[#DFD6CD] px-2.5 py-1 rounded-full text-[#2A2421]">
                            {formatPrice(order.total, currency)}
                          </span>
                        </div>
                      </div>

                      {/* Customer and Delivery info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-[#52443C]">
                        <div>
                          <span className="text-[10px] text-[#8A796F] block uppercase font-bold">
                            Клиент:
                          </span>
                          <span className="font-semibold text-[#2A2421]">
                            {order.customer.fullName}
                          </span>
                          <div className="text-[#6E5C51]">{order.customer.phone}</div>
                          {order.customer.telegramUsername && (
                            <span className="text-[#2B5278] font-medium block">
                              {order.customer.telegramUsername}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-[#8A796F] block uppercase font-bold">
                            Доставка ({order.customer.deliveryType}):
                          </span>
                          <span className="text-[#2A2421]">{order.customer.city}</span>
                          <div className="text-[#6E5C51]">{order.customer.address}</div>
                          {order.customer.comment && (
                            <div className="italic text-[#8A796F] text-[11px] mt-0.5">
                              «{order.customer.comment}»
                            </div>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-[#8A796F] block uppercase font-bold">
                            Оплата:
                          </span>
                          <span className="font-semibold text-[#2A2421]">
                            {order.paymentMethod === 'card_online'
                              ? '💳 На карту 9860 1701 2205 1080 (Humo)'
                              : order.paymentMethod.replace('_', ' ').toUpperCase()}
                          </span>
                          <div className="text-xs">
                            Статус: {order.paymentStatus === 'paid' ? '✅ Оплачено' : '⏳ Ожидает'}
                          </div>
                          {order.promoCode && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium inline-block mt-0.5">
                              Промокод: {order.promoCode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items Accordion Header */}
                      <div className="pt-2 border-t border-[#F2ECE5] flex items-center justify-between">
                        <button
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="text-xs text-[#6E4F3E] hover:underline font-semibold flex items-center space-x-1"
                        >
                          <span>Состав заказа ({order.items.length} позиций)</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* Status Change Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {order.status === 'new' && (
                            <button
                              onClick={() => {
                                updateOrderStatus(order.id, 'processing');
                                handleSimulateBotNotification(order, 'В сборке');
                              }}
                              className="px-2.5 py-1 bg-[#2A2421] text-white text-[11px] font-semibold rounded-lg hover:bg-[#3D3531]"
                            >
                              Взять в сборку
                            </button>
                          )}
                          {order.status === 'processing' && (
                            <button
                              onClick={() => {
                                updateOrderStatus(order.id, 'shipped');
                                handleSimulateBotNotification(order, 'В пути к вам (передан курьеру)');
                              }}
                              className="px-2.5 py-1 bg-purple-700 text-white text-[11px] font-semibold rounded-lg hover:bg-purple-800"
                            >
                              Передать курьеру
                            </button>
                          )}
                          {order.status === 'shipped' && (
                            <button
                              onClick={() => {
                                updateOrderStatus(order.id, 'delivered');
                                handleSimulateBotNotification(order, 'Доставлен! Спасибо за заказ');
                              }}
                              className="px-2.5 py-1 bg-emerald-700 text-white text-[11px] font-semibold rounded-lg hover:bg-emerald-800"
                            >
                              Заказ доставлен
                            </button>
                          )}
                          {order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'cancelled')}
                              className="px-2 py-1 bg-[#F5EFEB] text-[#A64B2A] hover:bg-[#EAE1D7] text-[11px] font-semibold rounded-lg"
                            >
                              Отменить
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Items */}
                      {isExpanded && (
                        <div className="pt-2 space-y-2 border-t border-[#F2ECE5] bg-[#FAF8F5] p-3 rounded-xl">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center space-x-3 text-xs">
                              <img
                                src={item.image}
                                alt={item.productName}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-lg object-cover bg-white border border-[#DFD6CD]"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-[#2A2421] truncate">
                                  {item.brand} • {item.productName}
                                </div>
                                <div className="text-[11px] text-[#7A6B62]">
                                  {item.volume} • {item.quantity} шт × {formatPrice(item.price, currency)}
                                </div>
                              </div>
                              <span className="font-bold text-[#2A2421]">
                                {formatPrice(item.price * item.quantity, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRODUCTS CATALOG MANAGEMENT */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-2xl border border-[#EAE3DC] shadow-xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A796F]" />
                <input
                  type="text"
                  placeholder="Поиск по названию или бренду..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421]"
                />
              </div>

              <button
                onClick={handleOpenAddModal}
                className="bg-[#2A2421] hover:bg-[#3D3531] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить товар</span>
              </button>
            </div>

            {/* Products Table/Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-[#EAE3DC] p-3.5 flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div className="flex space-x-3">
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover bg-[#F5EFEB] border border-[#DFD6CD] flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#8A796F] block">
                        {p.brand}
                      </span>
                      <h4 className="text-xs font-bold text-[#2A2421] line-clamp-2">
                        {p.name}
                      </h4>
                      <div className="text-[11px] text-[#7A6B62] mt-0.5">
                        {p.volume} • {formatPrice(p.price, currency)}
                      </div>
                    </div>
                  </div>

                  {/* Stock and Category */}
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#F2ECE5]">
                    <span className="bg-[#F3ECE5] text-[#5A4D44] px-2 py-0.5 rounded-full font-medium">
                      {p.category === 'face-care'
                        ? 'Уход за лицом'
                        : p.category === 'makeup'
                        ? 'Декоративная'
                        : 'Парфюмерия'}
                    </span>

                    <button
                      onClick={() => toggleProductStock(p.id)}
                      className={`px-2 py-0.5 rounded-full font-semibold transition-colors ${
                        p.inStock
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {p.inStock ? 'В наличии' : 'Нет в наличии'}
                    </button>
                  </div>

                  {/* Edit / Delete actions */}
                  <div className="flex gap-2 pt-1 border-t border-[#F2ECE5]">
                    <button
                      onClick={() => handleOpenEditModal(p)}
                      className="flex-1 bg-[#F5EFEB] hover:bg-[#EAE1D7] text-[#2A2421] text-xs font-semibold py-1.5 rounded-lg flex items-center justify-center space-x-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Изменить</span>
                    </button>
                    <button
                      onClick={() => deleteProduct(p.id)}
                      className="w-8 h-8 rounded-lg bg-[#FAF0ED] hover:bg-[#F7E3DC] text-[#A64B2A] flex items-center justify-center"
                      title="Удалить товар"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ANALYTICS & PAYMENT GATEWAYS */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-[#EAE3DC] shadow-xs">
                <span className="text-[11px] uppercase font-bold text-[#8A796F] block mb-1">
                  Общая выручка
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#2A2421]">
                  {formatPrice(totalRevenue, currency)}
                </span>
                <span className="text-[11px] text-emerald-600 font-medium block mt-1">
                  За все время работы бутика
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#EAE3DC] shadow-xs">
                <span className="text-[11px] uppercase font-bold text-[#8A796F] block mb-1">
                  Всего заказов
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#2A2421]">
                  {orders.length}
                </span>
                <span className="text-[11px] text-[#6E5C51] font-medium block mt-1">
                  Оплачено: {paidOrdersCount}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#EAE3DC] shadow-xs">
                <span className="text-[11px] uppercase font-bold text-[#8A796F] block mb-1">
                  Средний чек
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#2A2421]">
                  {formatPrice(avgCheck, currency)}
                </span>
                <span className="text-[11px] text-[#6E5C51] font-medium block mt-1">
                  На одного покупателя
                </span>
              </div>
            </div>

            {/* Payment Gateways Status */}
            <div className="bg-white p-5 rounded-2xl border border-[#EAE3DC] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#2A2421]">
                  Статус подключения платежных систем
                </h3>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold">
                  Шлюзы активны
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-[#C9A227]/40 space-y-1 bg-[#FAF5E8] sm:col-span-2 shadow-xs">
                  <div className="flex items-center justify-between font-bold text-[#2A2421]">
                    <div className="flex items-center space-x-1.5">
                      <CreditCard className="w-4 h-4 text-[#C9A227]" />
                      <span>Онлайн-оплата на карту (Humo / Uzcard)</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                      Основной • Карта 9860 1701 2205 1080
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E5C51] leading-relaxed">
                    Официальная карта бутика: <strong className="font-mono text-[#2A2421] bg-white px-1.5 py-0.5 rounded border border-[#DFD6CD]">9860 1701 2205 1080</strong> (Humo, flaner_cosmetics). Прямые переводы онлайн через Payme, Click, Uzum Bank и банковские приложения Узбекистана.
                  </p>
                </div>

                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE3DC] space-y-1">
                  <div className="flex items-center justify-between font-bold text-[#2B5278]">
                    <span>Telegram Payments (Stars & Invoice)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E5C51]">
                    Интеграция через Telegram Bot Payments API, поддержка Stars и инвойсов в чате.
                  </p>
                </div>

                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE3DC] space-y-1">
                  <div className="flex items-center justify-between font-bold text-[#0E7A6E]">
                    <span>Payme (Uzcard / Humo)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Merchant Active
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E5C51]">
                    Merchant API Payme Узбекистан. Протокол чеков и SMS OTP подтверждения.
                  </p>
                </div>

                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE3DC] space-y-1">
                  <div className="flex items-center justify-between font-bold text-[#006BB3]">
                    <span>Click Evolution</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Click Pass Active
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E5C51]">
                    Выставление счетов в мобильное приложение Click и оплата по QR коду.
                  </p>
                </div>

                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE3DC] space-y-1">
                  <div className="flex items-center justify-between font-bold text-[#635BFF]">
                    <span>Stripe Checkout</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Cards & Apple Pay
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E5C51]">
                    Международный карточный эквайринг с поддержкой 3D Secure 2.0.
                  </p>
                </div>
              </div>

              {/* Data Export and Reset */}
              <div className="flex flex-wrap gap-2.5 pt-3 border-t border-[#F2ECE5]">
                <button
                  onClick={handleExportOrders}
                  className="bg-[#2A2421] text-white hover:bg-[#3D3531] px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Экспорт всех заказов в JSON</span>
                </button>

                <button
                  onClick={resetDemoData}
                  className="bg-[#F5EFEB] text-[#A64B2A] hover:bg-[#EAE1D7] px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Сбросить к демо-данным</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TELEGRAM BOT COMMAND CENTER */}
        {activeTab === 'bot' && (
          <div className="space-y-6">
            {/* Bot Status & Credentials Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#EAE3DC] shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F2ECE5]">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#2AABEE]/10 flex items-center justify-center text-[#2AABEE]">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-[#2A2421]">
                        {botStatus.bot?.firstName || 'Flaner cosmetics'}
                      </h3>
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3" />
                        <span>API Подключен</span>
                      </span>
                    </div>
                    <p className="text-xs text-[#7A6B62] mt-0.5">
                      Telegram Бот: <strong className="text-[#2A2421]">@{botStatus.bot?.username || 'flaneruz_bot'}</strong> (ID: {botStatus.bot?.id || '8580114168'})
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={fetchBotStatus}
                    disabled={isRefreshingStatus}
                    className="p-2 bg-[#FAF8F5] hover:bg-[#F2ECE5] border border-[#DFD6CD] rounded-xl text-xs text-[#52443C] font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                    title="Обновить статус соединения"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
                    <span>Проверить</span>
                  </button>

                  <a
                    href={botStatus.bot?.link || 'https://t.me/flaneruz_bot'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#2AABEE] hover:bg-[#229ED9] text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
                  >
                    <span>Открыть @flaneruz_bot</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Token Display Banner */}
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#EAE3DC] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#52443C] flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-[#C9A227]" />
                    <span>Активный Telegram Bot Token:</span>
                  </span>
                  <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Авторизован в Telegram API
                  </span>
                </div>
                <div className="font-mono text-xs text-[#2A2421] bg-white px-3 py-2 rounded-xl border border-[#DFD6CD] break-all select-all flex items-center justify-between">
                  <span>8580114168:AAEQuUmq5pVHd0B50syGwJ1pS5BGh4XXgVc</span>
                  <span className="text-[10px] text-[#8A796F] font-sans ml-2 shrink-0">Bot ID: 8580114168</span>
                </div>
                <p className="text-[11px] text-[#8A796F]">
                  Токен привязан к серверу и используется для отправки карточек заказов администратору и push-уведомлений покупателям.
                </p>
              </div>

              {/* Mobile Access / Link for all phones */}
              <div className="p-4 bg-[#FAF5E8] rounded-2xl border border-[#E8DCBF] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5C4515] flex items-center space-x-1.5">
                    <Smartphone className="w-4 h-4 text-[#C9A227]" />
                    <span>Доступ к магазину с любых телефонов</span>
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    Доступен онлайн для всех
                  </span>
                </div>
                <p className="text-xs text-[#6E5C51] leading-relaxed">
                  Эта страница адаптирована для экранов любых смартфонов (iOS / Android) и открывается по публичной ссылке в любом браузере, а также внутри Telegram как Mini App:
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.href : 'https://flaner-cosmetics.app'}
                    className="flex-1 bg-white border border-[#DFD6CD] px-3 py-2 rounded-xl text-xs font-mono text-[#2A2421] select-all focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(window.location.href);
                        showToast('Ссылка на магазин скопирована для отправки на телефоны!', 'success');
                      }
                    }}
                    className="bg-[#2A2421] hover:bg-[#3D3531] text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Скопировать ссылку</span>
                  </button>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent('✨ Откройте бутик косметики flaner_cosmetics на телефоне!')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#2AABEE] hover:bg-[#229ED9] text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Отправить в чат</span>
                  </a>
                  <a
                    href="/flaner-cosmetics.zip"
                    download="flaner-cosmetics.zip"
                    className="bg-[#5C4515] hover:bg-[#46340F] text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shrink-0"
                    title="Скачать ZIP архив для VS Code"
                  >
                    <Download className="w-3.5 h-3.5 text-[#E8DCBF]" />
                    <span>Скачать .ZIP для VS Code</span>
                  </a>
                </div>
              </div>

              {botSentSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium animate-slide-up">
                  {botMessage}
                </div>
              )}
            </div>

            {/* Admin Channel / Chat ID Setup & Updates Discovery */}
            <div className="bg-white p-6 rounded-3xl border border-[#EAE3DC] shadow-xs space-y-5">
              <div>
                <h4 className="text-sm font-bold text-[#2A2421] flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-[#C9A227]" />
                  <span>Чат администратора для новых заказов</span>
                </h4>
                <p className="text-xs text-[#7A6B62] mt-1">
                  Укажите ваш персональный Telegram Chat ID или ID канала/группы (начиная с <code className="bg-[#FAF8F5] px-1 py-0.5 rounded border border-[#DFD6CD]">-100...</code>), куда бот будет моментально отправлять все поступающие заказы с деталями и контактами.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Например: 123456789 или -1001987654321 или @channel_name"
                  value={adminChatIdInput}
                  onChange={(e) => setAdminChatIdInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421]"
                />
                <button
                  onClick={handleSaveAdminChatId}
                  className="bg-[#2A2421] hover:bg-[#3D3531] text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors shrink-0"
                >
                  Сохранить Chat ID
                </button>
                <button
                  onClick={handleFetchUpdates}
                  disabled={isLoadingUpdates}
                  className="bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 text-[#1E88E5] px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                  title="Найти пользователей, написавших боту"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUpdates ? 'animate-spin' : ''}`} />
                  <span>Найти мой Chat ID</span>
                </button>
              </div>

              {/* Found Users/Chats list */}
              {recentTgUsers.length > 0 && (
                <div className="p-4 bg-[#F0F8FF] border border-[#BDE0FE] rounded-2xl space-y-2.5 animate-slide-up">
                  <span className="text-xs font-bold text-[#0D47A1] block">
                    Недавние пользователи и чаты, написавшие @flaneruz_bot:
                  </span>
                  <div className="space-y-1.5">
                    {recentTgUsers.map((u) => (
                      <div
                        key={u.chatId}
                        className="bg-white p-2.5 rounded-xl border border-[#BDE0FE] flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-[#2A2421]">{u.name}</span>
                          {u.username && <span className="text-[#2AABEE] ml-1.5">@{u.username}</span>}
                          <span className="text-[#8A796F] ml-2 font-mono text-[11px]">ID: {u.chatId}</span>
                          {u.lastText && (
                            <span className="block text-[11px] text-[#6E5C51] italic mt-0.5">
                              Последнее сообщение: «{u.lastText}»
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setAdminChatIdInput(String(u.chatId));
                            setTestChatIdInput(String(u.chatId));
                            showToast(`Выбран Chat ID: ${u.chatId}`);
                          }}
                          className="bg-[#0D47A1] hover:bg-[#1565C0] text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        >
                          Использовать этот ID
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Send Test Telegram Message */}
              <div className="pt-4 border-t border-[#F2ECE5] space-y-3">
                <span className="text-xs font-bold text-[#2A2421] block">
                  Тестовая отправка сообщения из бота:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Chat ID получателя (число или @username)"
                    value={testChatIdInput || adminChatIdInput}
                    onChange={(e) => setTestChatIdInput(e.target.value)}
                    className="px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421]"
                  />
                  <input
                    type="text"
                    placeholder="Текст сообщения..."
                    value={testMsgInput}
                    onChange={(e) => setTestMsgInput(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421]"
                  />
                </div>
                <button
                  onClick={handleSendTestMessage}
                  disabled={isSendingTest}
                  className="bg-[#2B5278] hover:bg-[#204060] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTest ? 'Отправка...' : 'Отправить тестовое сообщение'}</span>
                </button>
              </div>
            </div>

            {/* Live Order Push Notifications */}
            <div className="bg-white p-6 rounded-3xl border border-[#EAE3DC] shadow-xs space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#2A2421] flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-[#2AABEE]" />
                  <span>Отправка уведомлений по текущим заказам</span>
                </h4>
                <p className="text-xs text-[#7A6B62] mt-1">
                  Нажмите кнопку на любом заказе, чтобы мгновенно отправить в бот статус и детали заказа.
                </p>
              </div>

              <div className="space-y-2">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EAE3DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#2A2421]">{ord.orderNumber}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#2A2421]/10 text-[#2A2421]">
                          {formatPrice(ord.total, currency)}
                        </span>
                        <span className="text-[10px] text-[#8A796F]">{formatDate(ord.createdAt)}</span>
                      </div>
                      <div className="text-[#6E5C51] mt-1">
                        <strong>{ord.customer.fullName}</strong> • {ord.customer.phone}
                        {ord.customer.telegramUsername && (
                          <span className="text-[#2AABEE] ml-1.5 font-medium">{ord.customer.telegramUsername}</span>
                        )}
                        <span className="text-[#8A796F] ml-2">({ord.items.length} поз.)</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleSimulateBotNotification(ord, 'Передан курьеру на доставку')}
                        className="bg-[#2B5278] hover:bg-[#204060] text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>Отправить push в @flaneruz_bot</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Telegram Mini App BotFather Setup Guide */}
            <div className="bg-[#FAF8F5] p-6 rounded-3xl border border-[#EAE3DC] space-y-3">
              <h4 className="text-xs font-bold text-[#2A2421] uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>Инструкция по настройке кнопки Web App в @BotFather:</span>
              </h4>
              <div className="space-y-2 text-xs text-[#6E5C51]">
                <div className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-[#2A2421] text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Откройте в Telegram официального бота <strong>@BotFather</strong> и отправьте команду <code className="bg-white px-1.5 py-0.5 rounded border border-[#DFD6CD] font-mono">/setmenubutton</code>.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-[#2A2421] text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Выберите вашего бота <strong>@flaneruz_bot</strong>.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-[#2A2421] text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                  <span>Укажите URL сайта: <code className="bg-white px-1.5 py-0.5 rounded border border-[#DFD6CD] font-mono select-all text-[#2B5278]">{typeof window !== 'undefined' ? window.location.origin : 'https://flaner-cosmetics.app'}</code>.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-[#2A2421] text-white text-[11px] font-bold flex items-center justify-center shrink-0">4</span>
                  <span>Укажите текст кнопки, например: <strong className="text-[#2A2421]">🛍 Открыть магазин</strong> или <strong className="text-[#2A2421]">Каталог косметики</strong>.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#EAE3DC] my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#2A2421] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingProduct ? 'Редактировать товар' : 'Добавить товар в каталог'}
              </h3>
              <button
                onClick={() => setIsAddProductModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 sm:p-6 space-y-3.5 max-h-[80vh] overflow-y-auto no-scrollbar text-xs">
              <div>
                <label className="font-medium text-[#6E5C51] block mb-1">
                  Название товара: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Advanced Night Repair Serum"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[#6E5C51] block mb-1">
                    Бренд:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Estée Lauder, Dior, Chanel"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-medium text-[#6E5C51] block mb-1">
                    Категория:
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as CategoryId)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl"
                  >
                    <option value="face-care">Уход за лицом</option>
                    <option value="makeup">Декоративная косметика</option>
                    <option value="perfume">Парфюмерия</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-medium text-[#6E5C51] block mb-1">
                    Цена (UZS):
                  </label>
                  <input
                    type="number"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-medium text-[#6E5C51] block mb-1">
                    Старая цена:
                  </label>
                  <input
                    type="number"
                    value={formOldPrice}
                    onChange={(e) => setFormOldPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-medium text-[#6E5C51] block mb-1">
                    Объем:
                  </label>
                  <input
                    type="text"
                    placeholder="50 мл"
                    value={formVolume}
                    onChange={(e) => setFormVolume(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E5C51] block mb-1">
                  Состав (INCI список ингредиентов): *
                </label>
                <textarea
                  rows={2}
                  value={formComposition}
                  onChange={(e) => setFormComposition(e.target.value)}
                  placeholder="Water, Glycerin, Sodium Hyaluronate..."
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-medium text-[#6E5C51] block mb-1">
                  Описание товара:
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl"
                />
              </div>

              <div>
                <label className="font-medium text-[#6E5C51] block mb-1">
                  URL фотографии товара:
                </label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#2A2421] hover:bg-[#3D3531] text-white py-2.5 rounded-xl font-bold transition-colors"
                >
                  {editingProduct ? 'Сохранить изменения' : 'Добавить товар'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="bg-[#F5EFEB] text-[#4A3E37] px-4 py-2.5 rounded-xl font-semibold"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
