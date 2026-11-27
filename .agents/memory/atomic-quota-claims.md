---
name: Atomic quota claims
description: PostgreSQL snapshot semantics when reducing rate-limit database round trips.
---

Do not replace a multi-statement lock/count/insert transaction with a single
advisory-lock CTE followed by a count and assume it remains race-safe.

**Why:** Under READ COMMITTED, a statement's snapshot can predate waiting for
the advisory lock. Concurrent requests can therefore count stale quota usage.
ON CONFLICT row updates instead evaluate against the conflicting row's current
version, allowing an atomic bounded sliding-window claim in one round trip.

**How to apply:** When optimizing quotas, test concurrent admissions against the
real database, preserve durable cross-instance limits and fail-closed behavior,
and retain pre-upgrade claims until their windows expire.

Cleanup must recheck expiry on the DELETE target itself, not only inside an
ID/key-selection subquery.

**Why:** A quota writer can renew a row after cleanup's snapshot, then commit
while DELETE waits for its row lock. A key-only outer predicate can delete the
newly live claims; an outer expiry predicate is re-evaluated after the wait.

**How to apply:** Verify retention races with a real held renewal transaction
and prove cleanup is waiting on that writer before committing it.
