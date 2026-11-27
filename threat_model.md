# Threat Model

## Project Overview

FunAdemy (artifacts/ye) is an Arabic-first RTL website for the e² Young Engineers Riyadh franchise. It is a Next.js 15 App Router application backed by Prisma/PostgreSQL. The site handles program enrollment, monthly subscription payments (Moyasar / Tamara), a family portal (SMS-OTP login), a kids' learning platform (`/learn`), an instructor dashboard, a blog, and an admin dashboard. Deployed to **https://funademy.io** as a public autoscale Replit deployment.

Previous scan entries for `artifacts/api-server` (Manara Academy) are no longer relevant — that package has been deleted. A separate `artifacts/windmill` web artifact also exists in the workspace.

## Assets

- **Admin session and password** — a single `ADMIN_PASSWORD` protects the entire admin dashboard (bookings, enrollments, payments, billing, NELC xAPI, student national IDs). Compromise is equivalent to full site control.
- **Instructor sessions** — `ye_instructor` cookies (scrypt-hashed passwords, HMAC-signed tokens, `authVersion` revocation) scoping an instructor to only their assigned course runs.
- **Family sessions** — HMAC-signed `ye_family` cookies (SESSION_SECRET) allowing each family to view payment history, manage children, and pay. Leaking or forging the SESSION_SECRET lets an attacker impersonate any family.
- **Child/kid sessions** — `ye_kid` cookies (same secret) that switch the UI into a child's learning context after a PIN check. A 4+ digit PIN guards each child profile.
- **Saudi mobile numbers (phone)** — used as family identifiers and OTP delivery targets. Exposed only to the family and admin.
- **Student national IDs** — sensitive Saudi government IDs, stored per child, reported to NELC's LRS.
- **Payment records** — Moyasar/Tamara transaction references, totals, enrollment items. Scoped to each family.
- **Application secrets** — `SESSION_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL`, payment provider keys (`MOYASAR_SECRET_KEY`, `TAMARA_API_TOKEN`, `TAMARA_NOTIFICATION_TOKEN`, `MOYASAR_WEBHOOK_SECRET`), NELC LRS credentials, `SWEEP_SECRET`.
- **LRS credentials (NELC)** — handed to the admin's browser for geo-fenced relay; documented accepted risk for the single-admin app.

## Trust Boundaries

- **Browser → Next.js API routes (`/svc/*`)** — all client requests. The API must authenticate and authorize each request; the browser is untrusted. Session cookies are httpOnly + secure in production.
- **Public → Family-authenticated** — program pages, blog, campaign are public; portal, payments, child management, and learning content require a valid `ye_family` session.
- **Family-authenticated → Child context** — a child's learning profile requires a `ye_kid` session obtained by verifying the child's PIN.
- **Instructor → assigned runs only** — instructor routes scope every query to course runs with a matching `instructorAssignment`.
- **Family → Admin** — admin routes are protected by `ye_admin` (HMAC-signed token derived from `ADMIN_PASSWORD`). Admin has access to all families' data.
- **Server → NELC LRS** — xAPI statements are geo-restricted; production delivery uses a browser relay from the admin's Saudi-based device.
- **Server → Payment providers** — Moyasar/Tamara webhooks are HMAC/JWT-verified before any state change.

## Scan Anchors

- **Production entry points**: `artifacts/ye/src/app/(ar)/svc/` — all `/svc/*` route handlers
- **Auth helpers**: `artifacts/ye/src/lib/auth.ts` (admin), `artifacts/ye/src/lib/family-auth.ts` (family), `artifacts/ye/src/lib/kid-auth.ts` (child PIN/session), `artifacts/ye/src/lib/instructor-auth.ts` (instructor), `artifacts/ye/src/lib/otp.ts` (SMS OTP), `artifacts/ye/src/lib/chat-auth.ts` (chat ownership + CSRF)
- **List/pagination helper**: `artifacts/ye/src/lib/admin-list-query.ts` — keyset cursors + LIKE-escaped search filters (`bookingFilter`/`runFilter`), all server-side validated
- **Highest-risk areas**: `/svc/admin/nelc/route.ts` (LRS credential relay, step-up auth), `/svc/pay/*` (payment webhooks and sweep), `/svc/instructor/notes/route.ts` (versioned optimistic-lock saves)
- **Admin surface**: All `/svc/admin/*` routes protected by `requireAdmin()` in `guard.ts`
- **Webhook endpoints**: `/svc/pay/webhook/moyasar/route.ts`, `/svc/pay/webhook/tamara/route.ts` (both HMAC/JWT-verified, fail-closed)
- **Dev-only areas**: Dev preview is blocked from NELC outbox dispatch; `devCode` is only returned for OTP in non-production.

## Threat Categories

### Spoofing

Family sessions are HMAC-SHA256 signed (`ye_family.<familyId>.<expiry>.<sig>`) with a 30-day TTL. Admin sessions use a similar scheme with a 7-day TTL. Instructor tokens are HMAC-signed and carry an `authVersion` so admin can revoke them. The `SESSION_SECRET` must be set in production or requests throw at runtime (fail-closed guard). The admin password is now compared in constant time (both sides SHA-256 hashed then `timingSafeEqual`), removing the earlier timing oracle.

### Tampering

Payment amounts are computed server-side from database-stored prices. Cart items are verified against the enrollment's enrolled price at checkout. Webhook payloads are used only to locate a payment — the status is always re-verified against the provider API before any state transition. xAPI outbox results reported by the browser are labeled `source='browser'` (unverified server-side). Instructor note saves use optimistic concurrency (`expectedVersion`) plus a row-level `FOR UPDATE` lock so a stale save cannot silently overwrite, and a revoked instructor's stale write loses. Admin list search input is escaped for SQL LIKE wildcards and all filters are built via Prisma parameterized `where` clauses.

### Information Disclosure

Admin-gated routes return PII (phone numbers, national IDs, parent names). The admin password dev fallback `'YE-Riyadh-2026'` is hardcoded in source; the production value must differ (fail-closed: missing `ADMIN_PASSWORD` throws in production). OTP codes are returned in the API response only in non-production environments. The instructor dashboard scopes runs/students/attendance/notes to the instructor's own assignments; the receipt endpoint and all learn/account endpoints scope to the authenticated `familyId`.

### Denial of Service

The OTP flow has database-persisted rate limiting (5 codes/hour per phone). The public appointment booking and consultation routes use the durable `allowRate` helper. The admin login endpoint is now rate limited (5 attempts / 15 min per client IP). The child PIN select endpoint is now rate limited (10 attempts / 15 min per family+child). Chat send is rate limited (30 / 10 min per IP).

### Elevation of Privilege

All admin routes call `requireAdmin()` before any data access. All family routes scope DB queries to the authenticated `familyId`. Child ownership is verified with `familyId` on every child endpoint. Instructor routes verify the session instructor is assigned to the target course run before returning or mutating data, and re-check `active`/`authVersion` inside the mutation transaction. The sweep endpoint checks a Bearer secret. No SQL injection surface — all queries use Prisma parameterized statements. No file upload endpoints exist. The NELC admin relay requires password re-entry (step-up auth) before handing the LRS credential to the browser. Instructor mutations enforce same-origin/CSRF checks (`safeInstructorMutation`); chat mutations enforce `requireChatCsrf`.
