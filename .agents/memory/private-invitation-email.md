---
name: Private invitation email safety
description: Why private student messages need immutable retries and a finite retry window.
---

Private student links must go to only the intended guardian after consent, separately from shared Calendar events.

**Why:** Calendar guest privacy settings do not make its shared description recipient-specific. A private student link grants access, so putting it there can expose another child's session.

Retries must preserve both the provider key and the original message, even after a student name correction. Commit the payload and attempt timestamp before any provider call, and stop uncertain retries before the provider's deduplication period expires.

**Why:** A provider can accept a message even if the request times out or the local transaction rolls back. Resend retains idempotency keys for 24 hours; a later retry can send again, while changing the payload earlier can cause a key conflict. Conservative stopping is preferable to claiming exactly-once delivery indefinitely.

**How to apply:** Treat provider acceptance as distinct from inbox delivery. Keep failures visible per student, retain manual private sharing, and never log email bodies or bearer links. Name edits should not rewrite an attempted message.
