---
name: YE SMS OTP delivery (Authentica)
description: How family-login OTP SMS delivery works via Authentica, and the reliability rules that keep it honest.
---

# Authentica (authentica.sa) OTP delivery

**Delivery-only carrier.** Authentica's `POST /api/v2/send-otp` supports *custom OTPs* (`otp` in body), so the app generates, HMAC-stores, rate-limits, and verifies its own codes; Authentica only transports them. Their `verify-otp` endpoint is deliberately unused — using it would break the peek-without-consume flow (new-family name step).
**Why:** keeping verification in-app means provider choice is swappable and the security model (attempt caps, HMAC with SESSION_SECRET) stays in one place.

**Live switching:** purely by `AUTHENTICA_API_KEY` presence, in ANY environment (same pattern as payments). Key present → real send, `devCode` suppressed everywhere. Key absent → dev echoes `devCode`, production fails closed (`sms_not_configured`). Auth header is `X-Authorization` (not Bearer). Optional: `AUTHENTICA_OTP_METHOD` (`whatsapp`), `AUTHENTICA_TEMPLATE_ID` (numeric); sender name is configured on their dashboard, not per call.

**Reliability rules (architect-reviewed):**
- Persist the OTP row BEFORE calling the provider. A send timeout/failure is an UNKNOWN outcome, not proof of non-delivery — a late-arriving SMS must still verify. `verifyOtp` checks the latest unconsumed row, so after retries the newest SMS wins.
- Every attempt (success or failure) consumes the hourly per-phone quota, so provider calls (= money) are hard-capped even when the provider is down.
- Quota check + insert run under `pg_advisory_xact_lock(hashtext('otp:'||phone))` so concurrent requests can't blow past the cap.

**Facts (checked Aug 2026):**
- `api.authentica.sa` is reachable from US egress — no Saudi-only geo-block (unlike NELC's LRS; no browser relay needed).
- Their public API is OTP/verification-only: send-otp, verify-otp, balance, face/voice verification. NO generic transactional-SMS endpoint — future SMS notifications (e.g. renewal reminders backlog task) need a different product/provider or a template-based workaround.
- API keys come from portal.authentica.sa/applications.

**How to apply:** any new OTP channel or SMS provider swap goes through `deliverOtp()` in the OTP lib; keep persist-before-send ordering and the advisory-lock quota; never log codes or provider response bodies (they can echo the code).
- Admin SMS health: ye_otp_codes.delivered (null = no real provider call) feeds failure counts; Authentica balance is admin-only, cached ~5min in-module, and NEVER substitutes a stale/fake number on provider error.
- Low-balance admin alert: since Authentica has no generic SMS endpoint, the alert rides send-otp with `{otp} = balance SAR` (set AUTHENTICA_ALERT_TEMPLATE_ID for readable Arabic text). Fired after each OTP request (fire-and-forget, cached balance), dedup'd atomically in ye_admin_alerts to once/24h — the claim is taken BEFORE the send so a failed send waits out the cooldown instead of retrying paid calls. Recipient: ADMIN_ALERT_PHONE, default business WhatsApp number.
