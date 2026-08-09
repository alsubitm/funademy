-- =============================================================================
-- Manara legacy public-schema cleanup
-- =============================================================================
-- Purpose : Drop orphaned tables left by the old Manara site (drizzle ORM,
--           public schema). These tables have no readers in any current code
--           and contain only test / demo data from the old site.
--
-- Safe to re-run : all statements use IF EXISTS — no-op when already gone.
--
-- KEEP (never drop):
--   public.campaign_counters      — used by artifacts/ye/src/lib/bricks.ts
--   public.campaign_brick_events  — used by artifacts/ye/src/app/svc/admin/campaign-stats/route.ts
--
-- All ye.* tables are managed by Prisma (artifacts/ye/prisma/schema.prisma)
-- and must never be touched here.
--
-- Applied to development DB : 2026-08-09 (executed via Replit executeSql)
-- Applied to production DB  : see task #91 — requires manual run via DB pane
--                             (executeSql is read-only against the prod replica)
-- =============================================================================

-- Dependency order: child tables before parent tables
DROP TABLE IF EXISTS public.session_materials   CASCADE;
DROP TABLE IF EXISTS public.session_packages    CASCADE;
DROP TABLE IF EXISTS public.session_series      CASCADE;
DROP TABLE IF EXISTS public.session_attendance  CASCADE;
DROP TABLE IF EXISTS public.session_notifications CASCADE;
DROP TABLE IF EXISTS public.session_bookings    CASCADE;
DROP TABLE IF EXISTS public.live_sessions       CASCADE;
DROP TABLE IF EXISTS public.invoices            CASCADE;
DROP TABLE IF EXISTS public.subscriptions       CASCADE;
DROP TABLE IF EXISTS public.completions         CASCADE;
DROP TABLE IF EXISTS public.data_deletion_requests CASCADE;
DROP TABLE IF EXISTS public.exercises           CASCADE;
DROP TABLE IF EXISTS public.lessons             CASCADE;
DROP TABLE IF EXISTS public.units               CASCADE;
DROP TABLE IF EXISTS public.subjects            CASCADE;
DROP TABLE IF EXISTS public.blog_posts          CASCADE;
DROP TABLE IF EXISTS public.children            CASCADE;
DROP TABLE IF EXISTS public.users               CASCADE;

-- Verify: only campaign tables should remain in public schema
-- Expected: campaign_brick_events, campaign_counters
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
