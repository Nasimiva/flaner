import type { Currency } from '../types';

type PriceLang = 'ru' | 'uz';

// Exchange rates relative to base UZS
const RATES: Record<Currency, number> = {
  UZS: 1,
  RUB: 1 / 140, // 1 RUB ~ 140 UZS
  USD: 1 / 12800, // 1 USD ~ 12,800 UZS
};

export function formatPrice(amountInUzs: number, currency: Currency = 'UZS', lang: PriceLang = 'ru'): string {
  const sum = lang === 'uz' ? "so'm" : 'сум';
  if (currency === 'UZS') {
    const formatted = Math.round(amountInUzs).toLocaleString('ru-RU');
    return `${formatted} ${sum}`;
  }

  if (currency === 'RUB') {
    const rubAmount = Math.round(amountInUzs * RATES.RUB);
    return `${rubAmount.toLocaleString('ru-RU')} ₽`;
  }

  if (currency === 'USD') {
    const usdAmount = (amountInUzs * RATES.USD).toFixed(2);
    return `$${usdAmount}`;
  }

  return `${amountInUzs} ${sum}`;
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}
