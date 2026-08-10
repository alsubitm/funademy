---
name: YE build-resilience guard
description: How the vitest suite verifies next build survives an unreachable DATABASE_URL, and the nested-build env pitfall.
---

- A vitest test spawns a real `next build` (prisma generate + next binary, invoked directly from node_modules/.bin) with an unreachable DATABASE_URL and a throwaway dist dir (`NEXT_DIST_DIR`, supported via next.config.ts). Build failure = a page reintroduced an unguarded build-time DB query.
- **Why:** publish previously broke when static pages queried the DB at build time without safeQuery fallbacks; nothing else prevents regressions.
- **Gotcha:** a nested `next build` spawned under vitest/pnpm inherits NODE_ENV=test, VITEST*, npm_*/pnpm lifecycle vars that corrupt the build ("Cannot find module for page: /_document"). Build the child env from a whitelist (PATH/HOME/etc + explicit NODE_ENV=production), never from process.env spread.
- **Gotcha:** validation harness and the ye-tests workflow can run the suite concurrently; two builds sharing one distDir corrupt each other ("Cannot find module webpack-runtime.js"). The test takes a mkdir-based lock and retries once on that specific flake.
- **Gotcha:** `next build` rewrites tsconfig.json include to add `<distDir>/types/**/*.ts`; commit that include entry once so test runs don't churn tracked files. Always `rm -rf` the test dist dir before and after (stale partial output corrupts builds).
- **Gotcha:** never run a production `next build`/`next start` while the dev workflow is up without `NEXT_DIST_DIR=<throwaway>` — they share `.next` and corrupt each other (missing page modules / prerender-manifest).
