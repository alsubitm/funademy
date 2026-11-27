# Performance Strategy

## Stack
- Single Next.js 15 App Router app in `artifacts/ye` (Prisma 6 → Neon Postgres, us-east-2). `artifacts/windmill` is a static Vite site.
- Neon autosuspends idle compute: deployment logs show frequent `57P01 terminating connection due to administrator command`. Short interactive-transaction timeouts (Prisma defaults maxWait 2s / timeout 5s) are fragile against cold connections.

## Hot paths
- Public marketing pages (`/`, `/programs`, `/programs/[slug]`, `/blog`, `/book`) — mostly ISR except `/programs/[slug]` (revalidate 0) and `/blog` (force-dynamic).
- Kids learning platform: `/svc/learn/home`, `/svc/learn/lessons/[id]`, `/svc/learn/lessons/[id]/complete`, `/svc/learn/subjects*`.
- Chat assistant: `/svc/chat/conversations/[id]/messages` (OpenAI call).
- `allowRate()` DB rate limiter runs on every public write endpoint (clicks, bookings, chat, logins).
- Background loop in `src/instrumentation.ts` every 10 min (abuse-retention sweep, payment sweep, NELC outbox flush, trial follow-ups).

## Large / growing tables
- `ye_rate_limit_hits` (one row per rate-limited request; purged by abuse-retention sweep).
- `ye_xapi_outbox` (append-only; rows are never deleted).
- `ye_lrn_completions` (every lesson attempt, including replays).
- `ye_chat_messages`, `ye_chat_audit` (TTL purged).
- `ye_click_events`, `ye_appointments`, `ye_bookings`, `ye_payments` grow slowly.

## Dismissed categories
- (None yet)
