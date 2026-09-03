---
name: WhatsApp support delivery safety
description: Durable correctness rules for receiving and sending WhatsApp support messages.
---

Use one retained canonical thread per normalized sender, protected by both a durable unique hash and a transaction-scoped advisory lock. Verify webhook signatures against the exact raw body and store inbound message, thread, consent audit, and redaction outcome atomically.

**Why:** webhook duplicates and concurrent first messages can otherwise split one family across threads; outbound transport timeouts can mean the provider accepted a message even when the app did not receive confirmation.

**How to apply:** every staff reply needs a client idempotency key and a durable queued-to-sending claim. Never auto-resend after dispatch begins; mark timed-out or interrupted attempts as uncertain, reconcile stale claims independently, and let provider receipts advance delivery state monotonically.