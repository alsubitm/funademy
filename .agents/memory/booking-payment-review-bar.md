---
name: Booking/payment design rules
description: Required design for capacity- and money-touching endpoints in this project
---
Rules for any seat/capacity or money-touching endpoint:
- Capacity checks + writes (booking, cancellation, capacity edits) run in one `db.transaction` with `SELECT ... FOR UPDATE` on the resource row.
- Credit decrements are conditional UPDATEs (`WHERE remaining >= expected`).
- Never call the payment provider inside a DB transaction. Transactions move records through durable payment states (`charge_pending`/`charged`/`refund_pending`/`refunded`); provider charges/refunds happen after commit with idempotency keys, and a scheduled reconciliation pass retries anything left pending.
- Charges/refunds go through the `PaymentProvider` abstraction, persist the provider reference, and only grant entitlements on a verified `paid` result — even with the demo provider.
- Refunds are idempotent: refund with an idempotency key, then a conditional state claim (`refund_pending → refunded`) gates the single ledger entry; persist both charge and refund references. Track exactly which package/credit a booking consumed so refunds credit that record.
- Access (join links, materials, attendance) requires a settled payment; ineligible records must not be activated via side channels (e.g. attendance must not activate waitlisted/cancelled bookings).

**Why:** Read-then-write capacity checks, in-transaction provider calls, non-idempotent refunds, and refs-less payments create real oversell and double-charge/double-refund risks once a real gateway replaces the demo provider.

**How to apply:** Design booking-, inventory- or billing-like endpoints with these patterns up front instead of retrofitting after review.
