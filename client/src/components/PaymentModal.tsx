import React, { useState } from 'react';
import { Order, PaymentMethod, Currency } from '../types';
import { formatPrice } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegram';
import {
  X,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Lock,
  Loader2,
  Send,
  Smartphone,
  Sparkles,
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

interface PaymentModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedOrder: Order) => void;
  currency: Currency;
}

const STORE_CARD_NUMBER = '9860170122051080';
const STORE_CARD_FORMATTED = '9860 1701 2205 1080';
const STORE_CARD_HOLDER = 'Sherzod T';

export const PaymentModal: React.FC<PaymentModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
  currency
}) => {
  const [step, setStep] = useState<'gateway' | 'processing' | 'success'>('gateway');

  // Online Card state (9860 1701 2205 1080)
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [senderCardInfo, setSenderCardInfo] = useState('');

  // Payme card state
  const [paymeCard, setPaymeCard] = useState('9860170122051080');
  const [paymeExpiry, setPaymeExpiry] = useState('08/28');
  const [paymeOtp, setPaymeOtp] = useState('');
  const [paymeOtpSent, setPaymeOtpSent] = useState(false);

  // Click state
  const [clickPhone, setClickPhone] = useState(order.customer.phone || '+998 90 123 45 67');

  // Stripe state
  const [stripeCard, setStripeCard] = useState('4242 •••• •••• 4242');
  const [stripeExp, setStripeExp] = useState('12/27');
  const [stripeCvc, setStripeCvc] = useState('888');

  // Telegram Payments state
  const [telegramPaymentMethod, setTelegramPaymentMethod] = useState<'stars' | 'card'>('stars');

  if (!isOpen) return null;

  const handleCopyCard = (num: string = STORE_CARD_NUMBER) => {
    try {
      navigator.clipboard.writeText(num);
    } catch {
      // Fallback
    }
    triggerHaptic('light');
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 2500);
  };

  const handleCopyAmount = (amt: number) => {
    try {
      navigator.clipboard.writeText(String(amt));
    } catch {
      // Fallback
    }
    triggerHaptic('light');
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2500);
  };

  // A browser action is never proof of payment. Only a signed provider webhook may
  // later mark an order as paid on the server.
  const handleProcessPayment = (_details?: { senderInfo?: string } | React.MouseEvent) => {
    triggerHaptic('medium');
    setStep('processing');

    setTimeout(() => {
      const updatedOrder: Order = {
        ...order,
        // Never trust a browser to confirm a payment. A real provider webhook must
        // update this on the server after signature verification.
        paymentStatus: 'pending',
        status: 'new'
      };
      setStep('success');
      onSuccess(updatedOrder);
    }, 1800);
  };

  const getGatewayTitle = (method: PaymentMethod) => {
    switch (method) {
      case 'card_online':
        return 'Онлайн-оплата на карту • Humo / Uzcard';
      case 'telegram_payments':
        return 'Telegram Payments • Оплата через бота';
      case 'payme':
        return 'Payme • Платежная система Узбекистана';
      case 'click':
        return 'Click Evolution • Оплата картами Uzcard/Humo';
      case 'stripe':
        return 'Stripe Checkout • Международные карты';
      case 'cash_on_delivery':
        return 'Оплата при получении';
      default:
        return 'Шлюз оплаты';
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#EAE3DC] animate-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 bg-[#2A2421] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-[#C9A227]" />
            <span className="text-xs font-semibold tracking-wide">
              {getGatewayTitle(order.paymentMethod)}
            </span>
          </div>
          {step !== 'processing' && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6">
          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[#EFE9E2] border-t-[#2A2421] animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-[#C9A227]" />
                </div>
              </div>
              <h3 className="text-base font-bold text-[#2A2421]">
                Обработка платежа...
              </h3>
              <p className="text-xs text-[#8A796F] max-w-xs leading-relaxed">
                Безопасное соединение с платежным шлюзом. Пожалуйста, не закрывайте окно мини-приложения.
              </p>
            </div>
          )}

          {step === 'gateway' && (
            <div className="space-y-4">
              {/* Order quick summary */}
              <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EBE4DD] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#8A796F] uppercase font-bold tracking-wider">
                    Заказ {order.orderNumber}
                  </span>
                  <div className="text-xs text-[#52443C] font-medium">
                    {order.items.length} {order.items.length === 1 ? 'позиция' : 'позиции'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#8A796F] block">Сумма к оплате</span>
                  <span className="text-base font-bold text-[#2A2421]">
                    {formatPrice(order.total, currency)}
                  </span>
                </div>
              </div>

              {/* Specific Payment Gateway Forms */}

              {/* 0. ONLINE PAYMENT TO CARD (HUMO / UZCARD 9860 1701 2205 1080) */}
              {order.paymentMethod === 'card_online' && (
                <div className="space-y-4">
                  {/* Virtual Luxury Card */}
                  <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#241F1D] via-[#2F2824] to-[#1C1715] text-white shadow-xl border border-[#4A3F38]">
                    <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-[#C9A227]/15 blur-xl pointer-events-none" />
                    <div className="absolute -left-8 -bottom-8 w-28 h-28 rounded-full bg-[#19C5B2]/10 blur-xl pointer-events-none" />

                    {/* Card Brand & Humo/Uzcard Badges */}
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-[#E8C547]" />
                        <span className="font-serif tracking-widest text-xs font-semibold text-[#E8DDD4]">
                          {STORE_CARD_HOLDER}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#F58220] text-white text-[10px] font-black tracking-wider">
                          HUMO
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#005BAC] text-white text-[10px] font-black tracking-wider">
                          UZCARD
                        </span>
                      </div>
                    </div>

                    {/* Chip Graphic */}
                    <div className="my-3 flex items-center justify-between relative z-10">
                      <div className="w-9 h-6 rounded-md bg-gradient-to-tr from-[#D4AF37] to-[#F3E5AB] border border-[#AA820A] shadow-inner flex items-center justify-center">
                        <div className="w-5 h-3.5 border border-[#8C6B00]/40 rounded-xs"></div>
                      </div>
                      <span className="text-[10px] text-[#C5B8AE] font-medium tracking-wide">
                        Официальная карта для оплаты
                      </span>
                    </div>

                    {/* Card Number & Instant Copy */}
                    <div className="relative z-10 flex items-center justify-between bg-black/40 backdrop-blur-xs px-3.5 py-2.5 rounded-xl border border-white/10 gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] uppercase tracking-wider text-[#A89A90] block">
                          Номер карты бутика
                        </span>
                        <span className="font-mono text-base sm:text-lg font-bold tracking-widest text-white select-all">
                          {STORE_CARD_FORMATTED}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCard(STORE_CARD_NUMBER)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shrink-0 ${
                          copiedCard
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/15 hover:bg-white/25 text-[#E8DDD4]'
                        }`}
                        title="Скопировать номер карты"
                      >
                        {copiedCard ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Скопировать</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Card Holder & Expiry */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#C5B8AE] relative z-10">
                      <div>
                        <span className="text-[9px] text-[#8A796F] block uppercase">Держатель</span>
                        <span className="font-semibold text-white tracking-wider">{STORE_CARD_HOLDER}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-[#8A796F] block uppercase">Срок</span>
                        <span className="font-mono font-semibold text-white">08/28</span>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Amount Banner */}
                  <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EAE3DC] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#8A796F] uppercase font-bold tracking-wider block">
                        Точная сумма к переводу:
                      </span>
                      <span className="text-base font-bold text-[#2A2421]">
                        {formatPrice(order.total, currency)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAmount(order.total)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all ${
                        copiedAmount
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-white border border-[#DFD6CD] text-[#52443C] hover:bg-[#F2ECE5]'
                      }`}
                    >
                      {copiedAmount ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Сумма скопирована</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Скопировать сумму</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 1-Click Banking App Deep Links */}
                  <div>
                    <span className="text-[11px] font-bold text-[#6E5C51] uppercase tracking-wider block mb-1.5">
                      Оплатить в приложении банка:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <a
                        href="https://payme.uz/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl border border-[#19C5B2]/30 bg-[#19C5B2]/10 hover:bg-[#19C5B2]/20 flex flex-col items-center text-center transition-all group"
                      >
                        <span className="w-7 h-7 rounded-lg bg-[#19C5B2] text-white font-bold text-xs flex items-center justify-center mb-1 shadow-xs group-hover:scale-105 transition-transform">
                          P
                        </span>
                        <span className="text-xs font-bold text-[#0E7A6E]">Payme</span>
                        <span className="text-[10px] text-[#7A6B62]">Перевод</span>
                      </a>

                      <a
                        href="https://click.uz/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl border border-[#0089D0]/30 bg-[#0089D0]/10 hover:bg-[#0089D0]/20 flex flex-col items-center text-center transition-all group"
                      >
                        <span className="w-7 h-7 rounded-lg bg-[#0089D0] text-white font-bold text-xs flex items-center justify-center mb-1 shadow-xs group-hover:scale-105 transition-transform">
                          C
                        </span>
                        <span className="text-xs font-bold text-[#006BB3]">Click</span>
                        <span className="text-[10px] text-[#7A6B62]">Перевод</span>
                      </a>

                      <a
                        href="https://uzumbank.uz/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl border border-[#7000FF]/30 bg-[#7000FF]/10 hover:bg-[#7000FF]/20 flex flex-col items-center text-center transition-all group"
                      >
                        <span className="w-7 h-7 rounded-lg bg-[#7000FF] text-white font-bold text-xs flex items-center justify-center mb-1 shadow-xs group-hover:scale-105 transition-transform">
                          U
                        </span>
                        <span className="text-xs font-bold text-[#5B00D1]">Uzum</span>
                        <span className="text-[10px] text-[#7A6B62]">Банк</span>
                      </a>
                    </div>
                  </div>

                  {/* Sender Verification Input */}
                  <div>
                    <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                      Номер вашей карты или имя отправителя (для сверки):
                    </label>
                    <input
                      type="text"
                      placeholder="Например: 9860 **** 4321 или Фамилия Имя"
                        value={senderCardInfo}
                        disabled
                      onChange={(e) => setSenderCardInfo(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl text-[#2A2421] focus:outline-none focus:border-[#2A2421]"
                    />
                  </div>

                  {/* Confirmation Button */}
                  <button
                    onClick={() => handleProcessPayment({ senderInfo: senderCardInfo })}
                    className="w-full bg-[#2A2421] hover:bg-[#3D3531] text-white py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#E8C547]" />
                    <span>Я оплатил(а) {formatPrice(order.total, currency)}</span>
                  </button>
                </div>
              )}

              {/* 1. TELEGRAM PAYMENTS */}
              {order.paymentMethod === 'telegram_payments' && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-[#2B5278]/10 rounded-2xl border border-[#2B5278]/20 space-y-2">
                    <div className="flex items-center space-x-2 text-[#2B5278]">
                      <Send className="w-4 h-4" />
                      <span className="text-xs font-bold">
                        Telegram In-App Payments
                      </span>
                    </div>
                    <p className="text-xs text-[#3E5C76] leading-relaxed">
                      Оплата производится через встроенный защищенный платежный механизм Telegram WebApp с поддержкой Telegram Stars или привязанной карты.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTelegramPaymentMethod('stars')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        telegramPaymentMethod === 'stars'
                          ? 'border-[#2B5278] bg-[#2B5278]/5 ring-1 ring-[#2B5278]'
                          : 'border-[#DFD6CD] bg-white'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 mb-1">
                        <Sparkles className="w-4 h-4 text-[#C9A227]" />
                        <span className="text-xs font-bold text-[#2A2421]">
                          Telegram Stars
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8A796F] block">
                        Мгновенно в Telegram
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTelegramPaymentMethod('card')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        telegramPaymentMethod === 'card'
                          ? 'border-[#2B5278] bg-[#2B5278]/5 ring-1 ring-[#2B5278]'
                          : 'border-[#DFD6CD] bg-white'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 mb-1">
                        <CreditCard className="w-4 h-4 text-[#2B5278]" />
                        <span className="text-xs font-bold text-[#2A2421]">
                          Карта в боте
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8A796F] block">
                        Uzcard / Visa / MC
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={handleProcessPayment}
                    className="w-full bg-[#2B5278] hover:bg-[#204060] text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Подтвердить оплату в Telegram</span>
                  </button>
                </div>
              )}

              {/* 2. PAYME */}
              {order.paymentMethod === 'payme' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-[#19C5B2]/10 p-2.5 rounded-xl border border-[#19C5B2]/30">
                    <span className="text-xs font-bold text-[#0E7A6E]">
                      Payme Checkout
                    </span>
                    <span className="text-[10px] bg-[#19C5B2] text-white px-2 py-0.5 rounded-full font-semibold">
                      Uzcard / Humo
                    </span>
                  </div>

                  {!paymeOtpSent ? (
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                          Номер карты (Uzcard или Humo):
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A796F]" />
                          <input
                            type="text"
                            value={paymeCard}
                            disabled
                            onChange={(e) => setPaymeCard(e.target.value)}
                            placeholder="8600 0000 0000 0000"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl font-mono text-[#2A2421]"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                            Срок действия:
                          </label>
                          <input
                            type="text"
                            value={paymeExpiry}
                            disabled
                            onChange={(e) => setPaymeExpiry(e.target.value)}
                            placeholder="ММ/ГГ"
                            className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl font-mono text-[#2A2421]"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                            Телефон:
                          </label>
                          <input
                            type="text"
                            disabled
                            value={order.customer.phone}
                            className="w-full px-3 py-2 text-xs bg-[#EFE9E2] border border-[#DFD6CD] rounded-xl text-[#7A6B62]"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setPaymeOtpSent(true);
                        }}
                        className="w-full bg-[#0E7A6E] hover:bg-[#0B6359] text-white py-2.5 rounded-xl font-semibold text-xs transition-colors"
                      >
                        Получить СМС-код подтверждения
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-[#FAF8F5] p-3 rounded-xl border border-[#DFD6CD]">
                      <span className="text-xs text-[#52443C] font-medium block">
                        Код из SMS отправлен на номер {order.customer.phone}
                      </span>
                      <input
                        type="text"
                        placeholder="Код подтверждения (например 123456)"
                        value={paymeOtp}
                        disabled
                        onChange={(e) => setPaymeOtp(e.target.value)}
                        className="w-full px-3 py-2 text-sm text-center tracking-widest bg-white border border-[#DFD6CD] rounded-xl font-mono"
                        maxLength={6}
                      />
                      <button
                        onClick={handleProcessPayment}
                        className="w-full bg-[#0E7A6E] hover:bg-[#0B6359] text-white py-2.5 rounded-xl font-bold text-xs transition-colors"
                      >
                        Оплатить {formatPrice(order.total, currency)}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. CLICK */}
              {order.paymentMethod === 'click' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-[#0089D0]/10 p-2.5 rounded-xl border border-[#0089D0]/30">
                    <span className="text-xs font-bold text-[#006BB3]">
                      Click Evolution
                    </span>
                    <span className="text-[10px] bg-[#0089D0] text-white px-2 py-0.5 rounded-full font-semibold">
                      Click Pass / QR
                    </span>
                  </div>

                  <div className="text-center p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE3DC] space-y-2">
                    <QrCode className="w-16 h-16 mx-auto text-[#006BB3]" />
                    <span className="text-[11px] text-[#7A6B62] block">
                      Отсканируйте QR в приложении Click или оплатите по номеру:
                    </span>
                    <input
                      type="text"
                      value={clickPhone}
                      onChange={(e) => setClickPhone(e.target.value)}
                      className="w-full text-center py-2 text-xs bg-white border border-[#DFD6CD] rounded-xl font-semibold text-[#2A2421]"
                    />
                  </div>

                  <button
                    onClick={handleProcessPayment}
                    className="w-full bg-[#0089D0] hover:bg-[#0074B0] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-sm"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Выставить счет в Click</span>
                  </button>
                </div>
              )}

              {/* 4. STRIPE */}
              {order.paymentMethod === 'stripe' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-[#635BFF]/10 p-2.5 rounded-xl border border-[#635BFF]/30">
                    <span className="text-xs font-bold text-[#4B45C6]">
                      Stripe Global Checkout
                    </span>
                    <span className="text-[10px] bg-[#635BFF] text-white px-2 py-0.5 rounded-full font-semibold">
                      Visa / Mastercard / Apple Pay
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                        Номер международной карты:
                      </label>
                      <input
                        type="text"
                      value={stripeCard}
                      disabled
                        onChange={(e) => setStripeCard(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl font-mono text-[#2A2421]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                          Срок:
                        </label>
                        <input
                          type="text"
                        value={stripeExp}
                        disabled
                          onChange={(e) => setStripeExp(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl font-mono text-[#2A2421]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                          CVC / CVV:
                        </label>
                        <input
                          type="password"
                        value={stripeCvc}
                        disabled
                          onChange={(e) => setStripeCvc(e.target.value)}
                          maxLength={4}
                          className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#DFD6CD] rounded-xl font-mono text-[#2A2421]"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleProcessPayment}
                    className="w-full bg-[#635BFF] hover:bg-[#5249D4] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay with Stripe • {formatPrice(order.total, currency)}</span>
                  </button>
                </div>
              )}

              {/* 5. CASH ON DELIVERY */}
              {order.paymentMethod === 'cash_on_delivery' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE3DC] text-xs text-[#52443C] leading-relaxed">
                    Вы сможете оплатить заказ курьеру наличными или картой через мобильный терминал при получении по адресу:
                    <div className="font-semibold text-[#2A2421] mt-1">
                      {order.customer.city}, {order.customer.address}
                    </div>
                  </div>

                  <button
                    onClick={handleProcessPayment}
                    className="w-full bg-[#2A2421] hover:bg-[#3D3531] text-white py-3 rounded-xl font-bold text-xs transition-colors"
                  >
                    Подтвердить оформление заказа
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center space-x-1.5 text-[10px] text-[#8A796F] pt-2">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Защищенный SSL 256-bit платежный протокол</span>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm animate-scale">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs uppercase tracking-widest font-bold text-[#8A796F]">
                  Заказ успешно оплачен!
                </span>
                <h3 className="text-xl font-bold text-[#2A2421] mt-1">
                  Номер заказа: {order.orderNumber}
                </h3>
                <p className="text-xs text-[#6E5C51] mt-1">
                  Электронный чек сформирован и отправлен в ваш Telegram.
                </p>
              </div>

              {/* Electronic Receipt Summary Box */}
              <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE3DC] text-left text-xs space-y-1.5">
                <div className="flex justify-between text-[#8A796F]">
                  <span>Получатель:</span>
                  <span className="font-semibold text-[#2A2421]">{order.customer.fullName}</span>
                </div>
                <div className="flex justify-between text-[#8A796F]">
                  <span>Телефон:</span>
                  <span className="font-semibold text-[#2A2421]">{order.customer.phone}</span>
                </div>
                <div className="flex justify-between text-[#8A796F]">
                  <span>Адрес доставки:</span>
                  <span className="font-semibold text-[#2A2421]">{order.customer.address}</span>
                </div>
                <div className="flex justify-between text-[#8A796F]">
                  <span>Способ оплаты:</span>
                  <span className="font-semibold text-[#2A2421] text-right">
                    {order.paymentMethod === 'card_online'
                      ? 'Онлайн на карту (Humo 9860 1701 2205 1080)'
                      : order.paymentMethod.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#DFD6CD] font-bold text-[#2A2421]">
                  <span>Оплачено:</span>
                  <span>{formatPrice(order.total, currency)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 bg-[#2A2421] hover:bg-[#3D3531] text-white py-3 rounded-xl font-bold text-xs transition-colors"
                >
                  Вернуться в магазин
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
