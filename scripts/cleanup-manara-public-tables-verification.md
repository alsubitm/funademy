# Manara Public-Schema Cleanup — Verification Record

**Date applied (dev):** 2026-08-09  
**Executed by:** Replit Agent (task #90)

## Result: public schema after cleanup

| table_name              | status   |
|-------------------------|----------|
| campaign_brick_events   | ✅ KEPT  |
| campaign_counters       | ✅ KEPT  |
| blog_posts              | 🗑 DROPPED |
| children                | 🗑 DROPPED |
| completions             | 🗑 DROPPED |
| data_deletion_requests  | 🗑 DROPPED |
| exercises               | 🗑 DROPPED |
| invoices                | 🗑 DROPPED |
| lessons                 | 🗑 DROPPED |
| live_sessions           | 🗑 DROPPED |
| session_attendance      | 🗑 DROPPED |
| session_bookings        | 🗑 DROPPED |
| session_materials       | 🗑 DROPPED |
| session_notifications   | 🗑 DROPPED |
| session_packages        | 🗑 DROPPED |
| session_series          | 🗑 DROPPED |
| subjects                | 🗑 DROPPED |
| subscriptions           | 🗑 DROPPED |
| units                   | 🗑 DROPPED |
| users                   | 🗑 DROPPED |

## ye schema — intact

23 tables present (all Prisma-managed ye.* tables unaffected).

## Tests after cleanup

`pnpm --filter @workspace/ye test` → **9 test files, 120 tests — all passed**

## Production

Production DB is read-only via agent tooling. Run `scripts/cleanup-manara-public-tables.sql`
manually from the Replit database pane (production environment). Tracked in task #91.
