# FunAdemy — e² Young Engineers Riyadh

Arabic-first (RTL, with English mirror under `/en`) site for the e² Young Engineers Riyadh franchise: programs, enrollment + payments (Moyasar/Tamara), family portal (SMS-OTP login), kids learning platform (`/learn`), blog (`/blog`), admin dashboard, and the «أطفالنا يبنون وطننا» campaign.

## Single site (Aug 2026 — user decision; consolidation COMPLETE)

**Everything lives in `artifacts/ye` — the only artifact/package in the workspace.**

- Deleted after the learning platform + blog were ported into YE: `artifacts/manara`, `artifacts/api-server`, and their libs `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`, `lib/db` (drizzle). Earlier deletions: `watanona`, `funademy-ds`, `mockup-sandbox`.
- Features were ported, not data: Manara accounts/bookings (email/password auth) were NOT migrated into YE (family SMS-OTP auth).
- YE uses `public.campaign_counters` + `public.campaign_brick_events` via raw SQL (`artifacts/ye/src/lib/bricks.ts`, `svc/admin/campaign-stats`). They ARE declared in `schema.prisma` (`CampaignCounter` / `CampaignBrickEvent`) so schema pushes preserve them — keep them declared. Legacy Manara tables are gone from the production `public` schema (verified by direct prod query, Aug 2026); if orphans linger in a dev copy, the guarded push refuses to drop them while they hold rows.

## Funademy (artifacts/ye) — the product

- Next.js 15 App Router + Prisma. **Prisma owns the `public` schema** (tables prefixed `ye_`; the old dedicated `ye` schema is retired — a fail-closed one-time boot migration moves legacy databases). `prisma db push` drops undeclared public tables, so `pnpm run db:push` is a guarded wrapper that refuses while any undeclared public table holds rows — declare anything that must survive as a model (`db:push:unsafe` bypasses, emergencies only). Backend under `/svc/*`, admin auth via `ADMIN_PASSWORD` cookie, family auth via SMS OTP (dev mode returns `devCode`).
- Required env: `DATABASE_URL`, `SESSION_SECRET` (OTP/session HMAC), `ADMIN_PASSWORD`. Payment providers (Moyasar/Tamara) switch to live mode purely by secret presence.
- NELC LRS (xAPI) works the same way: `NELC_LRS_ENDPOINT` + `NELC_LRS_KEY` + `NELC_LRS_SECRET` (optional `NELC_LRS_ENV=production`) enable the admin «نيلك» tab that sends the FutureX 10-statement verification journey (`src/lib/xapi.ts`); when missing, the tab says «غير مهيأ» — there is deliberately no simulated fallback. NELC's WAF geo-blocks non-Saudi server IPs, so the tab uses a browser relay: the server prepares the statements and the owner's browser inside KSA sends them to the LRS, then reports back for the audit log. Handing the LRS Basic credential to the browser is a documented, accepted risk in this single-admin app: `prepare` requires re-entering the admin password (step-up), runs are one-time with a 15-minute expiry, and browser-reported outcomes are stored labeled `source='browser'` (unverified server-side — NELC's wizard check is the authority). Never reuse the relay for non-admin users or production learner events.
- Details: `artifacts/ye/README.md` · tests: `ye-tests` workflow (vitest, isolated `ye_test` DB) · post-merge: `scripts/post-merge.sh` (`pnpm install` + one-time ye→public legacy migrate + guarded `db:push`).

## User preferences

- User is on the Replit iOS app — web only, no Expo/native work.
- Arabic-first UI, English mirror toggle.
- Chat with the user in **English** (simple, plain). He explicitly said long Arabic chat messages render jumbled/confusing on his device (Aug 2026). The product UI stays Arabic.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
