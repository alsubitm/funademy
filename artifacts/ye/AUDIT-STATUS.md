# FunAdemy audit — technical report

Date: 27 November 2026. Branch `audit-funademy-remediation-20261118`.
Scope: development workspace only. Nothing was published; no customers were contacted;
no real bookings, charges, refunds or credential rotations were made; no data was deleted.
The live site (https://funademy.io) still runs the previously published build and is **not** fixed until
these changes are reviewed and published.

## Verification results (this revision, after the two task merges)

| Check | Result |
|---|---|
| `pnpm --filter @workspace/ye db:push` (development, guarded) | In sync |
| `pnpm --filter @workspace/ye typecheck` | Passed |
| `pnpm --filter @workspace/ye test` (isolated `ye_test` DB) | 60 files passed, 1 skipped; **809 tests passed, 1 skipped, 0 failed** (final revision, including two new payment-ownership regression tests) |
| `pnpm --filter @workspace/ye run build` | Succeeded with the middleware; the later payment-hold and admin-URL fixes were checked by typecheck and tests, not a second build |
| Playwright browser suite with system Chromium (`pnpm exec playwright test`) | First run 47 passed, 1 failed (admin filters reset — fixed, see below); rerun **48 passed, 0 failed**. Typecheck passed after the fix |
| Static security scan | No findings (not proof of absence) |
| Preview `/enroll` screenshots (desktop 1280×720, mobile 390×844) | Public catalog renders logged out |

Not done: tests on real phones/tablets, Safari/Firefox engines, screen readers, or against production.

## Status per issue

| Area | Issue | Status | Main files |
|---|---|---|---|
| OTP | Older codes stayed valid; non-atomic consumption | Fixed | `src/lib/otp*`, `audit-otp.test.ts` |
| Payments | Simulation possible in production | Fixed: production never simulates | `src/lib/payments.ts` |
| Payments | Amount/currency not verified | Fixed: SAR minor units and currency checked | `src/lib/payments.ts` |
| Payments | Partial / authorized-only Tamara states could enroll | Fixed; capture conflicts rechecked | `src/lib/payments.ts` |
| Payments | Previously simulated "paid" rows trusted | Fixed: re-verified | `src/lib/pay-core.ts` |
| Payments | Paid but no seat shown as success | Fixed: durable `enrollmentIssue`, parent + admin warnings, `payreview` return state | `pay-core.ts`, checkout route, pay return route, portal/admin |
| Payments | Expiry/settlement and renewal races | Fixed with row locks | `pay-core.ts` |
| Payments | Late success of an expired payment after a retry already paid was recorded as a normal success | Fixed: flagged `duplicate_payment_enrollment_already_active` for manual review; coverage and seats unchanged; regression test added | `pay-core.ts`, `payments.test.ts` |
| Payments | Late failure of an expired payment could cancel a newer checkout's seat hold on the reused enrollment row | Fixed: only an `initiated` payment releases holds; enrollment rows locked; regression test added | `pay-core.ts`, `payments.test.ts` |
| Payments | Provider response bodies in logs | Fixed | `src/lib/payments.ts` |
| Payments | Automatic refunds | Intentionally not added: flagged for manual review | — |
| Booking | Enrollment with venue "Riyadh"/empty | Blocked in UI, cart, checkout (row lock) and trial booking (row lock) | `classroom-location.ts`, checkout, `chat-booking.ts` |
| Public info | Prices/schedules hidden behind login | Fixed: public catalog at `/enroll`; login keeps selected group | `/enroll` pages |
| Public info | Broken pricing/FAQ/legal links | Fixed | header, footer |
| Public info | Tax, session count, kit, renewal terms | Marked "to be confirmed before payment" — owner facts needed | catalog |
| Privacy | Watanona wall published names without consent | Fixed: consent stored, author anonymised, unconsented posts hidden (not deleted) | `svc/bricks`, schema |
| Privacy | Policy omitted public wall and OpenAI processing | Fixed; no Saudi-only hosting claim | privacy pages (ar/en) |
| Content | Watanona date ambiguity | Planned 23 Sep 2027, "confirm details" | watanona page |
| Security | Cross-site state changes | Origin/fetch-site check on `/svc/*` (webhooks exempt) | `src/middleware.ts`, `audit-csrf.test.ts` |
| Security | Missing headers | Added; CSP is **report-only**, not enforced | `next.config` |
| Security | picomatch CVE-2026-112366 (dev tooling) | **Open** — no patched release available | — |
| Performance | 13 font preloads (3,190,040 bytes on published site) | 0 preloads in preview; fonts not converted to WOFF2 | layout, `generated-artifacts/audit-font-measurement.json` |
| SEO | Invented sitemap `lastmod` | Removed (real blog dates kept) | sitemap |
| Admin | Booking/run filters intermittently reset after typing (found by browser tests after a merge) | Fixed: history updates now let the router sync the URL | `src/components/admin/useAdminQuery.ts` |
| Tests | Chat test broke once test-DB IDs formed a 13-digit run (blocked as a possible card number, correctly) | Test now uses a short free program ID | `chat-support.test.ts` |
| Tests | Viewport debug logs | Replaced with assertions | browser tests |

## Database impact

Additive only, nothing dropped:
- Audit columns: `Payment.enrollmentIssue`, `Payment.enrollmentIssueAt`, `WatanBrick.publicConsentAt` (nullable).
- From the merged admin paging work: the `pg_trgm` PostgreSQL extension, GIN trigram search indexes on booking,
  program and course-run text fields, and B-tree paging indexes (`status,id`, `programId,id`, `active,id`, `seatsLeft,id`).
  Creating the extension needs database permission for `CREATE EXTENSION`, and building the indexes briefly locks writes on those tables.

Applied to development and the isolated test DB. Production gets them only through the Publish schema review.
Existing wall posts without consent become hidden; nothing is deleted.

## Facts needed from the owner

1. Current schedules and exact venues for in-person groups (until set, those groups cannot be booked).
2. Price inclusions: VAT, number of sessions, kit, renewal terms.
3. Whether online January 2027 classes are open for enrollment.
4. Licence authority and type for registration 4030388340.
5. Watanona event time and venue.
6. Approval of privacy/retention wording (assistant chats kept 90 days).

## Staging and rollback plan

1. Review this branch; publish to production only after owner approval and the facts above.
2. On Publish, review the schema diff: three nullable columns, the `pg_trgm` extension and the new indexes; confirm nothing is dropped. Publish at a quiet hour because index creation briefly blocks writes.
3. After publish: open `/enroll` logged out, run one sandbox-free low-value real payment only with owner consent,
   check the admin "payment needs review" view, and watch logs for `ADMIN ACTION REQUIRED` / `REFUND REQUIRED`.
4. Rollback: restore the previous checkpoint/deployment. Keep the new columns (do not drop financial or consent history).
   The extension and indexes can stay in place after a rollback.
   Note: rolling back re-exposes wall author names and the older payment behaviour.

## Is production approval safe?

Technically the branch is ready for review: typecheck, full test suite and build pass. It should not be published
until the owner confirms the facts above and reviews the privacy wording. The picomatch advisory remains open and the
content security policy is not enforced.
