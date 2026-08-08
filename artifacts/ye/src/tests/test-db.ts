/**
 * Tests never run against the real dev/prod database. They use a dedicated
 * disposable database (`ye_test`) on the same Postgres server, created and
 * schema-pushed by global-setup.ts before the suite runs.
 */
export const TEST_DB_NAME = 'ye_test';

export function testDbUrl(): string {
  const base = process.env.YE_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL (or YE_TEST_DATABASE_URL) must be set to run tests');
  const url = new URL(base);
  if (!process.env.YE_TEST_DATABASE_URL) url.pathname = `/${TEST_DB_NAME}`;
  // Fail closed: NEVER run tests (or `db push --accept-data-loss`) against
  // anything but the dedicated test database, even if YE_TEST_DATABASE_URL
  // was set to something else by mistake.
  if (url.pathname !== `/${TEST_DB_NAME}`) {
    throw new Error(
      `Refusing to run tests: database must be "${TEST_DB_NAME}", got "${url.pathname.slice(1)}"`,
    );
  }
  return url.toString();
}
