---
name: Database retry safety
description: The safety boundary for recovering from temporary Prisma/PostgreSQL connection failures.
---

Retry reads for recognized transient connection failures. Retry a complete database transaction only when the failure proves it never began or PostgreSQL aborted it, such as P1001/P1002/P2024 or SQLSTATE 57P01 administrator termination. Do not replay a transaction after an ambiguous connection reset or P1017.

**Why:** A connection can disappear after PostgreSQL committed but before the client received acknowledgement. Blindly replaying seat or money transactions can double-apply work. Administrator termination explicitly aborts the backend, while an ambiguous reset does not prove the commit outcome.

**How to apply:** Keep external provider calls outside retries. Wrap safe reads and whole atomic/idempotent transactions at critical login, booking, and payment boundaries; add fault-injection tests that assert the user flow succeeds once and state changes exactly once.