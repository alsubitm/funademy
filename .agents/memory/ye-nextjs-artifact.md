---
name: YE site — Next.js + Prisma in a drizzle monorepo
description: Constraints for the artifacts/ye Next.js site coexisting with other apps on the shared Postgres + path proxy.
---

- Next-in-artifact pattern: dev `next dev -H 0.0.0.0 -p $PORT`; production toml uses build/run args (not static serve); env checks (e.g. required ADMIN_PASSWORD) must be lazy (request-time), not module-level, or `next build` fails during page-data collection.
- pnpm workspace: prisma/@prisma engines added to `onlyBuiltDependencies` in pnpm-workspace.yaml (else postinstall blocked).

## Preview cross-origin blocking (Next 15.5+)
Next dev blocks `/_next/*` requests from the Replit preview with "Blocked cross-origin request" unless `allowedDevOrigins` matches. **`*.replit.dev` does NOT match** — the real dev domain is `<id>.<cluster>.replit.dev` (two labels; Next wildcards match one label only). Page HTML still returns 200, so it looks like the app "loads but hangs" for the user.
**How to apply:** in next.config, include `process.env.REPLIT_DEV_DOMAIN` exactly plus `*.picard.replit.dev`-style two-label wildcards. Symptom in logs: `⚠ Blocked cross-origin request from <domain> to /_next/*`.
