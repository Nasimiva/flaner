export type CategoryId = 'face-care' | 'makeup' | 'perfume' | 'brands';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: CategoryId;
  price: number; // In base currency (UZS)
  oldPrice?: number;
  rating: number;
  reviewsCount: number;
  volume: string; // e.g., '50 мл', '100 мл', '30 мл'
  images: string[];
  description: string;
  composition: string; // INCI / Состав
  howToUse?: string;
  skinType?: string; // e.g., 'Для всех типов кожи', 'Сухая и чувствительная'
  inStock: boolean;
  stockCount: number;
  isNew?: boolean;
  isBestseller?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = 'card_online' | 'telegram_payments' | 'payme' | 'click' | 'stripe' | 'cash_on_delivery';

export type OrderStatus = 'new' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderCustomer {
  fullName: string;
  phone: string;
  telegramUsername?: string;
  telegramId?: string | number;
  address: string;
  city: string;
  comment?: string;
  deliveryType: 'courier' | 'express' | 'pickup';
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  customer: OrderCustomer;
  items: {
    productId: string;
    productName: string;
    brand: string;
    image: string;
    price: number;
    volume: string;
    quantity: number;
  }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'paid' | 'pending' | 'failed';
  status: OrderStatus;
  promoCode?: string;
}

export type Currency = 'UZS' | 'RUB' | 'USD';

export interface TelegramWebAppUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}
