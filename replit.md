# منارة | Manara Academy

Arabic-first, RTL e-learning platform for Saudi families — children 4–18, Saudi national curriculum, family subscription (SAR 49/mo, 399/yr).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (binds `PORT`)
- `pnpm --filter @workspace/manara run dev` — web frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks + Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Seed: see README.md (esbuild-bundle `artifacts/api-server/src/seed.ts`, idempotent)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5; DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`; codegen: Orval
- Frontend: React + Vite, wouter, TanStack Query, shadcn/ui, Tailwind

## Where things live

- OpenAPI contract: `lib/api-spec/openapi.yaml` (source of truth for API)
- DB schema: `lib/db/src/schema/` (one file per domain)
- API routes: `artifacts/api-server/src/routes/` (auth, children, curriculum, learning, parent, subscription, marketing, admin)
- Auth helpers: `artifacts/api-server/src/lib/auth.ts` (HMAC cookie token, scrypt hashing, requireAuth/requireRole)
- Payments abstraction: `artifacts/api-server/src/lib/payments.ts` (demo provider; swap for Stripe/Moyasar)
- Frontend: `artifacts/manara/src` — layouts Marketing/App(parent)/Kid/Admin, i18n in `src/lib/i18n.tsx`, band themes as `.theme-<band>` CSS classes

## Architecture decisions

- Sessions are stateless HMAC-signed cookie tokens (`manara_session`) carrying `{userId, childId?}`; child sessions are the same parent cookie with `childId` set after PIN check.
- Age band (explorers/builders/achievers/graduates) is computed from birth month/year at child creation; curriculum queries filter by the active child's band.
- Payment provider is a single swappable interface; demo provider records subscriptions without charging. Coupons: FOUNDING50, WELCOME10.
- Exercises auto-grade client-side; the completion endpoint receives per-answer correctness and computes score/XP/streaks/badges server-side.

## Product

- Marketing site `/` (pricing, curriculum w/ free samples, blog, legal), parent dashboard `/app`, child experience `/kid/*` behind avatar+PIN picker with parent-PIN exit gate, admin `/admin` (analytics MRR/churn, users, curriculum builder, blog CMS).
- Demo accounts in README.md (password Demo1234).

## User preferences

- User is on the Replit iOS app — web only, no Expo/native work.
- Brand placeholder "منارة | Manara" accepted; Arabic-first UI, English toggle.

## Gotchas

- Codegen post-processes `lib/api-zod` imports to `zod/v4` (sed step in `lib/api-spec/package.json`) — don't remove it.
- wouter: marketing catch-all must be a path-less `<Route>` at the end of the Switch, not `path="/"`.
- Express 5: async handlers annotated `Promise<void>`, early exits via `res.status().json(); return;`.
- OpenAPI: inline request-body schemas make orval emit `<OpId>Body` in both `api.ts` and `types/`, causing TS2308 export collisions in `lib/api-zod` — always use named `components/schemas` refs for request bodies.
- Email: `activeEmailProvider` in `artifacts/api-server/src/lib/email.ts` is a dev/log provider — swap it for a real provider (Resend/SendGrid) before production; verification tokens are sha256-hashed with 24h expiry.
- Payments: `lib/payments.ts` demo provider is still active (Stripe integration was declined); swap via the `PaymentProvider` interface when ready.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- ADMIN_GUIDE.md — teacher/admin operations manual
