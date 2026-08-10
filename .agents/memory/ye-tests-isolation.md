---
name: YE test DB isolation & validation workflow gotcha
description: How the ye vitest suite isolates its database, and a pitfall when registering validation commands.
---

- The ye vitest suite (src/tests/) provisions a disposable `ye_test` database in globalSetup (create DB + prisma db push + manual `public.campaign_counters` table, since that table is intentionally not in schema.prisma). `setup-env.ts` overrides DATABASE_URL before test imports; `test-db.ts` fails closed unless the DB name is exactly `ye_test`.
- **Why:** code review rejects any test suite that mutates the shared dev DB or shared campaign counter; `db push --accept-data-loss` against the wrong URL is destructive.
- **How to apply:** new DB-backed test suites should reuse this pattern (globalSetup + setupFiles env override + fail-closed name check).
- Gotcha: registering a validation command can rewrite the `.replit` run-button `Project` workflow to run only the validation. Check `.replit` afterward and remove any injected `Project` wrapper so the run button keeps launching the app.
- **Id-recycling trap:** a suite that setvals a serial sequence DOWN makes later runs recycle ids; FK-less referrer rows (missed by TRUNCATE CASCADE) then match recycled ids in time-window lookups, causing phantom cross-run behavior. Suites lowering sequences must wipe FK-less referrers in afterAll and park the sequence high.
