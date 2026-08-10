/** Vitest globalSetup: provision the isolated ye_test database. */
import { execSync } from 'child_process';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { testDbUrl, TEST_DB_NAME } from './test-db';

export default async function globalSetup() {
  const testUrl = testDbUrl();

  // 1. Create the test database if it doesn't exist (connect to the main DB).
  const admin = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  try {
    const exists = await admin.$queryRawUnsafe<{ n: number }[]>(
      `SELECT 1 AS n FROM pg_database WHERE datname = '${TEST_DB_NAME}'`,
    );
    if (exists.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE ${TEST_DB_NAME}`);
    }
  } finally {
    await admin.$disconnect();
  }

  // 2. Push the Prisma schema into the test database.
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });

  // campaign_counters / campaign_brick_events are now declared in
  // schema.prisma (public schema), so db push above creates them too.
}
