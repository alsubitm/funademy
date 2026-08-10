/**
 * LIVE verification against the REAL NELC LRS — deliberately NOT part of the
 * normal suite (it sends real statements). Runs only when NELC_LIVE=1 AND an
 * explicit test national ID is supplied (never stored in source — PII):
 *
 *   NELC_LIVE=1 NELC_LIVE_NATIONAL_ID=<test-id> pnpm exec vitest run src/tests/nelc-live.test.ts
 *
 * Sends the full 10-statement journey for the test learner's national ID so
 * the FutureX wizard's «بدء الاختبار» can verify it. Safe to re-run — every
 * run uses fresh statement UUIDs and a fresh registration. Works unchanged
 * for wizard step 3 later: just swap the NELC_LRS_* env values to production.
 */
import { describe, expect, it } from 'vitest';
import {
  buildJourneyStatements,
  DEFAULT_COURSE_IRI,
  lrsConfigured,
  lrsEnvironment,
  sendStatement,
} from '@/lib/xapi';

const live = process.env.NELC_LIVE === '1';
// REQUIRED, no default: a real person's national ID must never live in source
// control nor be submitted implicitly.
const nationalId = process.env.NELC_LIVE_NATIONAL_ID || '';

describe.skipIf(!live)('LIVE NELC LRS journey (NELC_LIVE=1)', () => {
  it(
    'the LRS accepts all 10 journey statements',
    async () => {
      expect(lrsConfigured(), 'NELC_LRS_ENDPOINT/KEY/SECRET must be set').toBe(true);
      expect(
        /^\d{10}$/.test(nationalId),
        'set NELC_LIVE_NATIONAL_ID explicitly (10 digits) — refusing to default a national ID',
      ).toBe(true);
      console.log(`[live] environment=${lrsEnvironment()} nationalId=${nationalId} course=${DEFAULT_COURSE_IRI}`);
      const journey = buildJourneyStatements(nationalId, DEFAULT_COURSE_IRI);
      for (const step of journey) {
        const res = await sendStatement(step.statement);
        console.log(
          `[live] ${step.key}: HTTP ${res.httpStatus} ${res.ok ? 'accepted' : res.response.slice(0, 300)}`,
        );
        expect(res.ok, `${step.key} rejected: HTTP ${res.httpStatus} ${res.response.slice(0, 500)}`).toBe(true);
      }
    },
    240_000,
  );
});
