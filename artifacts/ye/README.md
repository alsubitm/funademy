# Young Engineers Riyadh North — Website

Production bilingual website (Arabic-first RTL at `/`, English at `/en`) for **Young Engineers Riyadh North**, operated by Falcon Eye Ltd — official e² YOUNG ENGINEERS licensee.

**Stack:** Next.js 15 (App Router) · Prisma 6 · PostgreSQL · Tailwind CSS v4

## Pages

| Route | Purpose |
| --- | --- |
| `/` (AR) · `/en` (EN) | Home — full marketing site |
| `/programs/<slug>` | Program detail ×6: `big-builders`, `smartivo`, `bricks-challenge`, `algoplay-robotoys`, `galileo-technic`, `algoc` |
| `/watanona` | «أطفالنا يبنون وطننا» national campaign — countdown to 23 Sep 2027, interactive brick wall (shared counter, 20 bricks/day per visitor) |
| `/book` | Free-trial booking: program → slot → parent details → confirmation + WhatsApp |
| `/contact` | Contact page |
| `/admin` | Admin panel (password protected) |

## Admin access

- URL: `/admin`
- Password: value of the `ADMIN_PASSWORD` env var; if unset, the development fallback is **`YE-Riyadh-2026`**.
- **Set `ADMIN_PASSWORD` before going live.**

Admin can: manage schedule slots (feeds the LIVE ticker + booking flow), view/export bookings (CSV), mark bookings contacted/enrolled, edit testimonials & FAQs, and view/reset the campaign brick counter.

## Environment variables

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Provided by Replit PostgreSQL |
| `SESSION_SECRET` | yes | Signs the admin cookie |
| `ADMIN_PASSWORD` | recommended | Admin panel password (fallback above) |
| `PORT` | yes | Injected by the platform |

## Official logo drop-in

The e² Young Engineers logo is trademarked and is **not** bundled. Dashed placeholder slots render until you add the real files:

1. Put `ye-logo.svg` (for light backgrounds) and `ye-logo-white.svg` (for dark backgrounds) into `artifacts/ye/public/brand/`.
2. The site automatically serves them at `/brand/ye-logo.svg` — replace the `.logo-slot` placeholders in the header/footer components with `<img src="/brand/ye-logo.svg" …>` when the files exist.

## Editing schedule & pricing

- **Schedule slots:** manage them in `/admin` (no code changes needed). Slots power both the LIVE ticker and the booking flow.
- **Pricing:** displayed prices (SAR 330 online / SAR 380 in-person / −10% family discount) live in the home + pricing components under `src/components/`.
- **Seed data:** `prisma/seed.ts` (6 programs, 12 slots, 3 testimonials, 6 FAQs, brick counter baseline 1,847). Run `pnpm run db:seed` (idempotent).

## Database — IMPORTANT

All YE tables live in the dedicated Postgres schema **`ye`** (Prisma `multiSchema`). The brick counter is the **shared** `public.campaign_counters` row (`key = 'watan-bricks'`) accessed via raw SQL in `src/lib/bricks.ts` — never add it to `schema.prisma`, and never run `prisma db push` with `public` in the `schemas` list: the database is shared with other apps in this workspace and Prisma would drop their tables.

Schema changes: edit `prisma/schema.prisma` → `pnpm run db:push` (safe: only manages the `ye` schema).

## API routes

Internal API lives under `/svc/*` (NOT `/api/*` — that path is owned by the workspace's separate api-server artifact):

- `GET/POST /svc/bricks` — brick counter (POST rate-limited to 20/day per IP)
- `POST /svc/bookings` — create a trial booking
- `POST /svc/clicks` — outbound-click tracking (WhatsApp)
- `POST/DELETE /svc/admin/login` — admin session
- `GET/PATCH /svc/admin/bookings` (+`?format=csv`), `GET/POST/PATCH/DELETE /svc/admin/slots`, `GET/PATCH /svc/admin/content`, `GET/POST /svc/admin/bricks` — admin, cookie-guarded

## Development

```bash
pnpm --filter @workspace/ye run dev    # dev server (uses $PORT)
pnpm --filter @workspace/ye run build  # prisma generate && next build
pnpm --filter @workspace/ye run start  # production server
```

## Contact

WhatsApp: +966 50 555 8387 · CR license 4030388340
