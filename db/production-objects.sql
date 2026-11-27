-- Database parts that Publish does not copy to production.
-- Run once in the PRODUCTION SQL console (Enable Editing) BEFORE publishing.
-- Safe to re-run; it does not touch any data or tables.

-- Required by the trigram (gin_trgm_ops) search indexes declared in
-- artifacts/ye/prisma/schema.prisma.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
