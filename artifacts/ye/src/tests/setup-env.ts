/**
 * Runs in each test worker BEFORE any test file is imported, so that
 * `@/lib/db` instantiates its PrismaClient against the isolated test DB.
 */
import { testDbUrl } from './test-db';

// testDbUrl() fails closed unless the resolved URL targets the ye_test DB.
process.env.DATABASE_URL = testDbUrl();

// Provider secrets must NEVER reach test workers: with the live-by-presence
// pattern (payments, SMS) a present key makes library code call the REAL
// provider. Suites that exercise provider paths re-set a fake key per test
// via vi.stubEnv and mock fetch (see sms-authentica.test.ts).
// (Incident 2026-08-12: family-account tests delivered real SMS to random
// phone numbers once AUTHENTICA_API_KEY was added to the workspace.)
// NELC_LRS_* stay untouched: sending is gated by outboxActive()/NELC_LIVE,
// and the opt-in live spec reads the real staging creds deliberately.
delete process.env.AUTHENTICA_API_KEY;
delete process.env.MOYASAR_SECRET_KEY;
delete process.env.TAMARA_API_TOKEN;
delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
