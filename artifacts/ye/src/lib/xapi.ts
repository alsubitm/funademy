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
 * AUTHORITATIVE SOURCES, in priority order (full contracts + rationale live
 * in xapiParity.ts):
 *   1. The FutureX wizard's VIOLATION LIST from the 2026-08-10 verification
 *      run (has_data:true, 23/29 rules passed, status:"rejected") — rule
 *      codes ASM004, CTX001, CTX002, CRS003, CRS008, SEQ003.
 *   2. The wizard's PERSONALIZED `registered` example — that statement
 *      PASSED and is reproduced byte-for-byte (capital-H platform etc.).
 *   3. NELC's own integration package (github.com/nelc/laravel-lrs-package,
 *      src/Interactions/*.php) — the reference for every non-registration
 *      statement shape.
 * Shape summary:
 *   - Full journey = 10 statements, in this exact order:
 *     registered → initialized → watched → completed (lesson) → attempted →
 *     completed (unit) → progressed → completed (course) → rated → earned
 *   - actor = { mbox: 'mailto:<nationalId>@gmail.com', name: '<nationalId>',
 *     objectType: 'Agent' } on every statement — NELC verifies by
 *     actor.name = national ID.
 *   - `registered` is the ONLY statement with the course description and the
 *     ONLY one with the duration/lms_url/program_url extensions
 *     (CTX001/CTX002/CRS008); it carries the example's full context.
 *   - Course-level statements (initialized/progressed/completed course/
 *     rated) keep the course object with name + cmi5 type ONLY, and a
 *     context of instructor/platform/language + the platform extension.
 *   - Sub-activity statements (watched→video, completed lesson→lesson,
 *     attempted→unit-test quiz, completed unit→module, earned→certificate)
 *     use their OWN objects with IRIs derived from the course IRI and put
 *     the course in contextActivities.parent (CRS003) — same platform-only
 *     extensions.
 *   - rated carries result.response text (ASM004) + score{scaled,raw,0..5}.
 *   - en-US-only names/descriptions/verb displays; NO context.registration.
 *   - SEQ003 is procedural: ONE send per national ID — enforced by the
 *     admin route (409 duplicate_journey) + UI warning; each verification
 *     attempt needs a FRESH national ID.
 */

import { randomUUID } from 'crypto';

// Journey vocabulary + example-parity constants live in the shared, pure
// module xapiParity.ts — single source for this builder, the admin
// self-check classifier (runs in the browser), and the tests, so the emitted
// statements and the read-back validation can never drift apart.
import {
  CMI5_COURSE_TYPE,
  COURSE_DESC_EN,
  COURSE_NAME_EN,
  EXT_DURATION,
  EXT_LMS_URL,
  EXT_PLATFORM,
  EXT_PROGRAM_URL,
  JOURNEY_STEP_CONTRACTS,
  NELC_DURATION,
  NELC_INSTRUCTOR,
  NELC_LANGUAGE,
  NELC_PLATFORM_NAME,
  NELC_PLATFORM_URL,
  subActivityIri,
} from './xapiParity';
import type { JourneyStepContract } from './xapiParity';

export { JOURNEY_STEPS } from './xapiParity';
export type { JourneyStepKey } from './xapiParity';
import type { JourneyStepKey } from './xapiParity';

/** Course IRI prefilled in the admin form — the wizard's example test course. */
export const DEFAULT_COURSE_IRI = 'https://funademy.io/course/CR001';

/**
 * The example's full context block (values from xapiParity — see the
 * VERBATIM-vs-placeholder notes there) — `registered` ONLY since the
 * 2026-08-10 verifier run: CTX002 flags the duration/lms_url/program_url
 * extensions on any non-registration statement. program_url is dynamic (the
 * run's course IRI). Built fresh per call so statements stay independent.
 */
const journeyContext = (courseIri: string): Record<string, unknown> => ({
  instructor: { ...NELC_INSTRUCTOR },
  platform: NELC_PLATFORM_URL,
  language: NELC_LANGUAGE,
  extensions: {
    [EXT_DURATION]: NELC_DURATION,
    [EXT_LMS_URL]: NELC_PLATFORM_URL,
    [EXT_PROGRAM_URL]: courseIri,
    [EXT_PLATFORM]: {
      name: { ...NELC_PLATFORM_NAME },
    },
  },
});

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

/**
 * Statement object per contract (CRS003): course-level steps use the course
 * IRI; sub-activity steps derive their own IRI from it. The course
 * description appears ONLY in `registered` (CTX001/CRS008) — other
 * course-level objects carry name+type only; sub-activities carry their own
 * en-US name/description (or none for the certificate — package shape).
 */
const stepObject = (courseIri: string, c: JourneyStepContract): Record<string, unknown> => {
  const definition: Record<string, unknown> = { name: { 'en-US': c.object.nameEn } };
  if (c.object.descriptionEn !== null) {
    definition.description = { 'en-US': c.object.descriptionEn };
  }
  definition.type = c.object.type;
  return {
    objectType: 'Activity',
    id: c.object.kind === 'course' ? courseIri : subActivityIri(courseIri, c.object.suffix),
    definition,
  };
};

/**
 * Statement context per contract: `registered` keeps the example's full
 * 4-extension block; everything else carries instructor/platform/language +
 * the platform extension ONLY (CTX002), and sub-activity statements add the
 * course as their single contextActivities.parent (name/description/cmi5
 * type — exactly the package's parent block).
 */
const stepContext = (courseIri: string, c: JourneyStepContract): Record<string, unknown> => {
  if (c.fullNelcContext) return journeyContext(courseIri);
  const ctx: Record<string, unknown> = {
    instructor: { ...NELC_INSTRUCTOR },
    platform: NELC_PLATFORM_URL,
    language: NELC_LANGUAGE,
    extensions: {
      [EXT_PLATFORM]: { name: { ...NELC_PLATFORM_NAME } },
    },
  };
  if (c.object.kind === 'sub') {
    ctx.contextActivities = {
      parent: [
        {
          id: courseIri,
          objectType: 'Activity',
          definition: {
            name: { 'en-US': COURSE_NAME_EN },
            description: { 'en-US': COURSE_DESC_EN },
            type: CMI5_COURSE_TYPE,
          },
        },
      ],
    };
  }
  return ctx;
};

/**
 * Build the full test-journey statements for one run. Every call generates
 * fresh statement UUIDs; timestamps are spaced one minute apart, ending at
 * `now`, so the journey reads chronologically in the LRS. NOTE (SEQ003):
 * fresh UUIDs make wizard RE-CHECKS safe, but re-SENDING a journey for the
 * same national ID duplicates statements in NELC's LRS and fails
 * verification — one send per national ID, enforced by the admin route/UI.
 */
export function buildJourneyStatements(
  nationalId: string,
  courseIri: string,
  now: Date = new Date(),
): JourneyStatement[] {
  const stepMs = 60_000;
  const start = now.getTime() - (JOURNEY_STEP_CONTRACTS.length - 1) * stepMs;

  return JOURNEY_STEP_CONTRACTS.map((c, i) => {
    const statementId = randomUUID();
    const statement: Record<string, unknown> = {
      id: statementId,
      timestamp: new Date(start + i * stepMs).toISOString(),
      actor: {
        mbox: `mailto:${nationalId}@gmail.com`,
        name: nationalId,
        objectType: 'Agent',
      },
      verb: { id: c.iri, display: { 'en-US': c.en } },
      object: stepObject(courseIri, c),
      context: stepContext(courseIri, c),
    };
    // Result values are pinned in the contract (single source of truth with
    // the read-back classifier); clone so callers can't mutate the contract.
    if (c.result !== null) statement.result = structuredClone(c.result);
    return { key: c.key, statementId, statement };
  });
}

/**
 * Filtered statements READ-BACK url for the admin self-check: everything the
 * LRS stored for one learner (agent mbox derived from the national ID — same
 * derivation as the journey actor) + one course (activity id). Runs in the
 * owner's browser for the same geo-block reason as sending; it confirms what
 * is actually retrievable without burning a wizard verification attempt.
 * xAPI 1.0.3 GET /statements semantics: agent + activity filters AND
 * together; the response is { statements: [...], more: "..." }.
 */
export function lrsStatementsQueryUrl(nationalId: string, courseIri: string, limit = 25): string {
  const agent = JSON.stringify({ objectType: 'Agent', mbox: `mailto:${nationalId}@gmail.com` });
  // related_activities=true is REQUIRED since CRS003: five journey statements
  // target sub-activity objects and reference the course only through
  // contextActivities.parent — a bare `activity` filter matches statement
  // objects only (standard xAPI), so it would miss all five.
  const params = new URLSearchParams({
    agent,
    activity: courseIri,
    related_activities: 'true',
    limit: String(limit),
  });
  return `${lrsStatementsUrl()}?${params.toString()}`;
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
