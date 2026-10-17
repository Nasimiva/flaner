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

/** An old price only means something as a discount when it is higher than the current price (0 or equal = no discount). */
export function hasOldPrice<T extends { price: number; oldPrice?: number | null }>(product: T): product is T & { oldPrice: number } {
  return typeof product.oldPrice === 'number' && Number.isFinite(product.oldPrice) && product.oldPrice > product.price;
}

/** The value to store for a product's old price: unset unless it is higher than the price. */
export function oldPriceToSave(price: number, oldPrice: number): number | undefined {
  return Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : undefined;
}

/**
 * The site has no customer review system, so a rating is shown only when the product carries a real review
 * count. Products without reviews (reviewsCount 0) show no stars and no "N reviews" line.
 */
export function hasReviews<T extends { rating: number; reviewsCount: number }>(product: T): boolean {
  return Number.isInteger(product.reviewsCount) && product.reviewsCount > 0 && Number.isFinite(product.rating) && product.rating > 0;
}
