---
name: Schema changes flow
description: How DB schema changes are deployed in this project (no migration files)
---
Rule: schema changes go in `artifacts/ye/prisma/schema.prisma` and are applied with `npx prisma generate && npx prisma db push` (dev). Production schema is diffed and applied automatically by Replit's Publish flow — never write migration files or startup DDL.

**Why:** The platform (database skill) explicitly forbids custom migrations.

**How to apply:** Edit schema, run push, verify in dev. When adding enum values (like `expired` on `PaymentTxStatus`), push handles it automatically.
