# Production TODO

## Must do before launch

- Deploy the frontend to a stable HTTPS domain
- Replace the temporary tunnel URL in `.env.local`
- Re-run `npm run bot:setup`
- Set the Main Mini App manually in `@BotFather`
- Deploy the real sample backend stack with PostgreSQL, Redis, and Celery
- Point `BACKEND_API_BASE_URL` to the real production backend
- Configure persistent media/CDN policy if product images change

## Backend rollout

- Run migrations on the production backend
- Add a proper seed/admin flow for categories and products
- Decide whether catalog data stays synced from Delever or is managed directly in backend admin
- Enable real async admin notifications from backend workers
- Add order status update flow for operators

## Telegram operations

- Confirm the bot can message the admin order chat
- Confirm the admin order chat ID is stable and correct
- Decide whether customer confirmation messages should always be sent, or only when DM permission exists
- Add support flow for `/help` and operator escalation

## Frontend productization

- Add analytics / event tracking if needed
- Add proper checkout validation and edge-case messaging
- Add loading/error states for weak mobile networks
- Add a branded empty-cart and order-success UX pass

## Infrastructure

- Move secrets to a proper secret manager
- Add process management for frontend and backend
- Add health checks and restart policy
- Add HTTPS domain monitoring
- Add backup and restore policy for orders/users

## QA checklist

- Open from Telegram menu button on iPhone
- Open from Telegram menu button on Android
- Verify `initData` validation in Telegram
- Verify browser preview still works without Telegram
- Verify catalog loads from backend API
- Verify cart survives full checkout flow
- Verify order reaches backend and Telegram admin flow
- Verify webhook still responds after restart
