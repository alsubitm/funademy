---
name: Publish does not install PostgreSQL extensions
description: Why trigram (pg_trgm) indexes fail at publish and how production gets the extension.
---
Publish copies tables, columns and indexes, but not `CREATE EXTENSION`. The Prisma `extensions = [pg_trgm]` declaration only takes effect in development.

**Why:** The first publish with gin_trgm_ops indexes failed with "operator class gin_trgm_ops does not exist" because production had pg_trgm available but not installed (2026-11-27). The owner chose to keep the indexes and enable the extension manually.

**How to apply:** Before publishing any schema that needs a new extension, the owner runs `db/production-objects.sql` in the production SQL console. The agent's production access is read-only, so it cannot run this itself.
