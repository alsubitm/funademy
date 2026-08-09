---
name: YE payments live/simulated switching
description: How Funademy payment providers go live and the invariants around pending enrollments/seats
---

Providers auto-switch to live by secret presence: Moyasar when `MOYASAR_SECRET_KEY` set, Tamara when `TAMARA_API_TOKEN` set. No flag needed — absence means simulated mode, clearly badged in UI/receipts.

**Why:** dev/preview must keep working with no credentials; the merchant adds secrets and live payments start with zero code changes.

**Key invariants:**
- Seats + `pending` enrollments + `initiated` payment created atomically BEFORE redirect to provider page.
- Settlement (return URL and webhooks) re-verifies status via provider API (`verifyPayment`) — never trusts redirect params. Guarded `updateMany` makes initiated→paid/failed idempotent.
- Tamara: only returns `paid` after capture succeeds or status is `fully_captured`. Authorised-but-uncaptured → `pending`.
- Timeout sweep marks overdue payments `expired` (not `failed`): seats released but payment remains reconcilable. If provider later confirms paid, `finalizePayment` re-seats or logs for refund. Terminal failure uses `failed` status only when provider explicitly declines.

**How to apply:** check `providerLive()` in `src/lib/payments.ts`; never hardcode a test-mode boolean. Webhook expiry uses `SWEEP_SECRET` or `ADMIN_PASSWORD`.

## Refunds (admin)
Provider refunds are external financial ops: claim `paid → refunding` atomically (guarded updateMany) BEFORE calling the provider so concurrent requests can't duplicate the refund. Classify failures — definitive pre-execution rejections (4xx, lookup failures) roll back to `paid`; ambiguous outcomes (timeout/5xx/lost response) reconcile by re-reading provider state, and if still unknown stay `refunding` (fail closed, manual reconciliation) — never auto-retry an unknown refund.

## Webhook verification schemes (per official docs — do not "generalize" to HMAC headers)
- Moyasar does NOT sign webhooks with an HMAC header: every payload carries a `secret_token` field to compare (timing-safe) against MOYASAR_WEBHOOK_SECRET.
- Tamara sends a JWT `tamaraToken` (HS256, signed with the notification token) in `Authorization: Bearer` and/or `?tamaraToken=` query param — verify sig + alg pin + exp; no body HMAC.
**Why:** initial implementation assumed body-HMAC headers for both; real production webhooks would all have been 401-rejected.
**How to apply:** any new payment provider webhook — check the provider's actual notification-auth spec before coding; never assume a signature header convention.
