import { z } from 'zod';

export const LEAD_STATUSES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Forward-only flow. completed and cancelled are final: a closed lead can never be reopened. */
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ['contacted', 'cancelled'],
  contacted: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

export const MAX_ITEMS_PER_LEAD = 30;
export const MAX_QUANTITY_PER_ITEM = 20;

/**
 * Uzbekistan numbers only. Accepts "+998 90 123-45-67", "998901234567" and the 9-digit national
 * form "901234567"; returns "+998901234567", or null when the input is not a plausible number.
 */
export function normalizeUzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return null;
}

const name = (label: string) =>
  z.string({ error: `${label}: укажите значение` }).trim().min(1, `${label}: укажите значение`).max(60, `${label}: максимум 60 символов`);

export const createLeadSchema = z.object({
  firstName: name('Имя'),
  lastName: name('Фамилия'),
  phone: z
    .string({ error: 'Телефон: укажите номер' })
    .trim()
    .max(32, 'Телефон: слишком длинный номер')
    .refine((value) => normalizeUzPhone(value) !== null, 'Телефон: укажите номер Узбекистана, например +998 90 123 45 67')
    .transform((value) => normalizeUzPhone(value) as string),
  comment: z
    .string()
    .trim()
    .max(500, 'Комментарий: максимум 500 символов')
    .nullish()
    .transform((value) => (value ? value : null)),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(100),
        quantity: z.number().int('Количество должно быть целым числом').min(1, 'Минимальное количество: 1').max(MAX_QUANTITY_PER_ITEM, `Максимум ${MAX_QUANTITY_PER_ITEM} шт. одного товара`)
      })
    )
    .min(1, 'Корзина пуста')
    .max(MAX_ITEMS_PER_LEAD, `Максимум ${MAX_ITEMS_PER_LEAD} позиций в заявке`),
  idempotencyKey: z.string({ error: 'idempotencyKey обязателен' }).trim().min(8).max(100),
  // Raw Telegram.WebApp.initData. Optional; only trusted after server-side signature verification.
  initData: z.string().max(4096).optional()
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const listLeadsQuerySchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const updateLeadSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    staffNote: z.string().trim().max(2000, 'Заметка: максимум 2000 символов').nullable().optional()
  })
  .refine((value) => value.status !== undefined || value.staffNote !== undefined, 'Укажите status и/или staffNote');
