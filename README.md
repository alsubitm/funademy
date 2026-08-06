# منارة | Manara Academy

Arabic-first, RTL e-learning platform for Saudi families — children aged 4–18, aligned to the Saudi national curriculum (Arabic, Math, English, Science).

## Demo accounts

Password for all accounts: `Demo1234` — parent PIN gate: `1234`

| Role | Email | Notes |
|---|---|---|
| Parent | `parent@demo.manara.sa` | 2 children: سلمان (PIN `1111`, Explorers 4–7), ليان (PIN `2222`, Builders 8–11). Active trial (annual plan). |
| Teacher | `teacher@demo.manara.sa` | Lesson builder + blog CMS |
| Admin | `admin@demo.manara.sa` | Analytics + user management |

## Structure

- `/` — marketing site (home, pricing SAR 49/mo or 399/yr, curriculum with free samples, blog, legal)
- `/app` — parent dashboard (children, reports, screen-time limits, subscription)
- `/app/profiles` → `/kid/*` — child experience (avatar + PIN picker, band-themed UI, lesson player, XP/streaks/badges)
- `/admin` — analytics, users, curriculum builder, blog CMS

## Tech

- `artifacts/manara` — React + Vite frontend (wouter, TanStack Query, shadcn/ui, Tailwind, RTL/i18n)
- `artifacts/api-server` — Express 5 API, cookie sessions (HMAC token signed with `SESSION_SECRET`), scrypt password hashing
- `lib/db` — Drizzle ORM + PostgreSQL schema
- `lib/api-spec` / `lib/api-zod` / `lib/api-client-react` — OpenAPI contract + generated Zod schemas and React Query hooks

Payments are abstracted in `artifacts/api-server/src/lib/payments.ts` (demo provider today; swap in Stripe/Moyasar/Tap by implementing `PaymentProvider`). Coupons: `FOUNDING50` (50% off), `WELCOME10` (10% off).

## Reseeding

```
cd artifacts/api-server
node -e "require('esbuild').buildSync({entryPoints:['src/seed.ts'],bundle:true,platform:'node',format:'cjs',outfile:'dist/seed.cjs',external:['pg-native']})" && node dist/seed.cjs
```

Seed is idempotent — it skips if users already exist.
