// Client for the admin-only inventory endpoints (/api/admin/inventory): stock, sales, cost price, journal, report.
// They need the admin session cookie, which the browser sends automatically for same-origin requests.
// Nothing here is ever requested by the storefront. Free of React so it can be unit-tested directly by Node.

import { request } from './adminLeadsApi.ts';

type FetchLike = typeof fetch;

export const LOW_STOCK_LIMIT = 2;

export interface StockItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  volume: string;
  price: number;
  costPrice: number;
  stockCount: number;
  inStock: boolean;
}

export interface StockTotals {
  products: number;
  units: number;
  costValue: number;
  retailValue: number;
}

export interface StockList {
  items: StockItem[];
  brands: string[];
  lowStockLimit: number;
  totals: StockTotals;
}

export type MovementKind = 'receipt' | 'sale' | 'sale_cancel' | 'adjustment';

export interface Movement {
  id: string;
  productId: string | null;
  productName: string;
  brand: string;
  kind: MovementKind;
  delta: number;
  stockAfter: number;
  unitPrice: number | null;
  listPrice: number | null;
  unitCost: number | null;
  note: string | null;
  actor: string;
  cancelled: boolean;
  cancelOf: string | null;
  createdAt: string;
}

export interface MovementPage {
  items: Movement[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ReportLine {
  productId: string | null;
  name: string;
  brand: string;
  salesCount: number;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface ReportStockEntry {
  id: string;
  name: string;
  brand: string;
  stockCount: number;
}

export interface MonthlyReport {
  month: string;
  lines: ReportLine[];
  totals: { salesCount: number; quantity: number; revenue: number; cost: number; profit: number };
  lowStockLimit: number;
  outOfStock: ReportStockEntry[];
  lowStock: ReportStockEntry[];
}

export interface StockFilters {
  q?: string;
  category?: string;
  brand?: string;
  stock?: 'all' | 'zero' | 'low' | 'in';
}

export interface MovementFilters {
  productId?: string;
  kind?: MovementKind | '';
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

const BASE = '/api/admin/inventory';
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
const looksLikeProductResult = (body: any) => Boolean(body?.product) && typeof body.product.id === 'string';

export function listStock(filters: StockFilters, fetchImpl: FetchLike = fetch): Promise<StockList> {
  const query = new URLSearchParams();
  if (filters.q?.trim()) query.set('q', filters.q.trim());
  if (filters.category) query.set('category', filters.category);
  if (filters.brand) query.set('brand', filters.brand);
  if (filters.stock && filters.stock !== 'all') query.set('stock', filters.stock);
  return request<StockList>(`${BASE}/products?${query}`, undefined, fetchImpl, (body) => Boolean(body) && Array.isArray(body.items) && Boolean(body.totals));
}

export interface StockResult {
  product: StockItem;
  movement: Movement | null;
}

export const addReceipt = (id: string, input: { quantity: number; costPrice?: number; note?: string }, fetchImpl: FetchLike = fetch) =>
  request<StockResult>(`${BASE}/products/${encodeURIComponent(id)}/receipt`, json('POST', input), fetchImpl, looksLikeProductResult);

/** `unitPrice` omitted means the regular price. */
export const sellProduct = (id: string, input: { quantity: number; unitPrice?: number; note?: string }, fetchImpl: FetchLike = fetch) =>
  request<StockResult>(`${BASE}/products/${encodeURIComponent(id)}/sale`, json('POST', input), fetchImpl, looksLikeProductResult);

export const setStock = (id: string, stockCount: number, note?: string, fetchImpl: FetchLike = fetch) =>
  request<StockResult>(`${BASE}/products/${encodeURIComponent(id)}/stock`, json('PUT', { stockCount, note }), fetchImpl, looksLikeProductResult);

export const setCostPrice = (id: string, costPrice: number, fetchImpl: FetchLike = fetch) =>
  request<{ product: StockItem }>(`${BASE}/products/${encodeURIComponent(id)}/cost-price`, json('PUT', { costPrice }), fetchImpl, looksLikeProductResult);

export const cancelSale = (movementId: string, fetchImpl: FetchLike = fetch) =>
  request<{ product: StockItem; sale: Movement; movement: Movement }>(`${BASE}/movements/${encodeURIComponent(movementId)}/cancel`, { method: 'POST' }, fetchImpl,
    (body) => Boolean(body?.sale) && Boolean(body?.movement));

export function listMovements(filters: MovementFilters, fetchImpl: FetchLike = fetch): Promise<MovementPage> {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) });
  if (filters.productId) query.set('productId', filters.productId);
  if (filters.kind) query.set('kind', filters.kind);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  return request<MovementPage>(`${BASE}/movements?${query}`, undefined, fetchImpl, (body) => Boolean(body) && Array.isArray(body.items) && typeof body.total === 'number');
}

export const getReport = (month: string, fetchImpl: FetchLike = fetch) =>
  request<MonthlyReport>(`${BASE}/report?month=${encodeURIComponent(month)}`, undefined, fetchImpl, (body) => Boolean(body) && Array.isArray(body.lines) && Boolean(body.totals));

export const reportCsvUrl = (month: string) => `${BASE}/report.csv?month=${encodeURIComponent(month)}`;

// ---- presentation helpers -------------------------------------------------------------------

export const MOVEMENT_LABELS: Record<MovementKind, string> = {
  receipt: 'Приход',
  sale: 'Продажа',
  sale_cancel: 'Отмена продажи',
  adjustment: 'Пересчёт'
};

/** The current month as "YYYY-MM" in Tashkent time, which is how the server counts shop days. */
export function currentMonth(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 7);
}

export const formatSum = (amount: number): string => `${Math.round(amount).toLocaleString('ru-RU')} сум`;

/** Stock level of an item: how the admin screens colour and word it. */
export function stockLevel(count: number): 'zero' | 'low' | 'ok' {
  if (count <= 0) return 'zero';
  return count <= LOW_STOCK_LIMIT ? 'low' : 'ok';
}

export function stockTotals(items: StockItem[]): StockTotals {
  return items.reduce<StockTotals>((sum, item) => ({
    products: sum.products + 1,
    units: sum.units + item.stockCount,
    costValue: sum.costValue + item.stockCount * item.costPrice,
    retailValue: sum.retailValue + item.stockCount * item.price
  }), { products: 0, units: 0, costValue: 0, retailValue: 0 });
}

/** Parses an input the admin typed: empty -> undefined; otherwise a number (spaces and a decimal comma tolerated). */
export function parseAmount(raw: string): number | undefined {
  const text = raw.replace(/\s/g, '').replace(',', '.');
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}
