# FunAdemy — CTO Technical Review

Date: 26 Nov 2026 · Scope: whole repo (`artifacts/ye` site + `artifacts/windmill` lab) · Read-only review, nothing in production touched.

Legend: ✅ = verified directly in code by me · 🔎 = traced by a reviewer, not re-checked · ❓ = depends on Replit/production state we can't see from code.

---

## 0. Status update (26 Nov 2026, after owner answers)

Owner answers: January 2027 = **online + in-person**. Moyasar live; Tamara + **Tabby** still to do. Online first month = **1950 SAR (includes kit)**, then 1380. Requirement: **never lose data**. Trial slots were never reset by hand.

Fixed on branch `claude/sweet-clarke-ca1mzw` (not live until merged + published):

| Item | Status |
|---|---|
| C1 boot job reverting online → in-person | ✅ removed + regression test |
| C2 trial slots filling forever | ✅ capacity now per trial date + tests |
| C3 sweep accepts admin password / `!==` | ✅ requires `SWEEP_SECRET`, constant-time; NELC step-up constant-time + throttled |
| C6 fractional sibling price crash | ✅ whole-riyal rounding + test |
| C6 renew on pending enrollment | ✅ only active enrollments renew; button hidden |
| C7 Next.js / effect advisories | ✅ next 15.5.29, effect ≥3.22.1 — `pnpm audit`: 0 known vulnerabilities |
| C4 spoofable client IP, C5 SMS pumping, expired-invoice late payment | ⏳ next batch (IP fix needs one production header check first) |

## 1. Verdict in one paragraph

The code is **better tested and more careful than most startups'**: 753 tests pass, payments are re-verified with the provider, no cross-family data leaks (IDOR) were found, and the build is lean. But effort has gone into the **wrong places**. Roughly 14% of the code is NELC plumbing and ~2,400 lines are the chat bot, while the **basics that protect the business and bring in money are missing**: no backups plan, no monitoring, no reliable scheduled jobs, prices hidden behind login, no primary "book a trial" button, and no analytics. There is also **one hard blocker for the January 2027 online launch**: the server rewrites every online class back to in-person on each restart.

## 2. Scorecard (my judgement, out of 10)

| Area | Score | Why |
|---|---|---|
| Code correctness & tests | 8 | 753 + 27 tests green, typecheck clean, isolated test DB |
| Payment safety | 6 | Strong core; 3 real money holes (below) |
| Security | 5 | Good authz; weak admin auth, spoofable rate limits, SMS pumping |
| Privacy / PDPL | 3 | Plaintext child national IDs, no deletion/retention, policy incomplete, data outside KSA |
| Operations (backup, monitoring, jobs) | 2 | None documented / none configured |
| Conversion / product | 4 | Unclear CTA, hidden prices, friction-first booking |
| Performance | 6 | JS lean (~103–125 kB); 3.2 MB of fonts preloaded |
| Maintainability | 5 | Over-built areas, AR/EN copy-paste, conflicting agent notes |
| **Jan 2027 online launch readiness** | **3** | Blocker C1 + Phase 1 gates still open |

## 3. What I ran

- `pnpm run typecheck` — clean (ye, windmill, scripts).
- `ye` vitest — **753 passed, 1 skipped** (against a throwaway local Postgres, never your DB).
- `windmill` tests — **27 passed**. Both apps build for production.
- `pnpm audit` — **4 vulnerabilities**: Next.js 15.5.28 (3 moderate, fixed in ≥15.5.29) and `effect` (1 high, fixed in ≥3.22.1).

---

## 4. P0 — fix this week (each is small)

### C1. Server start turns online classes back into in-person ✅ — LAUNCH BLOCKER
`src/instrumentation.ts:112-200` (`reconcileInPerson`) runs on **every boot**:
- sets `format: online → in_person` on Program, ScheduleSlot, CourseRun;
- rewrites «أونلاين» → «حضوري» / "online" → "in-person" inside program descriptions and FAQ answers (including admin-written text and what Nujaym reads).

Admin can create online runs with Meet links (`RunsTab.tsx:235,475`). Families only get a join link when format is online (`portal-sessions.ts:8`). **Result:** January online classes lose their join links after the next autoscale restart. `src/tests/in-person-copy.test.ts` locks the old copy in.
**Fix:** delete the block. Drive banner, slot labels, metadata and `llms.txt` from each run's format.

### C2. Free-trial slots fill up forever ✅
`src/lib/chat-booking.ts:52-55` decrements `ScheduleSlot.seatsLeft` per trial; **nothing ever adds seats back** (only admin edit/create). After 12 trials *ever*, a weekly slot shows "full" permanently. This silently chokes the top of the funnel.
**Fix:** count bookings per (slot, trial date) instead of a running counter.

### C3. Sweep endpoint is an unthrottled admin-password oracle ✅
`src/app/(ar)/svc/pay/sweep/route.ts:17-25`: secret = `SWEEP_SECRET ?? ADMIN_PASSWORD`, compared with `!==`, no rate limit. If `SWEEP_SECRET` is unset, anyone can guess the admin password here at full speed. The NELC step-up check also uses `!==` with no rate limit (`svc/admin/nelc/route.ts` ~562/602/714/762/795) 🔎.
**Fix:** require its own `CRON_SECRET`, no fallback, constant-time compare.

### C4. Rate limits can be bypassed by faking the IP header ✅/❓
`src/lib/rate-limit.ts:40-43` trusts the **first** `X-Forwarded-For` value, which the client controls (if Replit's proxy appends, as most do). This affects admin login, booking, chat and consult limits. Your own tests rotate this header to get around limits (`tests/appointments.test.ts:50`).
**Fix:** use the proxy-appended (last trusted) hop, plus a global cap on admin login.

### C5. SMS pumping can drain Authentica ✅
`src/lib/otp.ts:56-60` caps only **per phone** (5/hour). Looping through random Saudi numbers sends unlimited paid SMS. When the balance hits zero, **all parent logins fail**.
**Fix:** per-IP + global hourly caps, a provider spend cap, and a CAPTCHA after N requests.

### C6. Money bugs 🔎 (H1–H2 traced end-to-end by reviewer)
- **Expired Moyasar invoices stay payable.** `payments.ts:282-294` sets no `expired_at`; the sweep expires our record but not the invoice. A late payment means either paid-with-no-seat (only a `console.error("REFUND REQUIRED")`) or a **double charge** when the enrollment was reused by a newer checkout (`pay-core.ts:105-121`). **Fix:** set the invoice expiry below our 45-min window, re-seat only if cancelled, add a visible `needs_refund` state.
- **Renew allowed on pending enrollments** (`svc/account/renew/route.ts:40`). The renewal money can end up with no entitlement, or the paid month is overwritten. **Fix:** allow renew only when active; use `max(paidThrough, periodEnd)`.
- **Fractional sibling discount crashes checkout** ✅ `cart.ts:144` → e.g. 1375×0.9 = 1237.5 into `Int` columns (`schema.prisma:539-541`) → 500 error. Safe at 1380 today; breaks with any price not divisible by 10. **Fix:** integer halalas, round once.

### C7. Quick hygiene
- Upgrade `next` → ≥15.5.29 and `effect` → ≥3.22.1.
- Delete `public/funademy-updates.html` ✅: an internal changelog, publicly served, 780 KB, with an old price.
- **Confirm a production backup exists today** (see O1).

---

## 5. P1 — before the January launch

### Operations
- **O1. Backups / DR** 🔎: nothing in the repo describes production backups or restores. `backups/*.sql` is old curriculum content, not customer data. Set up a nightly `pg_dump` off-platform, write down the restore window, and test a restore once.
- **O2. Scheduled jobs** ✅: payment sweep, trial reminders, NELC flush and retention all run from an in-process `setInterval` (`instrumentation.ts:202`) on **autoscale**, which sleeps when idle. Nothing external calls the sweep. Reminders can arrive *after* the trial. **Fix:** a Replit Scheduled Deployment or external cron hitting `/svc/cron/*` with `CRON_SECRET`, or set min instances = 1.
- **O3. Monitoring** 🔎: no error tracking, no uptime monitor, `/healthz` doesn't check the DB, and "ADMIN ACTION REQUIRED" / "REFUND REQUIRED" exist only in logs. Add Sentry, an uptime check on a DB-aware health route, and an admin "System health" panel (stuck payments, refunds, outbox, failed messages).
- **O4. Environment identity** 🔎: "is this production?" is decided by `REPLIT_DEPLOYMENT==='1'` (`payments.ts:47`) in some places and `NODE_ENV` in others. Moving hosts (e.g. to KSA) without that variable re-opens **simulated payments in production**. Also, nothing rejects a Moyasar `sk_test_` key in production, which would mean **free enrollments via public test cards**. **Fix:** an explicit `APP_ENV`, and refuse test keys in prod.

### Security
- **S1. Admin sessions can't be revoked** ✅ `lib/auth.ts`: the token is `admin.<expiry>.<hmac>`, signed only with `SESSION_SECRET`. Logout or a password change doesn't kill a stolen 7-day session. Add a password/version stamp to the token. Later: per-person admin accounts + 2FA.
- **S2. Chat can exhaust the DB** 🔎: the OpenAI call runs **inside** a DB transaction (`svc/chat/conversations/[id]/messages/route.ts:85-217`). A few dozen concurrent messages starve checkout and OTP. Move the AI call outside the transaction, lock per conversation, and add a daily token budget.
- **S3. Dev preview may share the production DB** ❓: `.agents/memory/nelc-readiness.md:31` says "dev preview shares the prod DB/secrets". Dev fallbacks (`YE-Riyadh-2026` admin password, `ye-dev-secret`, OTP `devCode`) are gated only on `NODE_ENV`. If any secret is missing in the workspace, the public `*.replit.dev` preview becomes a way into production data. **Needs your answer.**
- **S4. Consult booking needs no login** 🔎 (`svc/appointments`): anyone can fill all slots and make your Google account send invites to any email. Trial calendar events show all parents' emails to each other (`chat-booking.ts:74-82` lacks `guestsCanSeeOtherGuests:false`).
- **S5.** No security headers (CSP/HSTS/frame-ancestors) in `next.config.ts`. JSON-LD uses raw `JSON.stringify` (escape `<`).

### Data safety
- Cascading deletes: deleting a family deletes its **payments** (`schema.prisma:533,552`). Deleting a curriculum lesson/subject deletes **every child's progress**. Deleting a child deletes attendance used for NELC. Change these to `Restrict` + archive.
- `Payment` has no `paidAt`, no currency, no unique provider reference. Receipts show "Total paid" for failed/expired payments (`svc/account/payments/[id]/receipt`).

### Conversion (revenue)
1. **One primary CTA**, «احجز حصة تجريبية مجانية», in the hero, the header and a sticky mobile bar. Today the hero scrolls to programs and "Let's talk" opens a **mailto form that stores nothing** (`FunHome.tsx:57-70`) ✅.
2. **Show prices publicly** (VAT-inclusive, sibling discount visible). Today `/enroll` says "log in first" (`EnrollFlow.tsx:172-181`).
3. **Re-order trial booking:** program → time → details → OTP at the end. Make email optional (you approved this; the code still requires it: `svc/bookings/route.ts:49-51`). Send a clear confirmation.
4. **Fix contradictory messaging:** the homepage says online, while the inner-page banner (`lib/i18n.ts:3`), OG text, `llms.txt` and trial slots say in-person.
5. **Remove staff links** (Admin / Instructor panel buttons) from the public homepage footer and nav.
6. **Add funnel analytics** (trial booked → attended → enrolled → paid). There is none today. The WhatsApp click counter always says `page:'home'`.
7. **Fonts:** 13 TTF files, 3.2 MB ✅, all preloaded on every page. Convert to woff2, subset, and keep 2 families.

---

## 6. P2 — Q1 2027 foundation

- **Schema migrations:** move from `prisma db push` + "publish copies dev schema" to `prisma migrate` with committed migrations. Today a stale merge can drop a production column that is empty in dev; there is no history or rollback.
- **CI:** GitHub Actions running typecheck, vitest + Postgres and build, publishing only from green `main`. There is no CI outside Replit today.
- **PDPL program:** encrypt and mask national IDs (today they're plaintext in 5 tables and returned in full by `/svc/account/me`). Add retention + purge jobs and a deletion workflow. Update the privacy policy to name OpenAI, Authentica, Google, NELC and Replit, plus cross-border transfer. Record guardian consent for NELC.
- **Data residency:** decide on the KSA host (the doc already shortlists GCP `me-central2` via CNTXT or Kloudbean).
- **ZATCA / Fatoora:** VAT handling, halala amounts, compliant invoices with QR. Tamara currently gets `tax_amount: 0`.
- **Tamara:** verify the endpoint paths against their real API in sandbox before offering it. A 404 is currently mapped to "failed", which could release seats of paid orders 🔎.
- **Simplify:**
  - freeze the NELC verification code;
  - delete the legacy `ye→public` migration (dead since Aug 2026 but still probed on every boot);
  - delete dead `components/home/*`, `scripts/src/hello.ts`, `screenshots/`;
  - trim Windmill's ~45 unused dependencies;
  - collapse AR/EN page copies into shared components.
- **Agent notes conflict:** `.agents/memory/ye-nextjs-artifact.md` still tells agents to use the retired `ye` schema. Following it would recreate the August outage. Clean up the notes so AI agents stop getting contradictory instructions.

## 7. What's genuinely good (keep it)

- Payment core: provider re-verification, signed return state, conditional seat decrement, refund claimed before provider call, simulation refused in production.
- Authorization: every admin route guarded; all family/child queries scoped by `familyId`; no IDOR found across 84 routes.
- Chat: the AI cannot call tools directly, actions need explicit confirmation, and answers are grounded with citations.
- Kids' platform: server-side grading, privacy-enhanced YouTube embeds, PIN rate-limited.
- Tests: isolated DB that fails closed, provider keys stripped; build survives DB outage.
- Agent notes record *why* decisions were made, which is rare and valuable.

## 8. Open questions for the owner

See the chat message; answers will change the priority order above.
