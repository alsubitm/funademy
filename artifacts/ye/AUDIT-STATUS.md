# FunAdemy audit — work in progress

Date: 18 November 2026. This is **not a release approval or completed audit**.
No publishing, customer communications, real charges/refunds or real bookings were performed.

## Verified so far

- 125 focused payment/OTP tests passed across payments.test.ts, audit-settlement.test.ts and audit-otp.test.ts.
- TypeScript passed after the public catalog/privacy changes.
- New payment issue columns were added to development and isolated tests only.
- Static security scan returned no findings (not proof of absence).
- Production metadata reports a successful published build at https://funademy.io; this does not identify the deployed source revision or prove these changes are live.

## Implemented, still undergoing whole-task verification

- Atomic latest-code OTP consumption, resend invalidation and expiry boundary.
- Authoritative SAR/minor-unit verification; partial/authorized Tamara transactions cannot enroll.
- Capture conflicts require authoritative recheck; production cannot simulate missing payment providers.
- Payment-row locking and fresh enrollment state prevent expiry/settlement seat races.
- Persisted paid-but-unconfirmed enrollment state, admin attention and parent warnings. The checkout completion endpoint does not present these as success.
- Public course runs/pricing on existing enrollment pages; selected group can be carried through account login.
- Pricing navigation points to the catalog; footer legal links and cross-page FAQ navigation fixed.
- Optional public wall messages require recorded consent and moderation. Public authors are anonymized; old posts lacking recorded consent are hidden, not deleted. Removal requests use existing contact/admin moderation.
- Privacy pages disclose public messages and OpenAI through Replit; no Saudi-only hosting claim.
- Watanona explicitly identifies the planned date as 23 September 2027 and asks users to confirm time/venue.
- Security headers and report-only CSP; no claim that CSP is enforced.
- Five secondary font families no longer preload; fonts remain self-hosted. No WOFF2 conversion or measured byte reduction claimed.
- Sitemap no longer emits invented static/program last-modified dates; actual blog updatedAt remains.

## Findings still open

- High dependency advisory GHSA-fc5q-39xc-vjpf / CVE-2026-112366 affects transitive picomatch 4.0.5 in development tooling. Registry latest checked was 4.0.7, also within advisory's affected range. No safe patched release identified; no firewall bypass or misleading version bump.
- Privacy scanner flagged two viewport debug logs as phone-number output. They held browser layout diagnostics, not telephone values; replaced with actual overflow assertions.
- Full payment recovery workflow, renewal races and provider log sanitization need further review.
- In-person venue confirmation is currently displayed/blocked in public catalog UI, but server-side enforcement is not yet complete.
- Full commercial terms, current/planned online availability, schedules, tax/kit inclusions and license issuing authority require owner confirmation.
- Full-suite results, build, mobile/keyboard/browser journey coverage, Nujaym retention audit, performance measurement and final Arabic/English reports remain pending.

## Database/release handling

Additive Payment enrollmentIssue/enrollmentIssueAt and WatanBrick publicConsentAt fields. Use guarded development db:push; no production DDL scripts. Production schema changes require review in Publish. Preserve columns on application rollback rather than dropping financial/consent history.

## Commands run

```
pnpm --filter @workspace/ye exec prisma generate
pnpm --filter @workspace/ye db:push
pnpm --filter @workspace/ye typecheck
pnpm --filter @workspace/ye exec vitest run src/tests/payments.test.ts src/tests/audit-settlement.test.ts src/tests/audit-otp.test.ts
pnpm --filter @workspace/ye exec vitest run src/tests/brick-wall.test.ts src/tests/local-fonts.test.ts
```

The last command initially found one legacy moderation fixture missing the new explicit consent field; fixture updated, rerun pending. It is not recorded as passing.

Latest checks: development schema synced again after consent field; typecheck passed. Preview restarted cleanly and /enroll rendered at 390×844. Full suite started with NELC_LIVE=0 on isolated ye_test; outcome pending. No browser interaction pass has yet been run.
