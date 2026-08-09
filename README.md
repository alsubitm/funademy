# Funademy — e² Young Engineers Riyadh

pnpm monorepo with a single product: **`artifacts/ye`** — the Funademy website (Next.js 15 App Router + Prisma, Arabic-first RTL with an English mirror under `/en`).

See `artifacts/ye/README.md` for setup, routes, environment variables, and operations.

## Workspace

- `artifacts/ye` — the entire site: marketing pages, enrollment + payments, family portal, kids learning platform (`/learn`), blog, admin dashboard, campaign.
- `scripts` — workspace scripts (`post-merge.sh`: install + `prisma db push` for the `ye` schema).

## History

The legacy Manara Academy stack (`artifacts/manara`, `artifacts/api-server`, `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`, `lib/db`) was ported into Funademy (learning platform + blog) and deleted in Aug 2026 — recover via git history if ever needed. Orphaned Manara tables remain in the `public` DB schema; Funademy uses only `public.campaign_counters` and `public.campaign_brick_events` via raw SQL.
