---
name: YE test DB isolation & validation workflow gotcha
description: How the ye vitest suite isolates its database, and a pitfall when registering validation commands.
---

- The ye vitest suite (src/tests/) provisions a disposable `ye_test` database in globalSetup (create DB + prisma db push + manual `public.campaign_counters` table, since that table is intentionally not in schema.prisma). `setup-env.ts` overrides DATABASE_URL before test imports; `test-db.ts` fails closed unless the DB name is exactly `ye_test`.
- **Why:** code review rejects any test suite that mutates the shared dev DB or shared campaign counter; `db push --accept-data-loss` against the wrong URL is destructive.
- **How to apply:** new DB-backed test suites should reuse this pattern (globalSetup + setupFiles env override + fail-closed name check).
- Gotcha: registering a validation command can rewrite the `.replit` run-button `Project` workflow to run only the validation. Check `.replit` afterward and remove any injected `Project` wrapper so the run button keeps launching the app.
- **Id-recycling trap:** a suite that setvals a serial sequence DOWN makes later runs recycle ids; FK-less referrer rows (missed by TRUNCATE CASCADE) then match recycled ids in time-window lookups, causing phantom cross-run behavior. Suites lowering sequences must wipe FK-less referrers in afterAll and park the sequence high.

## Provider secrets must be stripped in setup-env (incident 2026-08-12)
With the live-by-presence pattern, adding a provider key to the workspace made
OLD suites hit the real provider: family-account tests delivered real SMS to
random Saudi numbers and burned Authentica credit the day after the key was
added. `src/tests/setup-env.ts` now deletes AUTHENTICA_API_KEY,
MOYASAR_SECRET_KEY, and TAMARA_API_TOKEN before any test imports; suites that
exercise provider paths re-set a fake key per test (vi.stubEnv) and mock fetch.
**How to apply:** any NEW live-by-presence secret must be added to that delete
list in the same change that introduces it. NELC_LRS_* stay untouched
(sending gated by outboxActive()/NELC_LIVE; live spec reads staging creds
deliberately).
