# FunAdemy — Young Engineers Riyadh

Production bilingual website (Arabic-first RTL at `/`, English at `/en`) for **FunAdemy** (Falcon Eye Ltd), the official e² YOUNG ENGINEERS Riyadh licensee.

## Brand identity — the Kite-Cap

The FunAdemy mark is the **Kite-Cap**: a gold diamond that reads as a flying kite (kids/marketing) and as a mortarboard seen from above (academic mode). Wordmark FunAdemy / funademy renders the first letters (فن / fun) in gold. All marks are inline SVG in `src/components/brand/FunAdemyMark.tsx` (`KiteMark`, `CapMark`, `Wordmark`); favicon at `src/app/icon.svg`. Source of truth: `attached_assets/FunAdemy_KiteCap_Identity_*.html`.

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
- **Pricing:** displayed prices (SAR 1380 per child per program, 4–6 sessions/month, −10% sibling discount) live in the home + pricing components under `src/components/`.
- **Seed data:** `prisma/seed.ts` (6 programs, 12 slots, 3 testimonials, 6 FAQs, brick counter baseline 1,847). Run `pnpm run db:seed` (idempotent).

## Database — IMPORTANT

All YE tables live in the default **`public`** Postgres schema with a `ye_` table-name prefix (migrated from the old dedicated `ye` schema on Aug 10, 2026, because Replit's publish schema-diff only syncs `public` — tables in other schemas silently never reached production). The brick counter is the **shared** `public.campaign_counters` row (`key = 'watan-bricks'`) accessed via raw SQL in `src/lib/bricks.ts`; it and `campaign_brick_events` ARE declared in `schema.prisma` (`CampaignCounter` / `CampaignBrickEvent`) purely so `prisma db push` never drops them — keep them declared.

⚠️ `prisma db push` drops any `public` table NOT declared in `schema.prisma`. Before adding raw-SQL tables, declare them as Prisma models first. `pnpm run db:push` is therefore a **guarded wrapper** (`scripts/guarded-db-push.sh`): it refuses to push while any undeclared public table still holds rows, so nothing rowful can be dropped silently — declare the table or delete it deliberately, then rerun (`db:push:unsafe` bypasses the guard, emergencies only).

Schema changes: edit `prisma/schema.prisma` → `pnpm run db:push` in dev; the Replit publish schema-diff now applies the same change to production automatically on the next publish.

One-time legacy cutover: databases that still hold data in the old `ye` schema (production before its first public-schema publish) are migrated automatically at server boot by `src/lib/migrate-ye-schema.ts` (also runnable via `pnpm run db:legacy-migrate`). It copies rows into the `public` tables in FK order, fixes sequences, drops the `ye` schema, and is an instant no-op afterwards. `prisma/schema.sql` is a build-generated DDL snapshot the migration replays if the publish diff hasn't created the target tables yet — don't edit it by hand. **Fail-closed:** once legacy data is detected, a failed or aborted cutover refuses to start the server (Next answers every request 500 and retries the migration on the next request) — the new Prisma client only sees `public`, so serving would mean an empty site while real data sits in `ye`. The abort log names the conflicting tables; clear them and the next request completes the cutover, no redeploy needed.

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
