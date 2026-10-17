// Client for POST /api/leads. Kept free of React so it can be unit-tested with a fake fetch.
// No imports on purpose: this file is unit-tested directly by Node.

export interface LeadFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  comment: string;
  /** Honeypot: hidden in the form, real shoppers never fill it. */
  website?: string;
}

export interface LeadRequest extends LeadFormValues {
  items: Array<{ productId: string; quantity: number }>;
  idempotencyKey: string;
}

export interface LeadReceipt {
  leadNumber: string;
  status: string;
  createdAt: string;
  itemsTotal: number;
  items: Array<{ productName: string; brand: string; volume: string; unitPrice: number; quantity: number }>;
  /** true when the server returned an earlier identical submission (HTTP 200) instead of creating a new one. */
  replayed: boolean;
}

export type LeadField = 'firstName' | 'lastName' | 'phone' | 'comment' | 'items';

export class LeadSubmitError extends Error {
  /** Server error code (validation_error, out_of_stock, rate_limited, ...) or a client one (network, bad_response). */
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: Partial<Record<LeadField, string>>;

  constructor(message: string, code: string, status = 0, fieldErrors: Partial<Record<LeadField, string>> = {}) {
    super(message);
    this.name = 'LeadSubmitError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const FIELDS: readonly string[] = ['firstName', 'lastName', 'phone', 'comment', 'items'];

export function createIdempotencyKey(): string {
  const webCrypto = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') return `lead-${webCrypto.randomUUID()}`;
  return `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Sends the lead. HTTP 200 (an identical earlier submission) and 201 (created) both mean success.
 * Anything else throws LeadSubmitError, so callers keep the cart on every failure.
 */
export async function postLead(request: LeadRequest, fetchImpl: typeof fetch = fetch): Promise<LeadReceipt> {
  let response: Response;
  try {
    response = await fetchImpl('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
  } catch {
    throw new LeadSubmitError('Не удалось отправить заявку: нет связи с сервером. Корзина сохранена, попробуйте ещё раз.', 'network');
  }

  const body: any = await response.json().catch(() => null);

  if (response.status === 200 || response.status === 201) {
    if (!body || typeof body.leadNumber !== 'string' || !body.leadNumber) {
      throw new LeadSubmitError('Сервер не подтвердил заявку. Корзина сохранена, попробуйте ещё раз.', 'bad_response', response.status);
    }
    return {
      leadNumber: body.leadNumber,
      status: typeof body.status === 'string' ? body.status : 'new',
      createdAt: typeof body.createdAt === 'string' ? body.createdAt : new Date().toISOString(),
      itemsTotal: Number(body.itemsTotal) || 0,
      items: Array.isArray(body.items) ? body.items : [],
      replayed: body.replayed === true
    };
  }

  const fieldErrors: Partial<Record<LeadField, string>> = {};
  if (Array.isArray(body?.details)) {
    for (const detail of body.details) {
      const field = String(detail?.path ?? '').split('.')[0];
      if (FIELDS.includes(field) && typeof detail?.message === 'string' && !fieldErrors[field as LeadField]) {
        fieldErrors[field as LeadField] = detail.message;
      }
    }
  }
  const serverMessage = typeof body?.error === 'string' && body.error ? body.error : null;
  const message = serverMessage ?? 'Не удалось отправить заявку. Корзина сохранена, попробуйте позже.';
  throw new LeadSubmitError(message, typeof body?.code === 'string' ? body.code : 'server_error', response.status, fieldErrors);
}
