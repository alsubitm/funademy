---
name: NELC readiness (Saudi e-training licensing)
description: Durable constraints for NELC licensing, the LRS verification test, and the geo-block that dictates who can send statements
---
- NELC (المركز الوطني للتعليم الإلكتروني) + TVTC issue a **unified license** for Saudi e-training platforms; licensed platforms can then apply for **technical integration with FutureX** (the national platform) to publish programs.
- nelc.gov.sa and futurex.nelc.gov.sa block automated fetching (Cloudflare) — use search snippets, don't retry webFetch. The FutureX wizard lives at services.futurex.sa (login required).
- Site stance: never claim a license before issuance. `NELC_LICENSE_NO` constant is the single switch — empty ⇒ /nelc page + footer say «قيد الإعداد». **Why:** licensing claims are legally sensitive; one constant prevents stale/false claims scattered in copy.
- Compliance surface = /privacy, /terms, /nelc (+ /en mirrors). Owner must review refund/support wording before relying on it legally.

## LRS verification test (wizard step 2)
- The ONLY authoritative statement-format source is NELC's own wizard guide + github.com/nelc/laravel-lrs-package — generic xAPI/cmi5 docs give a DIFFERENT (wrong) shape. The wizard rejects journeys spanning multiple activity ids → one course IRI for the whole journey; the wizard is retried repeatedly → fresh statement UUIDs every run.
- Never fake success when LRS credentials are missing — falsely "passing" a government verification is the worst failure mode. Wizard step 3 (production) = same code, different NELC_LRS_* values; no separate build.

## Geo-block → who can send, and what the audit log can honestly claim
- lrs.nelc.gov.sa (Cloudflare) rejects ALL non-Saudi datacenter egress with an HTML 403 block page — credentials/headers irrelevant. US-hosted servers can never POST to it directly, and can never CONFIRM delivery either.
- **Decision:** the staging test is sent from the owner's browser (device inside KSA). Consequences to preserve: browser-reported outcomes must stay labeled "unverified server-side" (NELC's wizard check is the real authority), and the LRS Basic credential handed to the browser is an explicitly accepted, documented risk — acceptable ONLY because the app has a single admin (the owner, whose own credential it is), handing it over requires re-entering the admin password (step-up beyond the session cookie), and the credential is scoped to the platform's own LRS store. Never expose it to non-admin users; production auto-sending of real learner events needs NELC IP allowlisting or KSA egress instead.
- Real LRS creds may exist in the workspace env → test suites must explicitly clear NELC_LRS_* per test, and any live-send spec must require an explicit opt-in flag AND an explicitly supplied national ID (never a default ID in source — PII).
