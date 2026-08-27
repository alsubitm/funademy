---
name: Replit AI setup availability
description: Environment-specific constraint when provisioning a Replit-managed AI provider.
---

The documented Replit AI provisioning callback may be unavailable in the task runner even after the provider skill is loaded and the documented retry sequence is exhausted.

**Why:** Guessing a gateway URL or compatibility credential would bypass the managed integration boundary and could create an insecure or non-billable provider path.

**How to apply:** Use only the documented managed integration variables in application code, fail closed when they are absent, and preserve a truthful non-AI fallback. Never request or fabricate a key when the product requirement explicitly requires Replit-managed billing.