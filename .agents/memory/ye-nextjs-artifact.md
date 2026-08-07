---
name: YE site — Next.js + Prisma in a drizzle monorepo
description: Constraints for the artifacts/ye Next.js site coexisting with other apps on the shared Postgres + path proxy.
---

- **Prisma must never manage `public`.** `artifacts/ye` uses Prisma `multiSchema` with `schemas = ["ye"]` only; all models `@@schema("ye")`. **Why:** `prisma db push` drops undeclared tables in managed schemas — it once tried to drop the drizzle `users` table. **How to apply:** any new YE table goes in the `ye` schema; the shared `public.campaign_counters` row (`key='watan-bricks'`, shared with api-server/legacy watanona) is accessed only via raw SQL in `src/lib/bricks.ts`.
- **`/api/*` is owned by the api-server artifact** in the path proxy; YE's internal routes live under `/svc/*` instead.
- **Path ownership:** the proxy routes by artifact previewPath; the standalone watanona artifact was moved to `/watanona-legacy/` so the YE site's `/watanona` page could take the path. Retiring a page = move its artifact's previewPath, keeping code for in-flight task merges.
- Next-in-artifact pattern: dev `next dev -H 0.0.0.0 -p $PORT`; production toml uses build/run args (not static serve); env checks (e.g. required ADMIN_PASSWORD) must be lazy (request-time), not module-level, or `next build` fails during page-data collection.
- pnpm workspace: prisma/@prisma engines added to `onlyBuiltDependencies` in pnpm-workspace.yaml (else postinstall blocked).
