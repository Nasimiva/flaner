# flaner_cosmetics

## PostgreSQL product catalog

Render serves the Vite build and Express API from the same web service. The storefront's relative `/api/...` requests therefore reach this Express backend in production; no frontend API URL is needed. The Vite development server proxies `/api` to `http://localhost:3000`.

Products are shared through the Express API at `GET /api/products` (public read). Admin writes use the existing signed admin session: `POST /api/products`, `PUT /api/products/:id`, `PATCH /api/products/:id/stock`, and `DELETE /api/products/:id`.

1. Create a PostgreSQL database and set `DATABASE_URL` in `server/.env` (see `server/.env.example`). Set `DATABASE_SSL=true` if the provider requires TLS.
2. From the `server` directory, run `npm run db:migrate` to create the schema.
3. Run `npm run db:seed` to insert the existing products from `client/src/data/initialProducts.ts`. Seed skips if the table already has rows.
4. Set production `CORS_ORIGINS` only when an additional browser client is hosted on a different origin. Enter exact origins, comma-separated, with no trailing slash. The same-origin storefront does not need CORS.

The `/api/health` endpoint runs a lightweight PostgreSQL query and returns HTTP 503 if the database is unavailable. Configure it as the Render health check path.

The catalog and submitted orders come from PostgreSQL APIs; the anonymous cart remains in browser storage so shoppers can resume it. Order totals and item prices are rebuilt from database products at checkout, stock is reserved in the order transaction, and payment remains pending until a real payment provider confirms it. The repository does not currently implement customer accounts, server-managed promotions, or banner management.

### Render deployment commands

No Render Blueprint is present in this repository, so configure the existing Render web service with the repository root as **Root Directory**:

- **Build Command:** `cd server && npm ci && npm run build`
- **Start Command:** `cd server && npm start`

`npm run build` installs client dependencies, builds the client bundle that Express serves, and then compiles the server, migration, and seed. `npm start` runs database migrations, seeds an empty catalog without overwriting existing products, then starts Express. Render must have `DATABASE_URL` set in the service environment; configure `DATABASE_SSL=true` only if required by the database provider. If migration or seed fails, Express does not start and Render reports a failed deployment/startup.

Required Render variables: `NODE_ENV=production`, `DATABASE_URL` (use the Render PostgreSQL internal URL when both services are in the same region), `ADMIN_ACCESS_CODE`, `ADMIN_SESSION_SECRET` (random, at least 32 characters), and `ADMIN_EMAIL_ALLOWLIST`. Optional variables: `DATABASE_SSL=true` if required by the database provider, `CORS_ORIGINS` for external browser origins, and `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_CHAT_ID` for bot notifications. Keep all secrets in the Render service environment; no `VITE_` secret variables are used by the frontend.

Telegram Web App бутик — селективная косметика и нишевая парфюмерия (@flaneruz_bot).

## Структура проекта

```
flaner_cosmetics/
├── client/          ← React + Vite frontend (Telegram Web App)
└── server/          ← Express API + Telegram Bot integration
```

---

## Запуск (Development)

### 1. Server (порт 3000)

```bash
cd server
npm install
npm run dev
```

Создайте `server/.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_CHAT_ID=your_chat_id
ADMIN_ACCESS_CODE=your_secure_code
ADMIN_SESSION_SECRET=your_random_secret_32chars
ADMIN_EMAIL_ALLOWLIST=admin@example.com
```

### 2. Client (порт 5173)

```bash
cd client
npm install
npm run dev
```

Откройте: **http://localhost:5173**

> Запросы `/api/*` автоматически проксируются на `http://localhost:3000` через Vite proxy — CORS не нужен.

---

## Production Build

```bash
# 1. Build client
cd client && npm run build
# → собирает в client/dist/

# 2. Build server
cd server && npm run build
# → собирает в server/dist/server.cjs

# 3. Start
cd server && npm start
# Сервер раздаёт client/dist/ и обрабатывает /api/*
```

---

## Языки сайта (RU / UZ)

Русский — основной язык (`/`), узбекский (латиница) — отдельная индексируемая версия `/uz/`. Переключатель RU / UZ в шапке — обычные ссылки на эти адреса; язык определяется по URL, корзина и избранное при переключении сохраняются.

- Тексты интерфейса: `client/src/i18n/ru.ts` (источник, все ключи) и `uz.ts` (тот же набор ключей, проверяется тестом). Использование в коде: `const { t } = useI18n()`.
- Переводы товаров из стартового каталога (`prod-1`…`prod-12`) и баннеров по умолчанию: `client/src/i18n/content.ts`. Перевод подставляется только пока в базе лежит исходный русский текст; товары, добавленные в админ-панели, показываются как есть. Для нового товара добавьте запись в `PRODUCT_TEXT_UZ`. Админ-панель остаётся на русском.
- SEO: title/description/canonical/hreflang/Open Graph каждого языка задаются в `client/src/i18n/seo.ts`. При `npm run build` плагин в `vite.config.ts` рядом с `dist/index.html` пишет `dist/uz/index.html` с узбекскими метатегами (Express отдаёт его как статику, `/uz` → 301 на `/uz/`). Новый язык: добавить его в `seo.ts`, `ru.ts`/`uz.ts`-подобный словарь и `LANG_PATH`.
- `client/public/sitemap.xml` содержит оба адреса с `xhtml:link` альтернативами; при добавлении языка обновите и его.

---

## Переменные окружения (server/.env)

| Переменная | Описание |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота от @BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID администратора |
| `ADMIN_ACCESS_CODE` | Секретный код входа в админ-панель |
| `ADMIN_SESSION_SECRET` | Секрет для подписи сессий (мин. 32 символа) |
| `ADMIN_EMAIL_ALLOWLIST` | Разрешённые email через запятую |
| `PORT` | Порт сервера (по умолчанию: 3000) |
| `NODE_ENV` | `development` или `production` |
