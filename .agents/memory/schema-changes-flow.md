---
name: Schema changes flow
description: How DB schema changes are deployed in this project (no migration files)
---
Rule: schema changes go in `lib/db/src/schema/` and are applied with `pnpm --filter @workspace/db run push` (dev). Production schema is diffed and applied automatically by Replit's Publish flow — never write migration files or startup DDL.

**Why:** A completion code review once rejected work demanding a versioned migration; the platform rule (database skill) explicitly forbids custom migrations — explaining this in `drift_reason` with a fresh review passed.

**How to apply:** For any new table/column: edit schema, push, verify in dev; if a reviewer asks for migrations, cite the Publish-flow rule instead. Same rule applies to the Prisma-managed `ye` artifact (`pnpm --filter @workspace/ye run db:push`) — a review rejecting "no committed migration" for new Prisma columns passed once the Publish-flow rule was cited in `drift_reason` with a fresh review.
