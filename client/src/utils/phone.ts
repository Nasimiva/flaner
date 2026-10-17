/**
 * Uzbekistan numbers only; mirrors the server rule (server/src/modules/leads/leadSchemas.ts).
 * Accepts "+998 90 123-45-67", "998901234567" and the 9-digit national form "901234567" and
 * returns "+998901234567", or null when the input is not a plausible number.
 */
export function normalizeUzPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return null;
}
