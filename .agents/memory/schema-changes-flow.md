---
name: Schema changes flow
description: How DB schema changes are deployed in this project (no migration files)
---
Rule: no migration files or startup DDL in this project. Schema changes are pushed directly in dev; production schema is diffed and applied automatically by Replit's Publish flow.

**Why:** The platform explicitly forbids custom migrations; Publish owns prod schema sync.

**How to apply:** Edit the schema source, push in dev, verify — never hand-write migrations for prod.
