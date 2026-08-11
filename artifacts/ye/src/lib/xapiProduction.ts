/**
 * REAL learner statements for NELC's PRODUCTION LRS.
 *
 * The staging module (xapi.ts) sends the FIXED 10-step verification journey
 * for the FutureX wizard. THIS module builds statements from REAL learning
 * events on the kids' platform — real scores, real timestamps, real course
 * names — and is used exclusively by the production outbox (xapiOutbox.ts).
 *
 * IDENTITY & COURSE MAPPING
 * -------------------------
 *  - actor  = the CHILD's national ID (LrnChild.nationalId, entered by the
 *    parent) with the same mbox derivation NELC verified in staging.
 *  - course = one learning SUBJECT (LrnSubject) — the only entity with real
 *    digital learning records (lesson completions with scores/time). IRI:
 *    https://funademy.io/course/subject-<slug> — STABLE, never derived from
 *    the current request host (dev previews must not mint different IRIs).
 *
 * STATEMENT SHAPES follow the same NELC package rules the staging verifier
 * enforced (contracts + rationale in xapiParity.ts): full 4-extension
 * context on `registered` ONLY (CTX002), course description on `registered`
 * ONLY (CTX001/CRS008), sub-activities carry the course as their
 * contextActivities.parent (CRS003), en-US-only display texts. Unlike the
 * staging journey, RESULT VALUES ARE NEVER PINNED — a real child's actual
 * score/progress/duration goes in, and steps that did not really happen
 * (rated / earned / watched / attempted) are NEVER fabricated.
 *
 * SEPARATE CREDENTIALS — real data can never hit staging by mistake and the
 * staging test tab keeps working unchanged:
 *   - NELC_LRS_PROD_ENDPOINT  production xAPI endpoint (from the wizard's
 *                             credentials JSON, step «بيئة الإنتاج»)
 *   - NELC_LRS_PROD_KEY       Basic-auth username / key
 *   - NELC_LRS_PROD_SECRET    Basic-auth password / secret
 * Missing secrets ⇒ prodLrsConfigured() = false and nothing is ever sent —
 * never a silent fallback to the staging store.
 */

// NOTE: no `import from 'crypto'` here — this module is reachable from
// instrumentation.ts, which Next.js also bundles for the edge runtime where
// node builtins do not resolve. The Web Crypto global works in both.
import {
  CMI5_COURSE_TYPE,
  EXT_DURATION,
  EXT_LMS_URL,
  EXT_PLATFORM,
  EXT_PROGRAM_URL,
  JOURNEY_STEP_CONTRACTS,
  LESSON_TYPE,
  NELC_DURATION,
  NELC_INSTRUCTOR,
  NELC_LANGUAGE,
  NELC_PLATFORM_NAME,
  NELC_PLATFORM_URL,
  UNIT_TYPE,
  type JourneyStepKey,
} from './xapiParity';

// ——— Production LRS configuration (separate from the staging test set) ————

const prodEndpointBase = () =>
  (process.env.NELC_LRS_PROD_ENDPOINT || '').trim().replace(/\/+$/, '');

export const prodLrsConfigured = (): boolean =>
  Boolean(prodEndpointBase() && process.env.NELC_LRS_PROD_KEY && process.env.NELC_LRS_PROD_SECRET);

/** Full production statements URL — tolerates an endpoint pasted with /statements on it. */
export const prodLrsStatementsUrl = (): string => {
  const base = prodEndpointBase();
  return /\/statements$/i.test(base) ? base : `${base}/statements`;
};

/**
 * Basic Authorization for the production LRS, or null when not configured.
 * Handed only to the authenticated owner's browser (step-up password) by the
 * admin outbox flush — same accepted-risk rationale as the staging relay.
 * Never log this value.
 */
export const prodLrsAuthorization = (): string | null =>
  prodLrsConfigured()
    ? `Basic ${Buffer.from(
        `${process.env.NELC_LRS_PROD_KEY}:${process.env.NELC_LRS_PROD_SECRET}`,
      ).toString('base64')}`
    : null;

// ——— Course identity ———————————————————————————————————————————————————————

/**
 * STABLE production origin for course IRIs. Deliberately hard-coded: IRIs
 * are permanent identifiers in NELC's store, so they must never vary with
 * the serving host (dev preview, custom domains, …).
 */
export const PROD_SITE_ORIGIN = 'https://funademy.io';

export const subjectCourseIri = (slug: string): string =>
  `${PROD_SITE_ORIGIN}/course/subject-${slug}`;

/** Stable IRI for one LIVE course run — run ids are permanent. */
export const runCourseIri = (runId: number): string =>
  `${PROD_SITE_ORIGIN}/course/run-${runId}`;

/** Stable IRI for one live class session inside its course run. */
export const sessionActivityIri = (courseIri: string, sessionId: number): string =>
  `${courseIri}/sessions/${sessionId}`;

export type ProductionCourse = {
  iri: string;
  nameEn: string;
  descEn: string;
};

/** Course identity for one learning subject (en-US texts — NELC convention). */
export const courseForSubject = (subject: { slug: string; nameEn: string }): ProductionCourse => ({
  iri: subjectCourseIri(subject.slug),
  nameEn: `Funademy — ${subject.nameEn}`,
  descEn: `${subject.nameEn}: live online learning subject for kids on the Funademy platform.`,
});

/**
 * Course identity for one LIVE course run (en-US texts — NELC convention).
 * The run's own English title wins; otherwise the program name.
 */
export const courseForRun = (run: {
  id: number;
  titleEn: string | null;
  program: { nameEn: string };
}): ProductionCourse => {
  const title = (run.titleEn || '').trim() || run.program.nameEn;
  return {
    iri: runCourseIri(run.id),
    nameEn: `Funademy — ${title}`,
    descEn: `${title}: live instructor-led STEM & robotics course for kids on the Funademy platform.`,
  };
};

// ——— Vocabulary (single source: the shared parity contracts) ———————————————

export type ProductionVerb =
  | 'registered'
  | 'completed_lesson'
  | 'completed_unit'
  | 'progressed'
  | 'completed_course'
  | 'attended';

/**
 * `attended` is not part of the staging verification journey (no parity
 * contract) — it is the standard ADL verb for live-session presence, used
 * only by the live-class attendance pipeline.
 */
export const ATTENDED_VERB_IRI = 'http://adlnet.gov/expapi/verbs/attended';

const contractOf = (key: JourneyStepKey) => {
  const c = JOURNEY_STEP_CONTRACTS.find((x) => x.key === key);
  if (!c) throw new Error(`missing journey contract: ${key}`); // unreachable
  return c;
};

/** Verb {id, display} exactly as the verified staging journey used them. */
const verbOf = (key: JourneyStepKey): Record<string, unknown> => {
  const c = contractOf(key);
  return { id: c.iri, display: { 'en-US': c.en } };
};

// ——— Shared building blocks ————————————————————————————————————————————————

const actorOf = (nationalId: string): Record<string, unknown> => ({
  mbox: `mailto:${nationalId}@gmail.com`,
  name: nationalId,
  objectType: 'Agent',
});

/**
 * Context per NELC package rules: `registered` carries the full 4-extension
 * block (program_url = the course IRI); everything else carries the platform
 * extension only, and sub-activity statements add the course as their single
 * contextActivities.parent with name+description+cmi5 type.
 */
const contextOf = (
  course: ProductionCourse,
  opts: { full?: boolean; parentCourse?: boolean } = {},
): Record<string, unknown> => {
  const ctx: Record<string, unknown> = {
    instructor: { ...NELC_INSTRUCTOR },
    platform: NELC_PLATFORM_URL,
    language: NELC_LANGUAGE,
    extensions: opts.full
      ? {
          [EXT_DURATION]: NELC_DURATION,
          [EXT_LMS_URL]: NELC_PLATFORM_URL,
          [EXT_PROGRAM_URL]: course.iri,
          [EXT_PLATFORM]: { name: { ...NELC_PLATFORM_NAME } },
        }
      : { [EXT_PLATFORM]: { name: { ...NELC_PLATFORM_NAME } } },
  };
  if (opts.parentCourse) {
    ctx.contextActivities = {
      parent: [
        {
          id: course.iri,
          objectType: 'Activity',
          definition: {
            name: { 'en-US': course.nameEn },
            description: { 'en-US': course.descEn },
            type: CMI5_COURSE_TYPE,
          },
        },
      ],
    };
  }
  return ctx;
};

const courseObject = (course: ProductionCourse, withDescription: boolean): Record<string, unknown> => ({
  objectType: 'Activity',
  id: course.iri,
  definition: {
    name: { 'en-US': course.nameEn },
    ...(withDescription ? { description: { 'en-US': course.descEn } } : {}),
    type: CMI5_COURSE_TYPE,
  },
});

export type BuiltStatement = {
  verb: ProductionVerb;
  statementId: string;
  statement: Record<string, unknown>;
};

const assemble = (
  verb: ProductionVerb,
  verbRecord: Record<string, unknown>,
  nationalId: string,
  at: Date,
  object: Record<string, unknown>,
  context: Record<string, unknown>,
  result?: Record<string, unknown>,
): BuiltStatement => {
  const statementId = crypto.randomUUID();
  const statement: Record<string, unknown> = {
    id: statementId,
    timestamp: at.toISOString(),
    actor: actorOf(nationalId),
    verb: verbRecord,
    object,
    context,
  };
  if (result) statement.result = result;
  return { verb, statementId, statement };
};

/** Clamp to an integer 0–100 (defensive — scores/percentages come from our own math). */
const pct = (n: number): number => Math.min(100, Math.max(0, Math.round(n)));

/**
 * ISO-8601 duration from real seconds (falls back to the lesson's nominal
 * minutes). The reported time is client-measured and clamped again at the
 * API boundary — the 4-hour cap here is defense in depth so a tampered
 * value can never fabricate an absurd learning duration in NELC's store.
 */
const isoDuration = (timeSpentSeconds: number, fallbackMinutes: number): string =>
  timeSpentSeconds > 0
    ? `PT${Math.min(14_400, Math.max(1, Math.round(timeSpentSeconds)))}S`
    : `PT${Math.min(600, Math.max(1, Math.round(fallbackMinutes)))}M`;

// ——— Real-event builders ———————————————————————————————————————————————————

/** Child registered on the subject — full NELC context, course description included. */
export const buildRegistered = (nationalId: string, course: ProductionCourse, at: Date) =>
  assemble(
    'registered',
    verbOf('registered'),
    nationalId,
    at,
    courseObject(course, true),
    contextOf(course, { full: true }),
  );

/** Real lesson completion — the child's ACTUAL score and time spent. */
export const buildLessonCompleted = (
  nationalId: string,
  course: ProductionCourse,
  lesson: { id: number; titleEn: string; descEn: string | null; durationMinutes: number },
  score: number,
  timeSpentSeconds: number,
  at: Date,
) =>
  assemble(
    'completed_lesson',
    verbOf('completed_lesson'),
    nationalId,
    at,
    {
      objectType: 'Activity',
      id: `${course.iri}/lessons/${lesson.id}`,
      definition: {
        name: { 'en-US': lesson.titleEn },
        ...(lesson.descEn ? { description: { 'en-US': lesson.descEn } } : {}),
        type: LESSON_TYPE,
      },
    },
    contextOf(course, { parentCourse: true }),
    {
      score: { scaled: pct(score) / 100, raw: pct(score), min: 0, max: 100 },
      completion: true,
      duration: isoDuration(timeSpentSeconds, lesson.durationMinutes),
    },
  );

/** All published lessons of one unit first-completed. */
export const buildUnitCompleted = (
  nationalId: string,
  course: ProductionCourse,
  unit: { id: number; titleEn: string },
  at: Date,
) =>
  assemble(
    'completed_unit',
    verbOf('completed_unit'),
    nationalId,
    at,
    {
      objectType: 'Activity',
      id: `${course.iri}/units/${unit.id}`,
      definition: {
        name: { 'en-US': unit.titleEn },
        description: { 'en-US': `${unit.titleEn} — unit of ${course.nameEn}.` },
        type: UNIT_TYPE,
      },
    },
    contextOf(course, { parentCourse: true }),
    { completion: true, success: true },
  );

/** Real subject progress — percent of published lessons first-completed. */
export const buildProgressed = (
  nationalId: string,
  course: ProductionCourse,
  percent: number,
  at: Date,
) =>
  assemble(
    'progressed',
    verbOf('progressed'),
    nationalId,
    at,
    courseObject(course, false),
    contextOf(course),
    { score: { scaled: pct(percent) / 100, raw: pct(percent), min: 0, max: 100 } },
  );

/** Every published lesson of the subject first-completed. */
export const buildCourseCompleted = (nationalId: string, course: ProductionCourse, at: Date) =>
  assemble(
    'completed_course',
    verbOf('completed_course'),
    nationalId,
    at,
    courseObject(course, false),
    contextOf(course),
    { completion: true, success: true },
  );

/**
 * Child attended one LIVE class session — session sub-activity parented to
 * the course run (CRS003), platform-only extension, no fabricated result.
 */
export const buildAttended = (
  nationalId: string,
  course: ProductionCourse,
  session: { id: number; date: Date },
  at: Date,
) =>
  assemble(
    'attended',
    { id: ATTENDED_VERB_IRI, display: { 'en-US': 'attended' } },
    nationalId,
    at,
    {
      objectType: 'Activity',
      id: sessionActivityIri(course.iri, session.id),
      definition: {
        name: { 'en-US': `Live class session — ${session.date.toISOString().slice(0, 10)}` },
        description: { 'en-US': `Live class session of ${course.nameEn}.` },
        type: LESSON_TYPE,
      },
    },
    contextOf(course, { parentCourse: true }),
    { completion: true },
  );

// ——— Server-side delivery (may be geo-blocked — never throws) ———————————————

export type ProdSendResult = {
  ok: boolean;
  /** null = network error / timeout — no HTTP response received. */
  httpStatus: number | null;
  response: string;
};

/** POST one statement to the PRODUCTION LRS (Basic auth, xAPI 1.0.3). */
export async function sendProdStatement(
  statement: Record<string, unknown>,
): Promise<ProdSendResult> {
  const auth = prodLrsAuthorization();
  if (!auth) return { ok: false, httpStatus: null, response: 'prod_lrs_not_configured' };
  try {
    const res = await fetch(prodLrsStatementsUrl(), {
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
    return { ok: res.ok, httpStatus: res.status, response: body };
  } catch (e) {
    const msg = e instanceof Error ? `network_error: ${e.message}` : 'network_error';
    return { ok: false, httpStatus: null, response: msg.slice(0, 2000) };
  }
}
