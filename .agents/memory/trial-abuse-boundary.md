---
name: Trial abuse boundary
description: Security rationale for requiring the existing family verification before trial reservations.
---
Trial seat reservations should reuse existing family phone verification, not introduce a separate trial-only verification system or rely only on public IP limits.

**Why:** Invented child/contact details bypass identity-based duplicate checks. The requested hardening should avoid new flows unless necessary; reusing family sign-in establishes verified identity without a second authentication mechanism.

**How to apply:** Keep reservation identity server-owned across public forms and chat tools. Any future guest-booking shortcut must establish equivalent verification before consuming capacity.

Public abuse limiters must not trigger retention scans on rejected requests.

**Why:** A request cap does not bound work in a limiter's cleanup/finally block. Attackers can keep forcing that work after exhausting the quota, turning the safeguard into database load.

**How to apply:** Schedule or atomically amortize cleanup, index retention timestamps, and retain short-window hit records only as long as needed.
