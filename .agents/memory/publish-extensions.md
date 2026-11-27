---
name: Publish does not install PostgreSQL extensions
description: Why trigram (pg_trgm) indexes fail at publish and how production gets the extension.
---
Publish copies tables, columns and indexes, but not `CREATE EXTENSION`. The Prisma `extensions = [pg_trgm]` declaration only takes effect in development.

**Why:** Publish fails with "operator class ... does not exist" when an index needs an extension production has not installed. The owner chose to keep such indexes and enable extensions manually.

**How to apply:** Before publishing any schema that needs a new extension, the owner must enable it in production first. The agent's production access is read-only, so it cannot run this itself.
