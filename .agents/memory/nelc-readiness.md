---
name: NELC readiness (Saudi e-training licensing)
description: Facts about NELC licensing/integration and how the site presents readiness
---
- NELC (المركز الوطني للتعليم الإلكتروني) + TVTC issue a **unified license** for Saudi e-training platforms; licensed platforms can then apply for **technical integration with FutureX** (the national platform) to publish programs.
- nelc.gov.sa and futurex.nelc.gov.sa block automated fetching (Cloudflare) — use search snippets, don't retry webFetch.
- Site stance: never claim a license before issuance. `NELC_LICENSE_NO` constant is the single switch — empty ⇒ /nelc page + footer say "قيد الإعداد"; filled ⇒ license number shows automatically in both.
- Compliance surface = /privacy, /terms, /nelc (+ /en mirrors). Owner must review refund/support wording before relying on it legally.
- **Why:** licensing claims are legally sensitive; keeping them driven by one constant prevents stale/false claims scattered in copy.
