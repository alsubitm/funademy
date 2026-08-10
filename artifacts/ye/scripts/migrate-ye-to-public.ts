/**
 * CLI wrapper for the one-time ye→public schema cutover.
 * Used by scripts/post-merge.sh (main dev DB) — production runs the same
 * migration automatically at boot via src/instrumentation.ts.
 *
 *   pnpm --filter @workspace/ye run db:legacy-migrate
 */
import { PrismaClient } from '@prisma/client';
import { migrateYeSchemaToPublic } from '../src/lib/migrate-ye-schema';

const prisma = new PrismaClient();
migrateYeSchemaToPublic(prisma)
  .then(async (res) => {
    console.log('[db:legacy-migrate]', JSON.stringify(res));
    await prisma.$disconnect();
    if ('aborted' in res && res.aborted) process.exit(2);
  })
  .catch(async (e) => {
    console.error('[db:legacy-migrate] failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
