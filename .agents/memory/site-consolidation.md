---
name: Single-site consolidation (Funademy)
description: All development happens in artifacts/ye only; consolidation finished Aug 2026 — rules, final state, deletion mechanics.
---

## Rule
All feature work goes into `artifacts/ye` (Funademy — e² Young Engineers Riyadh). It is the only artifact/package in the workspace.

**Why:** explicit user directive (Aug 2026): one consolidated site; everything else was ported into it and deleted.

**How to apply:** any new request → implement in YE with its own stack (Next.js App Router, Prisma `ye` schema, `/svc/*` routes, SMS-OTP family auth).

## Final state (consolidation COMPLETE, Aug 2026)
- Deleted: `artifacts/manara`, `artifacts/api-server`, `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`, `lib/db` (drizzle), and earlier `watanona`, `funademy-ds`, `mockup-sandbox`. Recover any of it from git history only.
- Ports that landed in YE before deletion: kids learning platform (`/learn` + `/svc/learn` + curriculum admin), blog (`/blog` + `/svc/admin/blog`), campaign stats dashboard (admin «المكعبات»).
- The api-server live-sessions backend (`/api/sessions`: booking, packages, waitlist, join gating + 39-assertion flow test) was deleted WITHOUT a YE port — if a sessions-booking task arrives, rebuild on YE's stack; the deleted implementation is reference material in git history (commits titled "Funademy live-sessions backend" / "session management components").
- Features were ported, NOT data: Manara accounts/bookings (email/password, drizzle `public` schema) were never migrated into YE (family SMS-OTP, Prisma `ye` schema).
- DB: orphaned Manara tables remain in the `public` schema. YE uses only `public.campaign_counters` + `public.campaign_brick_events` via raw SQL — keep those two; never declare `public` tables in `schema.prisma`.
- `scripts/post-merge.sh` now runs `pnpm install --frozen-lockfile` + `pnpm --filter @workspace/ye run db:push` (the old `--filter db` drizzle push died with lib/db).

## Mechanics learned
- Deleting an artifact = just `rm -rf artifacts/<dir>` + `pnpm install`; the platform auto-deregisters the artifact and removes its managed workflow. Deleted artifacts can leave untracked `node_modules` husks behind — rm those too.
- After merging tasks that add Prisma models, the local dev DB still needs `db:push` + `db:seed` (tests pass regardless — they use the isolated `ye_test` DB); a 500 on the new pages is the symptom.
- Portal login for testing: `POST /svc/account/otp` returns `devCode` in dev; verify sets `ye_family` cookie (non-Secure in dev, so plain `http://localhost` curl works). Student tables use camelCase quoted columns (`"familyId"`) in raw SQL.
