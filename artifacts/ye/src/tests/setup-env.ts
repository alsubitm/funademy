/**
 * Runs in each test worker BEFORE any test file is imported, so that
 * `@/lib/db` instantiates its PrismaClient against the isolated test DB.
 */
import { testDbUrl } from './test-db';

// testDbUrl() fails closed unless the resolved URL targets the ye_test DB.
process.env.DATABASE_URL = testDbUrl();
