import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// CORS: allow requests from the Vite dev server in development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (process.env.NODE_ENV !== 'production' && origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Never put production secrets in source code. Set them in the deployment environment.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let configuredAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const ADMIN_ACCESS_CODE = process.env.ADMIN_ACCESS_CODE || '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';
const ADMIN_EMAIL_ALLOWLIST = new Set(
  (process.env.ADMIN_EMAIL_ALLOWLIST || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
);
const SESSION_COOKIE = 'flaner_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getCookie(req: express.Request, name: string): string | undefined {
  const entry = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

function signSession(email: string, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ email, expiresAt })).toString('base64url');
  const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifySession(token?: string): { email: string } | null {
  if (!token || !ADMIN_SESSION_SECRET) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { email?: string; expiresAt?: number };
    if (!data.email || !data.expiresAt || data.expiresAt < Date.now() || !ADMIN_EMAIL_ALLOWLIST.has(data.email)) return null;
    return { email: data.email };
  } catch { return null; }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = verifySession(getCookie(req, SESSION_COOKIE));
  if (!session) return res.status(401).json({ error: 'Administrator authentication required' });
  res.locals.admin = session;
  next();
}

function setSessionCookie(res: express.Response, token: string, maxAge = SESSION_TTL_SECONDS) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

// In-memory log of telegram notifications
interface TelegramLogEntry {
  id: string;
  timestamp: string;
  type: 'order' | 'status' | 'test';
  recipient: string;
  status: 'sent' | 'failed';
  error?: string;
  textSnippet: string;
}
const telegramLogs: TelegramLogEntry[] = [];

// Helper function to send message via Telegram Bot API
async function sendTelegramMessage(chatId: string | number, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Telegram Bot Token is not configured');
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true
    })
  });

  const data = await response.json() as { ok: boolean; description?: string; result?: unknown };
  if (!data.ok) {
    throw new Error(data.description || 'Failed to send Telegram message');
  }

  return data.result;
}

// ======================== API ROUTES ========================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'flaner_cosmetics' });
});

app.get('/api/admin/session', (req, res) => {
  const session = verifySession(getCookie(req, SESSION_COOKIE));
  res.json({ authenticated: !!session, email: session?.email });
});

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const configured = Boolean(ADMIN_ACCESS_CODE && ADMIN_SESSION_SECRET && ADMIN_EMAIL_ALLOWLIST.size);
  const matchesCode = configured && code.length === ADMIN_ACCESS_CODE.length && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(ADMIN_ACCESS_CODE));
  if (!configured || !ADMIN_EMAIL_ALLOWLIST.has(email) || !matchesCode) {
    loginAttempts.set(ip, { count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1, resetAt: now + 15 * 60 * 1000 });
    return res.status(401).json({ error: 'Invalid email or access code' });
  }
  loginAttempts.delete(ip);
  setSessionCookie(res, signSession(email, now + SESSION_TTL_SECONDS * 1000));
  res.json({ authenticated: true, email });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  setSessionCookie(res, '', 0);
  res.json({ success: true });
});

// Check Telegram Bot connection status and get bot profile
app.get('/api/telegram/status', requireAdmin, async (req, res) => {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
    const response = await fetch(url);
    const data = await response.json() as { ok: boolean; result?: { id: number; username: string; first_name: string } };

    if (data.ok && data.result) {
      res.json({
        connected: true,
        bot: {
          id: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
          link: `https://t.me/${data.result.username}`
        },
        adminChatConfigured: !!configuredAdminChatId,
        adminChatId: configuredAdminChatId
      });
    } else {
      res.status(502).json({
        connected: false,
        error: 'Telegram API returned unsuccessful status'
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ connected: false, error: message });
  }
});

// Get recent updates (helps admin discover their Chat ID after messaging the bot)
app.get('/api/telegram/updates', requireAdmin, async (req, res) => {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=10`;
    const response = await fetch(url);
    const data = await response.json() as { ok: boolean; result?: Array<{ message?: { from?: { id: number; first_name?: string; username?: string }; text?: string; chat?: { id: number; title?: string; type?: string } } }> };

    if (data.ok && Array.isArray(data.result)) {
      const recentUsers = data.result
        .filter(u => u.message && u.message.chat)
        .map(u => ({
          chatId: u.message!.chat!.id,
          type: u.message!.chat!.type,
          name: u.message!.from?.first_name || u.message!.chat?.title || 'Unknown',
          username: u.message!.from?.username ? `@${u.message!.from.username}` : undefined,
          lastText: u.message!.text
        }));

      res.json({ ok: true, success: true, users: recentUsers, recentUsers });
    } else {
      res.json({ ok: true, success: true, users: [], recentUsers: [] });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, success: false, error: message });
  }
});

// Get / Set Admin Chat ID
app.get('/api/telegram/admin-chat', requireAdmin, (req, res) => {
  res.json({ success: true, adminChatId: configuredAdminChatId });
});

app.post('/api/telegram/admin-chat', requireAdmin, (req, res) => {
  const targetId = req.body.adminChatId !== undefined ? req.body.adminChatId : req.body.chatId;
  if (typeof targetId === 'string' || typeof targetId === 'number') {
    configuredAdminChatId = String(targetId).trim();
    res.json({ success: true, adminChatId: configuredAdminChatId });
  } else {
    res.status(400).json({ success: false, error: 'Invalid chat ID' });
  }
});

// Send new order alert to Telegram
app.post('/api/telegram/send-order', async (req, res) => {
  try {
    const { order, customerChatId } = req.body;
    if (!order || !order.orderNumber) {
      return res.status(400).json({ error: 'Order data is required' });
    }

    const deliveryMap: Record<string, string> = {
      courier: 'Курьерская доставка (Узбекистан, г. Ташкент)',
      express: 'Срочный экспресс (за 2 часа)',
      pickup: 'Самовывоз из бутика flaner_cosmetics (Узбекистан, г. Ташкент)'
    };

    const paymentMap: Record<string, string> = {
      card_online: '💳 Онлайн-перевод на карту 9860 1701 2205 1080 (Humo)',
      telegram_payments: 'Telegram Payments (Stars/Карты)',
      telegram: 'Telegram Payments (Stars/Карты)',
      payme: 'Payme (Uzcard / Humo)',
      click: 'Click Evolution',
      stripe: 'Stripe (Visa/Mastercard)',
      cash_on_delivery: 'Оплата при получении курьеру',
      cash: 'Оплата при получении'
    };

    const itemsList = (order.items || [])
      .map((item: { brand: string; productName: string; volume?: string; quantity: number; price: number }) =>
        `• <b>${item.brand}</b> — ${item.productName} (${item.volume || ''})\n  <i>${item.quantity} шт. × ${item.price.toLocaleString()} UZS</i>`
      )
      .join('\n');

    const messageHtml = `✨ <b>НОВЫЙ ЗАКАЗ В FLANER COSMETICS</b> ✨\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📦 <b>Номер заказа:</b> <code>${order.orderNumber}</code>\n` +
      `📅 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}\n\n` +
      `👤 <b>Покупатель:</b> ${order.customer.fullName}\n` +
      `📞 <b>Телефон:</b> ${order.customer.phone}\n` +
      `💬 <b>Telegram:</b> ${order.customer.telegramUsername || 'Не указан'}\n` +
      `📍 <b>Адрес:</b> ${order.customer.city || ''}, ${order.customer.address || ''}\n` +
      `🚚 <b>Доставка:</b> ${deliveryMap[order.customer.deliveryType] || order.customer.deliveryType} ${order.deliveryFee === 0 ? '(Бесплатно, заказ от 2 млн сум)' : `(${Number(order.deliveryFee || 0).toLocaleString()} UZS)`}\n` +
      (order.customer.comment ? `📝 <b>Комментарий:</b> ${order.customer.comment}\n` : '') +
      `💳 <b>Оплата:</b> ${paymentMap[order.paymentMethod] || order.paymentMethod} (Статус: <b>${order.paymentStatus === 'paid' ? '✅ Оплачено' : '⏳ Ожидает оплаты'}</b>)\n` +
      (order.promoCode ? `🏷 <b>Промокод:</b> ${order.promoCode}\n` : '') +
      `\n🛍 <b>Содержимое заказа:</b>\n${itemsList}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `💰 <b>ИТОГО К ОПЛАТЕ:</b> <b>${order.total.toLocaleString()} UZS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 <i>Отправлено через бота @flaneruz_bot</i>`;

    const recipientsSent: string[] = [];
    let lastError: string | undefined;

    // Send to Admin Chat if set
    if (configuredAdminChatId) {
      try {
        await sendTelegramMessage(configuredAdminChatId, messageHtml);
        recipientsSent.push(`admin (${configuredAdminChatId})`);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Failed to send to admin';
        console.error('Failed to send order to admin chat:', err);
      }
    }

    // Send confirmation to customer if customerChatId is provided (e.g. from Telegram Web App)
    if (customerChatId && String(customerChatId) !== String(configuredAdminChatId)) {
      try {
        const customerMsg = `🌸 <b>Спасибо за заказ в flaner_cosmetics!</b> 🌸\n\n` +
          `Ваш заказ <b>#${order.orderNumber}</b> успешно принят в обработку.\n` +
          `Сумма заказа: <b>${order.total.toLocaleString()} UZS</b>\n` +
          `Способ получения: <b>${deliveryMap[order.customer.deliveryType] || 'Доставка'}</b>\n\n` +
          `Наш менеджер свяжется с вами для подтверждения доставки.\n` +
          `Если у вас возникнут вопросы, напишите в этот чат!`;

        await sendTelegramMessage(customerChatId, customerMsg);
        recipientsSent.push(`customer (${customerChatId})`);
      } catch (err) {
        console.error('Failed to send order to customer chat:', err);
      }
    }

    // Log the notification
    telegramLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'order',
      recipient: recipientsSent.join(', ') || (configuredAdminChatId ? configuredAdminChatId : 'None (No chat ID)'),
      status: recipientsSent.length > 0 ? 'sent' : 'failed',
      error: recipientsSent.length === 0 ? (lastError || 'No admin chat ID configured') : undefined,
      textSnippet: `Заказ #${order.orderNumber} (${order.total} UZS)`
    });

    res.json({
      success: true,
      recipientsSent,
      adminConfigured: !!configuredAdminChatId,
      error: recipientsSent.length === 0 ? (lastError || 'Admin chat ID is not configured yet. Set it in the Bot tab of Admin Panel.') : undefined
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// Send order status update notification to customer / admin
app.post('/api/telegram/send-status-update', requireAdmin, async (req, res) => {
  try {
    const { orderNumber, customerName, newStatus, chatId, phone } = req.body;
    const targetChat = chatId || configuredAdminChatId;

    if (!targetChat) {
      return res.status(400).json({
        success: false,
        error: 'No target Chat ID provided or configured. Please enter a Chat ID.'
      });
    }

    const message = `🔔 <b>flaner_cosmetics | Обновление статуса заказа #${orderNumber}</b>\n\n` +
      `Здравствуйте, <b>${customerName || 'Покупатель'}</b>!\n` +
      `Статус вашего заказа изменился на: <b>«${newStatus}»</b>.\n\n` +
      (phone ? `📞 Контактный номер: ${phone}\n` : '') +
      `Благодарим за выбор бутика flaner_cosmetics!\n` +
      `🤖 @flaneruz_bot`;

    await sendTelegramMessage(targetChat, message);

    telegramLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'status',
      recipient: String(targetChat),
      status: 'sent',
      textSnippet: `Статус заказа #${orderNumber}: ${newStatus}`
    });

    res.json({ success: true, targetChat });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// Test message sender
app.post('/api/telegram/test-message', requireAdmin, async (req, res) => {
  try {
    const { chatId, message } = req.body;
    const target = chatId || configuredAdminChatId;

    if (!target) {
      return res.status(400).json({
        success: false,
        error: 'Пожалуйста, укажите Chat ID (или ID пользователя Telegram) для отправки теста.'
      });
    }

    const textToSend = message || `✨ <b>Тестовое сообщение от бота @flaneruz_bot</b>\n\n` +
      `Интеграция сайта <b>flaner_cosmetics</b> с Telegram Bot API работает исправно!\n` +
      `Время отправки: ${new Date().toLocaleTimeString('ru-RU')}`;

    await sendTelegramMessage(target, textToSend);

    telegramLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'test',
      recipient: String(target),
      status: 'sent',
      textSnippet: 'Тестовое сообщение'
    });

    res.json({ success: true, recipient: target });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// Get telegram notification logs
app.get('/api/telegram/logs', requireAdmin, (req, res) => {
  res.json({ logs: telegramLogs.slice(0, 20) });
});

// ======================== STATIC FILE SERVING (production) ========================

if (process.env.NODE_ENV === 'production') {
  // Serve the built client files from ../client/dist
  const clientDist = path.join(import.meta.dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ======================== START ========================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`flaner_cosmetics server running on http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Telegram Bot integration ${TELEGRAM_BOT_TOKEN ? 'configured ✓' : 'not configured (set TELEGRAM_BOT_TOKEN)'}`);
});
