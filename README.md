# flaner_cosmetics

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
