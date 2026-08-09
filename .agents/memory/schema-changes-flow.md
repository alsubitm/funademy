---
name: Schema changes flow
description: How dev/prod database schemas are managed (Prisma ye schema + what publish actually syncs)
---
- Dev: no migration files; edit prisma/schema.prisma (ye schema) and `prisma db push` against dev DB. Post-merge setup applies it after task merges.
- **Publish schema diff covers ONLY the `public` schema.** Verified Aug 2026: diff proposed public-table changes but never CREATEs for `ye.*` tables missing in prod. The Prisma "ye" schema does NOT sync to prod via normal publish.
- Prod ye-schema updates happen only via the Publish "overwrite data" option (wholesale dev→prod DB copy) or the user running SQL in the production Database pane. Agent must never run prod DDL.
- **Build-time rule:** publish builds run `next build` against the PROD database, before any schema apply. Any statically prerendered page that queries the DB fails the whole build if its table is missing in prod. Pages with DB reads should be `force-dynamic` unless their tables are long-stable in prod.
- Orphan-table trap: a table in dev-public but not prod gets CREATEd in prod on publish; a table dropped from prod but kept in dev gets re-created. Clean up in DEV first, then let publish drop it in prod.

**Why:** prod silently drifted 13 tables behind dev while publishes "succeeded"; blog was the first BUILD-time failure (Aug 9, 2026), runtime features (learn/appointments/payments) were already 500-ing in prod.
**How to apply:** after adding any table used by a public page, either keep the page dynamic or ensure the user does an overwrite-data publish; always re-check `explainSchemaDiff()` before telling the user to publish.
