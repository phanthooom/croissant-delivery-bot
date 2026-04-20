# Croissant Telegram Mini App

Telegram Mini App frontend for `@fooddddelivery_bot` with:

- Next.js 16 frontend UI styled close to `croissant.delever.uz`
- server-side Telegram `initData` validation
- BFF routes for `cart`, `orders`, and Telegram session bootstrap
- integration with the sample backend from [`NotNowJohn/food-delivery`](https://github.com/NotNowJohn/food-delivery)
- a safe local demo backend runtime on SQLite for development without Docker

## What is working now

- local frontend on `http://localhost:3000`
- local backend API on `http://127.0.0.1:8000/api/v1`
- public temporary Mini App URL via tunnel
- Telegram bot menu button and webhook configured
- backend mode tested end-to-end:
  - Telegram session
  - catalog from backend API
  - cart
  - order creation

## Project structure

- `src/`: Telegram Mini App frontend and BFF routes
- `reference-backend/`: cloned sample backend repository
- `scripts/run-reference-backend-demo.py`: local FastAPI demo runtime that reuses sample backend routers/models on SQLite
- `.demo-backend/`: local SQLite database and backend logs

## Local quick start

1. Install frontend dependencies:

```bash
npm install
```

2. Create the isolated Python environment for the demo backend:

```powershell
python -m venv .venv-reference-backend
.\.venv-reference-backend\Scripts\python -m pip install fastapi uvicorn sqlalchemy aiosqlite pydantic-settings python-jose passlib structlog httpx redis
```

3. Start the demo backend:

```powershell
.\.venv-reference-backend\Scripts\python scripts/run-reference-backend-demo.py
```

4. Create `.env.local` from `.env.example` and set at minimum:

```env
NEXT_PUBLIC_MINI_APP_URL=https://your-https-domain.example
BACKEND_API_BASE_URL=http://127.0.0.1:8000/api/v1
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_WEBHOOK_URL=https://your-https-domain.example/api/telegram/webhook
```

5. Start the frontend:

```bash
npm run dev
```

## Demo backend notes

The original sample backend expects PostgreSQL, Redis, and Celery. For safe local development this project adds a separate demo runtime instead of hacking the sample production app:

- uses the sample backend models, schemas, services, and routers
- stores data in local SQLite
- seeds categories/products from `https://croissant.delever.uz/ru`
- avoids Redis startup requirements
- keeps the original sample backend repository untouched for real production rollout

This is the right local path when Docker/Postgres/Redis are not available.

## Telegram setup

After `.env.local` is filled, configure the bot:

```bash
npm run bot:setup
```

This updates:

- bot commands
- bot descriptions
- menu button Web App URL
- webhook URL and secret

## Important Telegram limitation

The direct deep link:

```text
https://t.me/fooddddelivery_bot?startapp=croissant
```

only works as the main Mini App entry if you also set the bot's Main Mini App in `@BotFather`.

That step is manual and cannot be completed through the Bot API.

Until then, users can still open the app from:

- the bot menu button
- `/start` inside the bot chat

## Verification

The following checks pass:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

The app was also smoke-tested in backend mode through both:

- `http://localhost:3000`
- the current public tunnel URL

## Production direction

For production, replace the SQLite demo backend with the real sample backend stack:

- PostgreSQL
- Redis
- Celery
- persistent HTTPS domain

Keep the frontend BFF contract the same and point:

```env
BACKEND_API_BASE_URL=https://your-backend-domain/api/v1
```
