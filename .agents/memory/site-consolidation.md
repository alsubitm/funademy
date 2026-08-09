---
name: Single-site consolidation (Funademy)
description: All development happens in artifacts/ye only; other artifacts ported then deleted — rules and status.
---

## Rule
All feature work goes into `artifacts/ye` (Funademy — e² Young Engineers Riyadh). Do not build new features in Manara or api-server.

**Why:** explicit user directive (Aug 2026): one consolidated site; everything else gets ported into it and deleted.

**How to apply:** any new request → implement in YE, even if an equivalent exists in Manara. Manara/api-server code is reference material for ports.

## Status (Aug 2026)
- Deleted: `artifacts/watanona`, `artifacts/funademy-ds`, `artifacts/mockup-sandbox`. No separate design system exists anymore — YE's own CSS is the styling source of truth.
- Ported already: watanona `/track` campaign stats → YE admin («المكعبات» tab) via `/svc/admin/campaign-stats` (raw-SQL merge of `ye.ye_brick_events` + legacy `public.campaign_brick_events`, goal from `public.campaign_counters` key `watan-goal`).
- Pending ports (follow-up tasks filed): kids learning platform + curriculum, blog. After both land: delete `artifacts/manara` + `artifacts/api-server` (+ then-unused lib/api-* packages). Keep `public.campaign_counters` / `public.campaign_brick_events` — YE reads them via raw SQL.
- Port features, NOT data: Manara accounts/bookings (email/password, drizzle `public`) are incompatible with YE (family SMS-OTP, Prisma `ye`); user informed.

## Mechanics learned
- Deleting an artifact = stop nothing, just `rm -rf artifacts/<dir>` + `pnpm install`; the platform auto-deregisters the artifact and removes its managed workflow.
- Portal login for testing: `POST /svc/account/otp` returns `devCode` in dev; verify sets `ye_family` cookie (non-Secure in dev, so plain `http://localhost` curl works). Student tables use camelCase quoted columns (`"familyId"`) in raw SQL.
