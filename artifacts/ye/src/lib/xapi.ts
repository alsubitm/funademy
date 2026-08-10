/**
 * xAPI / LRS client for the NELC (المركز الوطني للتعليم الإلكتروني) technical
 * integration — sends learner-journey statements to NELC's Learning Record
 * Store (LRS) so the FutureX wizard's verification test (اختبار التحقق) can
 * find them for the test learner's national ID.
 *
 * CONFIGURED vs NOT CONFIGURED
 * ----------------------------
 * Follows the payments env-gating pattern — the client is active only when
 * the LRS secrets are present:
 *   - NELC_LRS_ENDPOINT  xAPI endpoint, e.g. https://lrs.nelc.gov.sa/lrs-license-stg/xapi
 *                        (with or without a trailing /statements)
 *   - NELC_LRS_KEY       Basic-auth username / key
 *   - NELC_LRS_SECRET    Basic-auth password / secret
 * Optional:
 *   - NELC_LRS_ENV       'staging' (default) | 'production' — label recorded
 *                        with every statement log row. Wizard step 3 later
 *                        just swaps these env values; no code change.
 * Unlike payments there is deliberately NO simulated fallback: with secrets
 * missing the admin tool must say «غير مهيأ» and never fake an accepted
 * statement.
 *
 * WHY THE ADMIN UI SENDS FROM THE BROWSER
 * ---------------------------------------
 * NELC's WAF (Cloudflare) geo-blocks lrs.nelc.gov.sa for our hosting egress
 * (non-Saudi datacenter IP) — every server-side request, even a GET /about
 * with valid credentials, returns an HTML 403 block page. The admin route
 * therefore PREPARES the statements server-side and the authenticated owner's
 * browser (inside Saudi Arabia) POSTs them to the LRS directly, then reports
 * the results back for the audit log. sendStatement() below remains for
 * egress-allowed environments and the manual NELC_LIVE spec.
 *
 * STATEMENT FORMAT (staging verification journey)
 * -----------------------------------------------
 * Matched to NELC's own wizard guide («كيفية إرسال البيانات إلى نظام تسجيل
 * التعلم (LRS)») and NELC's official integration packages
 * (github.com/nelc/laravel-lrs-package):
 *   - Full journey = 10 statements, in this exact order:
 *     registered → initialized → watched → completed (lesson) → attempted →
 *     completed (unit) → progressed → completed (course) → rated → earned
 *   - actor = { mbox: 'mailto:<nationalId>@gmail.com', name: '<nationalId>',
 *     objectType: 'Agent' } — NELC verifies by actor.name = national ID; the
 *     mbox pattern is exactly what the wizard's personalized example shows.
 *   - EVERY statement uses the SAME course IRI as its object — the wizard
 *     warns that multiple course ids break verification
 *     («لتجنّب خطأ تعدّد معرّفات الدورة»).
 *   - verb displays are en-US only, exactly like NELC's examples.
 */

import { randomUUID } from 'crypto';

export type JourneyStepKey =
  | 'registered'
  | 'initialized'
  | 'watched'
  | 'completed_lesson'
  | 'attempted'
  | 'completed_unit'
  | 'progressed'
  | 'completed_course'
  | 'rated'
  | 'earned';

/**
 * The full NELC verification journey, in required order. Verb IRIs are the
 * ones NELC's own packages send (ADL verbs + acrossx `watched` + tincanapi
 * `rated`/`earned`); the three completed steps (lesson/unit/course) share the
 * ADL `completed` IRI.
 */
export const JOURNEY_STEPS: { key: JourneyStepKey; iri: string; en: string }[] = [
  { key: 'registered', iri: 'http://adlnet.gov/expapi/verbs/registered', en: 'registered' },
  { key: 'initialized', iri: 'http://adlnet.gov/expapi/verbs/initialized', en: 'initialized' },
  { key: 'watched', iri: 'https://w3id.org/xapi/acrossx/verbs/watched', en: 'watched' },
  { key: 'completed_lesson', iri: 'http://adlnet.gov/expapi/verbs/completed', en: 'completed' },
  { key: 'attempted', iri: 'http://adlnet.gov/expapi/verbs/attempted', en: 'attempted' },
  { key: 'completed_unit', iri: 'http://adlnet.gov/expapi/verbs/completed', en: 'completed' },
  { key: 'progressed', iri: 'http://adlnet.gov/expapi/verbs/progressed', en: 'progressed' },
  { key: 'completed_course', iri: 'http://adlnet.gov/expapi/verbs/completed', en: 'completed' },
  { key: 'rated', iri: 'http://id.tincanapi.com/verb/rated', en: 'rated' },
  { key: 'earned', iri: 'http://id.tincanapi.com/verb/earned', en: 'earned' },
];

/** Course IRI prefilled in the admin form — the wizard's example test course. */
export const DEFAULT_COURSE_IRI = 'https://funademy.io/course/CR001';

const endpointBase = () => (process.env.NELC_LRS_ENDPOINT || '').trim().replace(/\/+$/, '');

export const lrsConfigured = (): boolean =>
  Boolean(endpointBase() && process.env.NELC_LRS_KEY && process.env.NELC_LRS_SECRET);

export const lrsEnvironment = (): 'staging' | 'production' =>
  process.env.NELC_LRS_ENV === 'production' ? 'production' : 'staging';

/** Full statements URL — tolerates an endpoint pasted with /statements already on it. */
export const lrsStatementsUrl = (): string => {
  const base = endpointBase();
  return /\/statements$/i.test(base) ? base : `${base}/statements`;
};

/**
 * Basic Authorization header value for the LRS, or null when not configured.
 * Handed by the admin route to the AUTHENTICATED owner's browser only (these
 * are the owner's own LRS credentials, and NELC geo-blocks our server egress
 * so the browser must send). Never log this value.
 */
export const lrsAuthorization = (): string | null =>
  lrsConfigured()
    ? `Basic ${Buffer.from(
        `${process.env.NELC_LRS_KEY}:${process.env.NELC_LRS_SECRET}`,
      ).toString('base64')}`
    : null;

export type JourneyStatement = {
  key: JourneyStepKey;
  /** Client-generated statement UUID (fresh every run — re-runs are safe). */
  statementId: string;
  statement: Record<string, unknown>;
};

/** Per-step result objects, mirroring NELC's package shapes (scores/durations). */
const stepResult = (key: JourneyStepKey): Record<string, unknown> | undefined => {
  switch (key) {
    case 'watched':
      return { duration: 'PT10M' };
    case 'completed_lesson':
      return { completion: true, duration: 'PT10M' };
    case 'attempted':
      return { score: { scaled: 0.8, raw: 80, min: 0, max: 100 }, completion: true, success: true };
    case 'completed_unit':
      return { completion: true, success: true, duration: 'PT20M' };
    case 'progressed':
      return { score: { scaled: 0.5, raw: 50, min: 0, max: 100 } };
    case 'completed_course':
      return {
        score: { scaled: 0.9, raw: 90, min: 0, max: 100 },
        completion: true,
        success: true,
        duration: 'PT40M',
      };
    case 'rated':
      return { score: { raw: 5, min: 1, max: 5 } };
    default:
      return undefined;
  }
};

/**
 * Build the full test-journey statements for one run. Every call generates
 * fresh statement UUIDs and a fresh context.registration, so the NELC wizard
 * can be retried any number of times without duplicate-id rejections.
 * Timestamps are spaced one minute apart, ending at `now`, so the journey
 * reads chronologically in the LRS.
 */
export function buildJourneyStatements(
  nationalId: string,
  courseIri: string,
  now: Date = new Date(),
): JourneyStatement[] {
  const registration = randomUUID();
  const stepMs = 60_000;
  const start = now.getTime() - (JOURNEY_STEPS.length - 1) * stepMs;

  return JOURNEY_STEPS.map((step, i) => {
    const statementId = randomUUID();
    const statement: Record<string, unknown> = {
      id: statementId,
      timestamp: new Date(start + i * stepMs).toISOString(),
      actor: {
        mbox: `mailto:${nationalId}@gmail.com`,
        name: nationalId,
        objectType: 'Agent',
      },
      verb: { id: step.iri, display: { 'en-US': step.en } },
      object: {
        objectType: 'Activity',
        id: courseIri,
        definition: {
          type: 'https://w3id.org/xapi/cmi5/activitytype/course',
          name: {
            'ar-SA': 'دورة فناديمي — الهندسة والروبوتيكس للأطفال',
            'en-US': 'Funademy Course — Engineering & Robotics for Kids',
          },
          description: {
            'ar-SA': 'رحلة تعلم تجريبية لاختبار الربط التقني مع نظام تسجيل التعلم في نيلك.',
            'en-US': 'Test learning journey for the NELC LRS technical integration.',
          },
        },
      },
      context: { registration, platform: 'Funademy', language: 'ar-SA' },
    };
    const result = stepResult(step.key);
    if (result) statement.result = result;
    return { key: step.key, statementId, statement };
  });
}

export type LrsSendResult = {
  ok: boolean;
  /** null = network error / timeout — no HTTP response was received. */
  httpStatus: number | null;
  /** LRS response body (truncated) or a network-error marker. */
  response: string;
};

/**
 * POST one statement to the LRS statements endpoint (Basic auth, xAPI 1.0.3).
 * Never throws — failures come back as { ok:false, … } so the caller can log
 * the exact LRS answer per step.
 */
export async function sendStatement(statement: Record<string, unknown>): Promise<LrsSendResult> {
  const auth = lrsAuthorization();
  if (!auth) return { ok: false, httpStatus: null, response: 'lrs_not_configured' };
  try {
    const res = await fetch(lrsStatementsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Experience-API-Version': '1.0.3',
        Authorization: auth,
      },
      body: JSON.stringify(statement),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    const body = (await res.text().catch(() => '')).slice(0, 2000);
    if (!res.ok) console.error('[xapi] LRS rejected statement:', res.status, body);
    return { ok: res.ok, httpStatus: res.status, response: body };
  } catch (e) {
    console.error('[xapi] LRS network error:', e);
    const msg = e instanceof Error ? `network_error: ${e.message}` : 'network_error';
    return { ok: false, httpStatus: null, response: msg.slice(0, 2000) };
  }
}
