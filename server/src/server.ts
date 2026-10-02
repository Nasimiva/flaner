import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createProductRoutes } from './productRoutes.js';
import { pool } from './db/pool.js';
import { errorMiddleware } from './http/errors.js';
import { logger } from './logger.js';
import { createLeadRouters } from './modules/leads/leadRoutes.js';
import { formatLeadMessage } from './modules/leads/leadNotification.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.disable('x-powered-by');
// Render terminates TLS at its proxy. Trust its forwarded client IP for rate limits.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

// CORS: allow requests from the Vite dev server in development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  );
  const devOrigin = origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173';
  const originAllowed = process.env.NODE_ENV === 'production'
    ? Boolean(origin && allowedOrigins.has(origin))
    : !origin || devOrigin || allowedOrigins.has(origin);
  if (origin && originAllowed) {
    res.vary('Origin');
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
  // Keep health useful for Render while confirming that the app can reach its database.
  import('./db/pool.js').then(({ pool }) => pool.query('SELECT 1')).then(
    () => res.json({ status: 'ok', database: 'connected', name: 'flaner_cosmetics' }),
    (error: unknown) => {
      console.error('Health check database query failed:', error);
      res.status(503).json({ status: 'error', database: 'unavailable', name: 'flaner_cosmetics' });
    }
  );
});

app.use('/api/products', createProductRoutes(requireAdmin));

// Leads (call-back requests). The shopper endpoint is public and rate limited; the rest need an admin session.
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const leadRouters = createLeadRouters({
  pool,
  botToken: TELEGRAM_BOT_TOKEN,
  initDataMaxAgeSeconds: positiveInt(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS, 24 * 60 * 60),
  rateLimit: {
    windowMs: positiveInt(process.env.LEADS_RATE_LIMIT_WINDOW_MINUTES, 15) * 60 * 1000,
    max: positiveInt(process.env.LEADS_RATE_LIMIT_MAX, 10)
  },
  notifyLeadCreated: async (lead) => {
    const snippet = `Заявка ${lead.leadNumber} (${lead.itemsTotal} UZS)`;
    if (!TELEGRAM_BOT_TOKEN || !configuredAdminChatId) {
      logger.warn('Lead notification skipped: Telegram bot token or admin chat id is not configured', { leadNumber: lead.leadNumber });
      return;
    }
    try {
      await sendTelegramMessage(configuredAdminChatId, formatLeadMessage(lead));
      telegramLogs.unshift({ id: `log-${Date.now()}`, timestamp: new Date().toISOString(), type: 'order', recipient: configuredAdminChatId, status: 'sent', textSnippet: snippet });
    } catch (error) {
      telegramLogs.unshift({ id: `log-${Date.now()}`, timestamp: new Date().toISOString(), type: 'order', recipient: configuredAdminChatId, status: 'failed', error: error instanceof Error ? error.message : 'unknown error', textSnippet: snippet });
      throw error;
    }
  }
});
app.use('/api/leads', leadRouters.publicRouter);
app.use('/api/admin/leads', requireAdmin, leadRouters.adminRouter);

// Orders are persisted in PostgreSQL. The browser may submit customer details and
// item IDs, but prices, totals, delivery fees, and payment state are server-owned.
app.post('/api/orders', async (req, res) => {
  const submitted = req.body;
  const items = submitted?.items;
  const customer = submitted?.customer;
  const paymentMethods = new Set(['card_online', 'telegram_payments', 'payme', 'click', 'stripe', 'cash_on_delivery']);
  if (!customer || typeof customer.fullName !== 'string' || !customer.fullName.trim() ||
      typeof customer.phone !== 'string' || !customer.phone.trim() || !Array.isArray(items) || !items.length ||
      !items.every((item: any) => typeof item?.productId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0) ||
      new Set(items.map((item: any) => item.productId)).size !== items.length ||
      !paymentMethods.has(submitted.paymentMethod) || !['courier', 'express', 'pickup'].includes(customer.deliveryType)) {
    return res.status(400).json({ error: 'Invalid order details' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ids = [...new Set(items.map((item: { productId: string }) => item.productId))];
    const found = await client.query(
      'SELECT id, name, brand, price, volume, images, in_stock, stock_count FROM products WHERE id = ANY($1::text[]) FOR UPDATE',
      [ids]
    );
    const products = new Map(found.rows.map((product) => [product.id, product]));
    if (products.size !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more products are unavailable' });
    }
    const orderItems = items.map((item: { productId: string; quantity: number }) => {
      const product = products.get(item.productId)!;
      if (!product.in_stock || product.stock_count < item.quantity) throw new Error('INSUFFICIENT_STOCK');
      return {
        productId: product.id, productName: product.name, brand: product.brand,
        image: Array.isArray(product.images) ? product.images[0] || '' : '',
        price: Number(product.price), volume: product.volume, quantity: item.quantity
      };
    });
    for (const item of items as Array<{ productId: string; quantity: number }>) {
      await client.query(
        'UPDATE products SET stock_count=stock_count-$2, in_stock=(stock_count-$2)>0, updated_at=NOW() WHERE id=$1',
        [item.productId, item.quantity]
      );
    }
    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = customer.deliveryType === 'pickup' ? 0 : customer.deliveryType === 'express' ? 45000 : subtotal >= 2000000 ? 0 : 30000;
    const now = new Date().toISOString();
    const id = `ord-${crypto.randomUUID()}`;
    const orderNumber = `FL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const order = {
      id, orderNumber, createdAt: now,
      customer: {
        fullName: customer.fullName.trim(), phone: customer.phone.trim(),
        telegramUsername: typeof customer.telegramUsername === 'string' ? customer.telegramUsername : undefined,
        telegramId: typeof customer.telegramId === 'string' || typeof customer.telegramId === 'number' ? customer.telegramId : undefined,
        address: typeof customer.address === 'string' ? customer.address : '',
        city: typeof customer.city === 'string' ? customer.city : '',
        comment: typeof customer.comment === 'string' ? customer.comment : undefined,
        deliveryType: customer.deliveryType
      },
      items: orderItems, subtotal, discount: 0, deliveryFee, total: subtotal + deliveryFee,
      paymentMethod: submitted.paymentMethod, paymentStatus: 'pending', status: 'new'
    };
    await client.query('INSERT INTO orders (id, order_number, payload) VALUES ($1, $2, $3::jsonb)', [id, orderNumber, JSON.stringify(order)]);
    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') return res.status(409).json({ error: 'A product is out of stock or has insufficient quantity' });
    console.error('Could not create order:', error);
    res.status(503).json({ error: 'Could not save order' });
  } finally {
    client.release();
  }
});

app.get('/api/orders', requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query('SELECT payload FROM orders ORDER BY created_at DESC');
    res.json(result.rows.map((row) => row.payload));
  } catch (error) {
    console.error('Could not load orders:', error);
    res.status(503).json({ error: 'Orders are temporarily unavailable' });
  }
});

app.patch('/api/orders/:id/status', requireAdmin, async (req, res) => {
  const allowed = new Set(['new', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']);
  if (!allowed.has(req.body?.status)) return res.status(400).json({ error: 'Invalid order status' });
  try {
    const result = await pool.query(
      `UPDATE orders SET payload = jsonb_set(payload, '{status}', to_jsonb($2::text)), updated_at=NOW() WHERE id=$1 RETURNING payload`,
      [req.params.id, req.body.status]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0].payload);
  } catch (error) {
    console.error('Could not update order:', error);
    res.status(503).json({ error: 'Could not update order status' });
  }
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
const configured = Boolean(
  ADMIN_ACCESS_CODE &&
  ADMIN_SESSION_SECRET &&
  ADMIN_EMAIL_ALLOWLIST.size
);

const matchesCode =
  configured &&
  code.length === ADMIN_ACCESS_CODE.length &&
  crypto.timingSafeEqual(
    Buffer.from(code),
    Buffer.from(ADMIN_ACCESS_CODE)
  );
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
    const { customerChatId } = req.body;
    const orderId = req.body?.order?.id;
    if (typeof orderId !== 'string') {
      return res.status(400).json({ error: 'Order data is required' });
    }
    const savedOrder = await pool.query('SELECT payload FROM orders WHERE id=$1', [orderId]);
    if (!savedOrder.rowCount) return res.status(404).json({ error: 'Order not found' });
    const order = savedOrder.rows[0].payload;

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
const clientDist = path.resolve(process.cwd(), '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Must stay after every route: turns validation, HttpError and JSON-parse failures into JSON responses.
app.use(errorMiddleware);

// ======================== START ========================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`flaner_cosmetics server running on http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Telegram Bot integration ${TELEGRAM_BOT_TOKEN ? 'configured ✓' : 'not configured (set TELEGRAM_BOT_TOKEN)'}`);
});
  
