import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifiedTelegramUser {
  id: number;
  username: string | null;
}

/**
 * Verifies Telegram Mini App `initData` (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Returns the user only when the HMAC signature made with the bot token is valid and `auth_date`
 * is recent. Anything else returns null: callers must treat the shopper as an anonymous guest.
 */
export function verifyTelegramInitData(
  initData: string | undefined,
  botToken: string,
  maxAgeSeconds: number,
  nowMs = Date.now()
): VerifiedTelegramUser | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isInteger(authDate) || authDate <= 0) return null;
  const ageSeconds = nowMs / 1000 - authDate;
  if (ageSeconds > maxAgeSeconds || ageSeconds < -60) return null;

  try {
    const user = JSON.parse(params.get('user') ?? '') as { id?: unknown; username?: unknown };
    if (typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0) return null;
    return { id: user.id, username: typeof user.username === 'string' && user.username ? user.username : null };
  } catch {
    return null;
  }
}
