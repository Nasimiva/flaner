import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { Order, PaymentMethod, OrderCustomer } from '../types';
import { formatPrice, generateOrderNumber } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegram';
import { PaymentModal } from './PaymentModal';
import {
  X,
  CreditCard,
  Send,
  Smartphone,
  Truck,
  MapPin,
  User,
  Phone,
  ShieldCheck,
  Check,
  Building2,
  FileText
} from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const {
    cart,
    isCheckoutOpen,
    setIsCheckoutOpen,
    currency,
    createOrder,
    telegramUser
  } = useShop();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [city, setCity] = useState('Ташкент');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [deliveryType, setDeliveryType] = useState<'courier' | 'express' | 'pickup'>('courier');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card_online');

  // Validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Active payment gateway modal state
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Pre-fill with Telegram user data if available
  useEffect(() => {
    if (telegramUser) {
      if (telegramUser.first_name || telegramUser.last_name) {
        setFullName(`${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim());
      }
      if (telegramUser.username) {
        setTelegramUsername(`@${telegramUser.username}`);
      }
    }
  }, [telegramUser]);

  if (!isCheckoutOpen && !isPaymentModalOpen) return null;

  const FREE_SHIPPING_THRESHOLD = 2000000;
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryFee =
    deliveryType === 'pickup'
      ? 0
      : deliveryType === 'express'
      ? 45000
      : subtotal >= FREE_SHIPPING_THRESHOLD
      ? 0
      : 30000;

  const total = subtotal + deliveryFee;

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Укажите ваше имя';
    if (!phone.trim() || phone.trim().length < 9) errors.phone = 'Укажите контактный номер телефона';
    if (deliveryType !== 'pickup' && !address.trim()) errors.address = 'Укажите адрес доставки';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      triggerHaptic('error');
      return;
    }

    triggerHaptic('medium');

    const customerData: OrderCustomer = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      telegramUsername: telegramUsername.trim() || undefined,
      telegramId: telegramUser?.id,
      address: deliveryType === 'pickup' ? 'Самовывоз из бутика (Узбекистан, г. Ташкент)' : address.trim(),
      city,
      comment: comment.trim() || undefined,
      deliveryType
    };

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: generateOrderNumber(),
      createdAt: new Date().toISOString(),
      customer: customerData,
      items: cart.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        brand: item.product.brand,
        image: item.product.images[0],
        price: item.product.price,
        volume: item.product.volume,
        quantity: item.quantity
      })),
      subtotal,
      discount: 0,
      deliveryFee,
      total,
      paymentMethod,
      paymentStatus: paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending',
      status: 'new'
    };

    setPendingOrder(newOrder);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (completedOrder: Order) => {
    createOrder(completedOrder);
    setIsPaymentModalOpen(false);
    setIsCheckoutOpen(false);
  };

  return (
    <>
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-xl bg-[#FAF8F5] rounded-3xl overflow-hidden shadow-2xl border border-[#EAE3DC] my-6 animate-scale"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-white border-b border-[#EAE3DC] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-[#2A2421]" />
                <h2 className="text-base font-bold text-[#2A2421]">Оформление заказа</h2>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="w-8 h-8 rounded-full bg-[#EFE9E2] hover:bg-[#E2D8CE] flex items-center justify-center text-[#4A3E37] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Checkout Form */}
            <form onSubmit={handleStartPayment} className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
              {/* Recipient Details */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-[#EAE3DC]">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#6E5C51]">
                  <User className="w-4 h-4 text-[#C9A227]" />
                  <span>Контакты получателя</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                      Имя и Фамилия: *
                    </label>
                    <input
                      type="text"
                      placeholder="Дильноза Каримова"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={`w-full px-3 py-2 text-xs bg-[#FAF8F5] border rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421] ${
                        formErrors.fullName ? 'border-red-500' : 'border-[#DFD6CD]'
                      }`}
                    />
                    {formErrors.fullName && (
                      <span className="text-[10px] text-red-500 block mt-0.5">{formErrors.fullName}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                      Номер телефона: *
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A796F]" />
                      <input
                        type="tel"
                        placeholder="+998 90 123 45 67"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 text-xs bg-[#FAF8F5] border rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421] ${
                          formErrors.phone ? 'border-red-500' : 'border-[#DFD6CD]'
                        }`}
                      />
                    </div>
                    {formErrors.phone && (
                      <span className="text-[10px] text-red-500 block mt-0.5">{formErrors.phone}</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                    Telegram @username (для чека и связи курьера):
                  </label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421]"
                  />
                </div>
              </div>

              {/* Delivery Details */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-[#EAE3DC]">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#6E5C51]">
                  <MapPin className="w-4 h-4 text-[#C9A227]" />
                  <span>Способ и адрес доставки</span>
                </div>

                {/* Delivery Type Radios */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    onClick={() => setDeliveryType('courier')}
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      deliveryType === 'courier'
                        ? 'border-[#2A2421] bg-[#F5EFEB] ring-1 ring-[#2A2421]'
                        : 'border-[#DFD6CD] hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#2A2421]">Курьер</span>
                      <Truck className="w-3.5 h-3.5 text-[#6E4F3E]" />
                    </div>
                    <span className="text-[10px] text-[#7A6B62]">1-2 дня</span>
                    <div className="text-[11px] font-semibold text-[#2A2421] mt-1">
                      {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                        <span className="text-emerald-700 font-bold">Бесплатно</span>
                      ) : (
                        <div>
                          <span>{formatPrice(30000, currency)}</span>
                          <span className="block text-[9px] text-[#8A796F] font-normal">Бесплатно от 2 млн сум</span>
                        </div>
                      )}
                    </div>
                  </label>

                  <label
                    onClick={() => setDeliveryType('express')}
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      deliveryType === 'express'
                        ? 'border-[#2A2421] bg-[#F5EFEB] ring-1 ring-[#2A2421]'
                        : 'border-[#DFD6CD] hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#2A2421]">Экспресс</span>
                      <span className="text-[9px] bg-[#A64B2A] text-white px-1.5 py-0.2 rounded-full font-bold">
                        2 часа
                      </span>
                    </div>
                    <span className="text-[10px] text-[#7A6B62]">Срочная</span>
                    <span className="text-[11px] font-semibold text-[#2A2421] mt-1">
                      {formatPrice(45000, currency)}
                    </span>
                  </label>

                  <label
                    onClick={() => setDeliveryType('pickup')}
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      deliveryType === 'pickup'
                        ? 'border-[#2A2421] bg-[#F5EFEB] ring-1 ring-[#2A2421]'
                        : 'border-[#DFD6CD] hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#2A2421]">Самовывоз</span>
                      <Building2 className="w-3.5 h-3.5 text-[#6E4F3E]" />
                    </div>
                    <span className="text-[10px] text-[#7A6B62]">Бутик Flaner Cosmetics</span>
                    <span className="text-[11px] font-semibold text-emerald-600 mt-1">
                      Бесплатно
                    </span>
                  </label>
                </div>

                {deliveryType !== 'pickup' ? (
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                        Город доставки:
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421]"
                      >
                        <option value="Ташкент">Ташкент</option>
                        <option value="Самарканд">Самарканд</option>
                        <option value="Бухара">Бухара</option>
                        <option value="Фергана">Фергана</option>
                        <option value="Наманган">Наманган</option>
                        <option value="Андижан">Андижан</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                        Точный адрес (Улица, дом, подъезд, квартира/офис): *
                      </label>
                      <input
                        type="text"
                        placeholder="Узбекистан, г. Ташкент, ул. ..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className={`w-full px-3 py-2 text-xs bg-[#FAF8F5] border rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421] ${
                          formErrors.address ? 'border-red-500' : 'border-[#DFD6CD]'
                        }`}
                      />
                      {formErrors.address && (
                        <span className="text-[10px] text-red-500 block mt-0.5">{formErrors.address}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE3DC] text-xs text-[#52443C]">
                    <div className="font-semibold text-[#2A2421] mb-1">Пункт выдачи заказов:</div>
                    <div>Узбекистан, г. Ташкент (Бутик Flaner Cosmetics)</div>
                    <div className="text-[11px] text-[#8A796F] mt-0.5">Ежедневно с 10:00 до 22:00</div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                    Комментарий для курьера:
                  </label>
                  <input
                    type="text"
                    placeholder="Например: код домофона, ориентир или оставить у консьержа"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421]"
                  />
                </div>
              </div>

              {/* Payment Methods Integration */}
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-[#EAE3DC]">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#6E5C51]">
                  <CreditCard className="w-4 h-4 text-[#C9A227]" />
                  <span>Способ оплаты (Платежная система)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Primary: Online payment to Card */}
                  <label
                    onClick={() => {
                      triggerHaptic('selection');
                      setPaymentMethod('card_online');
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all sm:col-span-2 ${
                      paymentMethod === 'card_online'
                        ? 'border-[#C9A227] bg-[#FAF5E8] ring-2 ring-[#C9A227]'
                        : 'border-[#DFD6CD] bg-white hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#2A2421] text-[#E8C547] flex items-center justify-center flex-shrink-0 shadow-xs">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-[#2A2421]">
                            Онлайн-оплата на карту (Humo / Uzcard)
                          </span>
                          <span className="text-[10px] bg-[#C9A227] text-white px-2 py-0.5 rounded-full font-bold">
                            Рекомендуем
                          </span>
                        </div>
                        {paymentMethod === 'card_online' && (
                          <Check className="w-4 h-4 text-[#C9A227]" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-[#6E5C51]">
                        <span className="font-mono font-semibold text-[#2A2421] bg-white px-1.5 py-0.5 rounded border border-[#DFD6CD]">
                          9860 1701 2205 1080
                        </span>
                        <span>• Перевод через Payme, Click или Uzum Bank</span>
                      </div>
                    </div>
                  </label>

                  {/* Telegram Payments */}
                  <label
                    onClick={() => {
                      triggerHaptic('selection');
                      setPaymentMethod('telegram_payments');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all ${
                      paymentMethod === 'telegram_payments'
                        ? 'border-[#2B5278] bg-[#2B5278]/10 ring-1 ring-[#2B5278]'
                        : 'border-[#DFD6CD] hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#2B5278] text-white flex items-center justify-center flex-shrink-0">
                      <Send className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#2A2421] flex items-center justify-between">
                        <span>Telegram Payments</span>
                        {paymentMethod === 'telegram_payments' && (
                          <Check className="w-3.5 h-3.5 text-[#2B5278]" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#6E5C51] block">
                        Stars / Инвойс в боте
                      </span>
                    </div>
                  </label>

                  {/* Payme */}
                  <label
                    onClick={() => {
                      triggerHaptic('selection');
                      setPaymentMethod('payme');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all ${
                      paymentMethod === 'payme'
                        ? 'border-[#0E7A6E] bg-[#19C5B2]/10 ring-1 ring-[#0E7A6E]'
                        : 'border-[#DFD6CD] hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#19C5B2] text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      P
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#2A2421] flex items-center justify-between">
                        <span>Payme</span>
                        {paymentMethod === 'payme' && (
                          <Check className="w-3.5 h-3.5 text-[#0E7A6E]" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#6E5C51] block">
                        Uzcard / Humo онлайн
                      </span>
                    </div>
                  </label>

                  {/* Click */}
                  <label
                    onClick={() => {
                      triggerHaptic('selection');
                      setPaymentMethod('click');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all ${
                      paymentMethod === 'click'
                        ? 'border-[#0089D0] bg-[#0089D0]/10 ring-1 ring-[#0089D0]'
                        : 'border-[#DFD6CD] hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#0089D0] text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      C
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#2A2421] flex items-center justify-between">
                        <span>Click Evolution</span>
                        {paymentMethod === 'click' && (
                          <Check className="w-3.5 h-3.5 text-[#0089D0]" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#6E5C51] block">
                        Click Pass / QR счет
                      </span>
                    </div>
                  </label>

                  {/* Stripe */}
                  <label
                    onClick={() => {
                      triggerHaptic('selection');
                      setPaymentMethod('stripe');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all ${
                      paymentMethod === 'stripe'
                        ? 'border-[#635BFF] bg-[#635BFF]/10 ring-1 ring-[#635BFF]'
                        : 'border-[#DFD6CD] hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#635BFF] text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      S
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#2A2421] flex items-center justify-between">
                        <span>Stripe</span>
                        {paymentMethod === 'stripe' && (
                          <Check className="w-3.5 h-3.5 text-[#635BFF]" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#6E5C51] block">
                        Visa / Mastercard мир
                      </span>
                    </div>
                  </label>

                  {/* Cash on delivery */}
                  <label
                    onClick={() => {
                      triggerHaptic('selection');
                      setPaymentMethod('cash_on_delivery');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center space-x-3 transition-all sm:col-span-2 ${
                      paymentMethod === 'cash_on_delivery'
                        ? 'border-[#2A2421] bg-[#F5EFEB] ring-1 ring-[#2A2421]'
                        : 'border-[#DFD6CD] hover:border-[#B5A89C]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#5A4D44] text-white flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#2A2421] flex items-center justify-between">
                        <span>Оплата при получении курьеру</span>
                        {paymentMethod === 'cash_on_delivery' && (
                          <Check className="w-3.5 h-3.5 text-[#2A2421]" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#6E5C51] block">
                        Наличными или банковской картой при вручении
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Order Final Summary */}
              <div className="p-4 bg-white rounded-2xl border border-[#EAE3DC] space-y-2 text-xs">
                <div className="flex justify-between text-[#6E5C51]">
                  <span>Позиций в заказе:</span>
                  <span className="font-semibold text-[#2A2421]">{cart.length} шт</span>
                </div>
                <div className="flex justify-between text-[#6E5C51]">
                  <span>Стоимость товаров:</span>
                  <span>{formatPrice(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-[#6E5C51]">
                  <span>Стоимость доставки:</span>
                  <span className={deliveryFee === 0 ? 'text-emerald-700 font-bold' : ''}>
                    {deliveryFee === 0
                      ? deliveryType === 'pickup'
                        ? 'Бесплатно (самовывоз)'
                        : 'Бесплатно (заказ от 2 млн сум)'
                      : formatPrice(deliveryFee, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#2A2421] pt-2 border-t border-[#EAE3DC]">
                  <span>Итого к оплате:</span>
                  <span>{formatPrice(total, currency)}</span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="w-full bg-[#2A2421] hover:bg-[#3D3531] text-white py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl active:scale-98 transition-all"
              >
                <span>Перейти к оплате • {formatPrice(total, currency)}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Payment Gateway Screen */}
      {pendingOrder && (
        <PaymentModal
          order={pendingOrder}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={handlePaymentSuccess}
          currency={currency}
        />
      )}
    </>
  );
};
