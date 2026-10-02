import React, { useEffect, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { formatPrice } from '../utils/formatters';
import { triggerHaptic } from '../utils/telegram';
import { normalizeUzPhone } from '../utils/phone';
import { LeadField, LeadReceipt, LeadSubmitError } from '../utils/leadApi';
import { X, Phone, User, CheckCircle, Copy, Check, MessageSquare, AlertCircle, PhoneCall } from 'lucide-react';

type FieldErrors = Partial<Record<LeadField, string>>;

const inputClass = (hasError?: string) =>
  `w-full px-3 py-2 text-xs bg-[#FAF8F5] border rounded-xl focus:outline-none focus:border-[#2A2421] text-[#2A2421] ${
    hasError ? 'border-red-500' : 'border-[#DFD6CD]'
  }`;

export const LeadModal: React.FC = () => {
  const { cart, isLeadFormOpen, setIsLeadFormOpen, currency, submitLead, telegramUser } = useShop();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState(''); // honeypot, hidden from people
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<LeadReceipt | null>(null);
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [copied, setCopied] = useState(false);

  // Pre-fill with the Telegram profile when the shop runs inside Telegram.
  useEffect(() => {
    if (!telegramUser) return;
    setFirstName((current) => current || telegramUser.first_name || '');
    setLastName((current) => current || telegramUser.last_name || '');
  }, [telegramUser]);

  if (!isLeadFormOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const unavailable = cart.filter((item) => !item.product.inStock);

  const close = () => {
    if (isSubmitting) return;
    setIsLeadFormOpen(false);
    if (receipt) {
      // The lead is sent; leave a clean form for the next one.
      setReceipt(null);
      setComment('');
      setErrors({});
      setFormError('');
    }
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!firstName.trim()) next.firstName = 'Укажите имя';
    else if (firstName.trim().length > 60) next.firstName = 'Максимум 60 символов';
    if (!lastName.trim()) next.lastName = 'Укажите фамилию';
    else if (lastName.trim().length > 60) next.lastName = 'Максимум 60 символов';
    if (!normalizeUzPhone(phone)) next.phone = 'Укажите номер Узбекистана, например +998 90 123 45 67';
    if (comment.trim().length > 500) next.comment = 'Максимум 500 символов';
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      triggerHaptic('error');
      return;
    }
    if (unavailable.length > 0) {
      setFormError('Уберите из корзины товары, которых нет в наличии, и отправьте заявку снова.');
      triggerHaptic('error');
      return;
    }

    triggerHaptic('medium');
    setIsSubmitting(true);
    try {
      const result = await submitLead({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        comment: comment.trim(),
        website
      });
      setSubmittedPhone(normalizeUzPhone(phone) ?? phone.trim());
      setReceipt(result);
    } catch (error) {
      // The cart is untouched on every failure, so the shopper can simply try again.
      if (error instanceof LeadSubmitError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Не удалось отправить заявку. Корзина сохранена, попробуйте ещё раз.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyNumber = async () => {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(receipt.leadNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (for example inside a webview); the number is still on screen.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={receipt ? 'Заявка принята' : 'Оставить заявку'}
    >
      <div
        className="w-full max-w-xl bg-[#FAF8F5] rounded-3xl overflow-hidden shadow-2xl border border-[#EAE3DC] my-6 animate-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-white border-b border-[#EAE3DC] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PhoneCall className="w-5 h-5 text-[#2A2421]" />
            <h2 className="text-base font-bold text-[#2A2421]">{receipt ? 'Заявка принята' : 'Оставить заявку'}</h2>
          </div>
          <button
            onClick={close}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-full bg-[#EFE9E2] hover:bg-[#E2D8CE] flex items-center justify-center text-[#4A3E37] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {receipt ? (
          <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar" data-testid="lead-success">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-[#2A2421]">Спасибо! Мы получили вашу заявку</h3>
              <p className="text-xs text-[#6E5C51] leading-relaxed">
                Сотрудник Flaner позвонит вам по номеру <strong className="text-[#2A2421]">{submittedPhone}</strong>, чтобы
                подтвердить заявку и уточнить детали.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#EAE3DC] p-4 text-center space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#8A796F]">Номер вашей заявки</span>
              <div className="flex items-center justify-center space-x-2">
                <span className="font-mono text-xl font-bold tracking-wider text-[#2A2421]" data-testid="lead-number">
                  {receipt.leadNumber}
                </span>
                <button
                  onClick={copyNumber}
                  aria-label="Скопировать номер заявки"
                  className="w-7 h-7 rounded-lg bg-[#F5EFEB] hover:bg-[#E8DDD4] flex items-center justify-center text-[#4A3E37] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-[#8A796F]">Сохраните номер, чтобы назвать его менеджеру.</p>
              {receipt.replayed && (
                <p className="text-[11px] text-[#5C4515] bg-[#FAF5E8] border border-[#E8DCBF] rounded-lg px-2 py-1 inline-block">
                  Эта заявка уже была принята ранее — повторно мы её не создавали.
                </p>
              )}
            </div>

            {receipt.items.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#EAE3DC] p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#6E5C51]">Товары в заявке</div>
                {receipt.items.map((item, index) => (
                  <div key={index} className="flex justify-between gap-3 text-xs text-[#2A2421]">
                    <span className="min-w-0">
                      <span className="font-semibold">{item.brand}</span> — {item.productName}
                      {item.volume ? ` (${item.volume})` : ''} × {item.quantity}
                    </span>
                    <span className="shrink-0 font-semibold">{formatPrice(item.unitPrice * item.quantity, currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-[#2A2421] pt-2 border-t border-[#F2ECE5]">
                  <span>Итого (ориентировочно)</span>
                  <span>{formatPrice(receipt.itemsTotal, currency)}</span>
                </div>
              </div>
            )}

            <button
              onClick={close}
              className="w-full bg-[#2A2421] hover:bg-[#3D3531] text-white py-3 rounded-2xl font-bold text-sm transition-colors"
            >
              Продолжить покупки
            </button>
          </div>
        ) : cart.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-[#6E5C51]">Корзина пуста. Добавьте товары из каталога, чтобы оставить заявку.</p>
            <button onClick={close} className="bg-[#2A2421] text-white text-xs font-semibold px-5 py-2.5 rounded-full">
              Перейти в каталог
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
            {/* Contacts */}
            <div className="space-y-3 bg-white p-4 rounded-2xl border border-[#EAE3DC]">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#6E5C51]">
                <User className="w-4 h-4 text-[#C9A227]" />
                <span>Ваши контакты</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lead-first-name" className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                    Имя: *
                  </label>
                  <input
                    id="lead-first-name"
                    type="text"
                    autoComplete="given-name"
                    maxLength={60}
                    placeholder="Дильноза"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass(errors.firstName)}
                  />
                  {errors.firstName && <span className="text-[10px] text-red-500 block mt-0.5">{errors.firstName}</span>}
                </div>
                <div>
                  <label htmlFor="lead-last-name" className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                    Фамилия: *
                  </label>
                  <input
                    id="lead-last-name"
                    type="text"
                    autoComplete="family-name"
                    maxLength={60}
                    placeholder="Каримова"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass(errors.lastName)}
                  />
                  {errors.lastName && <span className="text-[10px] text-red-500 block mt-0.5">{errors.lastName}</span>}
                </div>
              </div>

              <div>
                <label htmlFor="lead-phone" className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                  Номер телефона: *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A796F]" />
                  <input
                    id="lead-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+998 90 123 45 67"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`${inputClass(errors.phone)} pl-8`}
                  />
                </div>
                {errors.phone && <span className="text-[10px] text-red-500 block mt-0.5">{errors.phone}</span>}
              </div>

              <div>
                <label htmlFor="lead-comment" className="text-[11px] font-medium text-[#6E5C51] block mb-1">
                  Комментарий (необязательно):
                </label>
                <div className="relative">
                  <MessageSquare className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8A796F]" />
                  <textarea
                    id="lead-comment"
                    rows={3}
                    maxLength={500}
                    placeholder="Например: позвоните после 18:00 или нужен другой оттенок"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className={`${inputClass(errors.comment)} pl-8 resize-none`}
                  />
                </div>
                <div className="flex justify-between text-[10px] mt-0.5">
                  <span className="text-red-500">{errors.comment}</span>
                  <span className="text-[#A89A90]">{comment.length}/500</span>
                </div>
              </div>

              {/* Honeypot: invisible and unreachable for people; bots fill every field. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                <label htmlFor="lead-website">Website</label>
                <input
                  id="lead-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>

            {/* What is being requested */}
            <div className="bg-white p-4 rounded-2xl border border-[#EAE3DC] space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[#6E5C51]">Товары из корзины</div>
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between gap-3 text-xs text-[#2A2421]">
                  <span className="min-w-0">
                    <span className="font-semibold">{item.product.brand}</span> — {item.product.name} × {item.quantity}
                    {!item.product.inStock && <span className="ml-1 text-red-600 font-semibold">нет в наличии</span>}
                  </span>
                  <span className="shrink-0 font-semibold">{formatPrice(item.product.price * item.quantity, currency)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-[#2A2421] pt-2 border-t border-[#F2ECE5]">
                <span>Итого (ориентировочно)</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              <p className="text-[11px] text-[#8A796F] leading-relaxed">
                Оплата не требуется. Менеджер позвонит вам, уточнит актуальные цены и наличие и подтвердит заявку.
              </p>
            </div>

            {formError && (
              <div role="alert" className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#2A2421] hover:bg-[#3D3531] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 shadow-md transition-all active:scale-98"
            >
              <span>{isSubmitting ? 'Отправляем…' : 'Отправить заявку'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
