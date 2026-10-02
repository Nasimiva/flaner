// Client for the admin leads endpoints (/api/admin/leads). They are protected by the existing admin session
// cookie, which the browser sends automatically for same-origin requests.
// Kept free of React and of imports so it can be unit-tested directly by Node.

export const LEAD_STATUSES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Mirrors the server (server/src/modules/leads/leadSchemas.ts). completed and cancelled are final. */
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ['contacted', 'cancelled'],
  contacted: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

export interface AdminLeadItem {
  productId: string | null;
  productName: string;
  brand: string;
  volume: string;
  unitPrice: number;
  quantity: number;
}

export interface AdminLeadHistory {
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  actor: string;
  createdAt: string;
}

export interface AdminLead {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  comment: string | null;
  status: LeadStatus;
  staffNote: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  source: 'web' | 'telegram';
  itemsTotal: number;
  createdAt: string;
  updatedAt: string;
  contactedAt: string | null;
  items: AdminLeadItem[];
  /** Only present on the detail response. */
  history?: AdminLeadHistory[];
}

export interface AdminLeadPage {
  items: AdminLead[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListLeadsParams {
  status?: LeadStatus;
  q?: string;
  page: number;
  pageSize: number;
}

export interface LeadPatch {
  status?: LeadStatus;
  /** null or empty string clears the note. */
  staffNote?: string | null;
}

export class AdminApiError extends Error {
  /** Server error code, or a client one: network, unauthorized, bad_response. */
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 0) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.status = status;
  }
}

type FetchLike = typeof fetch;

async function request<T>(url: string, init: RequestInit | undefined, fetchImpl: FetchLike, isValid: (body: any) => boolean): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new AdminApiError('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.', 'network');
  }
  const body: any = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new AdminApiError('Сессия администратора истекла. Войдите заново.', 'unauthorized', 401);
  }
  if (!response.ok) {
    const message = typeof body?.error === 'string' && body.error ? body.error : `Ошибка сервера (${response.status}).`;
    throw new AdminApiError(message, typeof body?.code === 'string' ? body.code : 'server_error', response.status);
  }
  if (!isValid(body)) throw new AdminApiError('Сервер вернул неожиданный ответ.', 'bad_response', response.status);
  return body as T;
}

const looksLikeLead = (body: any) => Boolean(body) && typeof body.id === 'string' && typeof body.leadNumber === 'string' && Array.isArray(body.items);

/**
 * Phones are stored as "+998901234567", so a query typed like "+998 90 123-45" is reduced to its digits
 * before searching; anything else (names, FL-XXXX numbers) is only trimmed.
 */
export function normalizeLeadSearch(raw: string): string {
  const text = raw.trim();
  if (/^[+\d\s().-]+$/.test(text) && /\d/.test(text)) return text.replace(/\D/g, '');
  return text;
}

export function listLeads(params: ListLeadsParams, fetchImpl: FetchLike = fetch): Promise<AdminLeadPage> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  const q = params.q ? normalizeLeadSearch(params.q) : '';
  if (q) query.set('q', q);
  query.set('page', String(params.page));
  query.set('pageSize', String(params.pageSize));
  return request<AdminLeadPage>(`/api/admin/leads?${query}`, undefined, fetchImpl,
    (body) => Boolean(body) && Array.isArray(body.items) && typeof body.total === 'number');
}

export function getLead(id: string, fetchImpl: FetchLike = fetch): Promise<AdminLead> {
  return request<AdminLead>(`/api/admin/leads/${encodeURIComponent(id)}`, undefined, fetchImpl, looksLikeLead);
}

export function updateLead(id: string, patch: LeadPatch, fetchImpl: FetchLike = fetch): Promise<AdminLead> {
  // Only the fields that were provided are sent, so a note edit can never change the status and vice versa.
  const body: LeadPatch = {};
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.staffNote !== undefined) body.staffNote = patch.staffNote;
  return request<AdminLead>(`/api/admin/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, fetchImpl, looksLikeLead);
}

// ---- presentation helpers -------------------------------------------------------------------

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новая',
  contacted: 'Связались',
  confirmed: 'Подтверждена',
  completed: 'Выполнена',
  cancelled: 'Отменена'
};

/** The caption of the button that moves a lead to `status`. */
export const LEAD_ACTION_LABELS: Record<LeadStatus, string> = {
  new: 'Вернуть в новые',
  contacted: 'Связались с клиентом',
  confirmed: 'Подтвердить заявку',
  completed: 'Завершить (выполнена)',
  cancelled: 'Отменить заявку'
};

const PHONE_RE = /^\+998\d{9}$/;
const TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;

/** "+998901234567" -> "+998 90 123 45 67". Anything unexpected is returned unchanged. */
export function formatPhone(phone: string): string {
  return PHONE_RE.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 9)} ${phone.slice(9, 11)} ${phone.slice(11, 13)}` : phone;
}

/** A tel: link only for a well-formed number, never for arbitrary text. */
export function telHref(phone: string): string | null {
  return PHONE_RE.test(phone) ? `tel:${phone}` : null;
}

/** A t.me link only for a valid Telegram username. */
export function telegramHref(username: string | null): string | null {
  return username && TELEGRAM_USERNAME_RE.test(username) ? `https://t.me/${username}` : null;
}
