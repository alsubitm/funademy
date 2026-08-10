/**
 * NELC journey step contracts — SINGLE SOURCE shared by:
 *   - the journey builder (src/lib/xapi.ts) — emits statements FROM these
 *     contracts,
 *   - the admin self-check classifier (NelcTab) — validates statements read
 *     back from the LRS AGAINST the same contracts in the owner's browser,
 *   - the test suite — fixture deep-comparison + classifier fixtures.
 * Keeping vocabulary and validation in one pure module means the builder and
 * the read-back classifier can never drift apart.
 *
 * WHY THESE SHAPES (wizard verification run, 2026-08-10 — 23/29 rules
 * passed): after the example-parity fix NELC's FutureX verifier finally SAW
 * our statements (has_data:true) but rejected the journey with 6 violations.
 * The contracts below encode exactly those rules, resolved against NELC's
 * own integration package (github.com/nelc/laravel-lrs-package,
 * src/Interactions/*.php — the reference for every non-registration shape):
 *   - ASM004  `rated` must carry a text result.response (package Rated.php:
 *             score{scaled,raw,min:0,max:5} + response).
 *   - CTX001 / CRS008  the COURSE description appears ONLY in `registered`;
 *             course-level statements (initialized / progressed /
 *             completed course / rated) carry name+type only. Sub-activities
 *             keep their OWN descriptions — exactly what the package does.
 *   - CTX002  the duration/lms_url/program_url NELC extensions appear ONLY
 *             in `registered`; every other statement carries just the
 *             platform extension (like every package interaction).
 *   - CRS003  each verb targets its expected object type — watched→video,
 *             completed(lesson)→lesson, attempted→unit-test quiz,
 *             completed(unit)→module, earned→certificate — with the course
 *             as contextActivities.parent, never as the statement object.
 *   - SEQ003  procedural (send ONCE per national ID) — enforced by the admin
 *             route/UI, not here.
 * PRIORITY ON CONFLICT: wizard violation text > the wizard's personalized
 * `registered` example (which passed verification and stays untouched) >
 * package shapes.
 *
 * STRICT BY DESIGN: a false NEGATIVE only costs a cheap re-send with a fresh
 * national ID — a false POSITIVE burns a wizard verification attempt. When
 * in doubt this module fails the statement.
 *
 * This module is intentionally dependency-free and browser-safe (no node:
 * imports) — it runs inside the admin's browser.
 */

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

// ——— Example-parity context values ————————————————————————————————————————
// Copied from the wizard's personalized example; real values substituted only
// where the example carries explicit placeholders.

/**
 * VERBATIM from the wizard example — capital "H" included. NELC's generator
 * produced `"Https://funademy.io"` for our org, and the verifier is matched
 * against that example, so we reproduce it byte-for-byte (intentional
 * parity, NOT a typo to fix). Used for context.platform AND the lms_url
 * extension, exactly like the example.
 */
export const NELC_PLATFORM_URL = 'Https://funademy.io';
/** VERBATIM from the wizard example. */
export const NELC_DURATION = 'PT30H00M00S';
/** VERBATIM from the wizard example. */
export const NELC_LANGUAGE = 'ar-SA';
/** Our real contact — the example's "Ibrahim Khalid" is a placeholder. */
export const NELC_INSTRUCTOR = { name: 'Funademy Instructor', mbox: 'mailto:info@funademy.io' };
/** Our real platform display name — the example's "Leading Tech for Training" is a placeholder. */
export const NELC_PLATFORM_NAME = { 'ar-SA': 'فناديمي', 'en-US': 'Funademy' };
/** cmi5 course activity type, exactly as in the example. */
export const CMI5_COURSE_TYPE = 'https://w3id.org/xapi/cmi5/activitytype/course';

// Sub-activity types, verbatim from NELC's package interactions (CRS003).
export const VIDEO_TYPE = 'https://w3id.org/xapi/video/activity-type/video';
export const LESSON_TYPE = 'http://adlnet.gov/expapi/activities/lesson';
export const QUIZ_TYPE = 'http://id.tincanapi.com/activitytype/unit-test';
export const UNIT_TYPE = 'http://adlnet.gov/expapi/activities/module';
export const CERTIFICATE_TYPE =
  'https://www.opigno.org/en/tincan_registry/activity_type/certificate';

export const EXT_DURATION = 'https://nelc.gov.sa/extensions/duration';
export const EXT_LMS_URL = 'https://nelc.gov.sa/extensions/lms_url';
export const EXT_PROGRAM_URL = 'https://nelc.gov.sa/extensions/program_url';
export const EXT_PLATFORM = 'https://nelc.gov.sa/extensions/platform';
/** The example's 4 context extension IRIs — `registered` ONLY (CTX002). */
export const NELC_EXTENSION_IRIS = [EXT_DURATION, EXT_LMS_URL, EXT_PROGRAM_URL, EXT_PLATFORM];

/** en-US course texts — the course description may appear ONLY in `registered` (CTX001/CRS008) and in sub-activity parents (package shape). */
export const COURSE_NAME_EN = 'Funademy Course — Engineering & Robotics for Kids';
export const COURSE_DESC_EN = 'Test learning journey for the NELC LRS technical integration.';
/** ASM004 — the `rated` statement's mandatory text response. */
export const RATED_RESPONSE_EN = 'Excellent course — engaging projects and clear explanations.';

export type StepObjectContract = {
  /** 'course' → the statement object IS the run's course; 'sub' → an activity under it. */
  kind: 'course' | 'sub';
  /** IRI suffix appended to the course IRI for sub-activities ('' for course objects). */
  suffix: string;
  /** object.definition.type (per-verb, CRS003). */
  type: string;
  /** en-US object name. */
  nameEn: string;
  /** en-US object description, or null ⇒ the definition carries NO description key. */
  descriptionEn: string | null;
};

export type JourneyStepContract = {
  key: JourneyStepKey;
  /** Verb IRI (matches NELC's package verbs — unchanged since the first parity fix). */
  iri: string;
  /** Verb display, en-US (the 3 completed steps share it). */
  en: string;
  /** Unique human label for missing-step reporting. */
  label: string;
  object: StepObjectContract;
  /** true ⇒ the example's full 4-extension context (`registered` ONLY — CTX002). */
  fullNelcContext: boolean;
  /** Exact result keys the builder emits ([] ⇒ the statement carries no result). */
  resultKeys: string[];
};

const course = (descriptionEn: string | null): StepObjectContract => ({
  kind: 'course',
  suffix: '',
  type: CMI5_COURSE_TYPE,
  nameEn: COURSE_NAME_EN,
  descriptionEn,
});

/**
 * The full NELC verification journey, in required order — one contract per
 * statement. Object shapes/result keys mirror NELC's package interactions;
 * `registered` mirrors the wizard's personalized example verbatim.
 */
export const JOURNEY_STEP_CONTRACTS: JourneyStepContract[] = [
  {
    key: 'registered',
    iri: 'http://adlnet.gov/expapi/verbs/registered',
    en: 'registered',
    label: 'registered',
    object: course(COURSE_DESC_EN),
    fullNelcContext: true,
    resultKeys: [],
  },
  {
    key: 'initialized',
    iri: 'http://adlnet.gov/expapi/verbs/initialized',
    en: 'initialized',
    label: 'initialized',
    object: course(null),
    fullNelcContext: false,
    resultKeys: [],
  },
  {
    key: 'watched',
    iri: 'https://w3id.org/xapi/acrossx/verbs/watched',
    en: 'watched',
    label: 'watched',
    object: {
      kind: 'sub',
      suffix: '/lessons/1/video',
      type: VIDEO_TYPE,
      nameEn: 'Lesson 1 Video — Introduction to Engineering & Robotics',
      descriptionEn: 'Introductory video lesson of the Funademy course.',
    },
    fullNelcContext: false,
    resultKeys: ['completion', 'duration'],
  },
  {
    key: 'completed_lesson',
    iri: 'http://adlnet.gov/expapi/verbs/completed',
    en: 'completed',
    label: 'completed (lesson)',
    object: {
      kind: 'sub',
      suffix: '/lessons/1',
      type: LESSON_TYPE,
      nameEn: 'Lesson 1 — Introduction to Engineering & Robotics',
      descriptionEn: 'First lesson of the Funademy course.',
    },
    fullNelcContext: false,
    resultKeys: ['completion', 'duration'],
  },
  {
    key: 'attempted',
    iri: 'http://adlnet.gov/expapi/verbs/attempted',
    en: 'attempted',
    label: 'attempted',
    object: {
      kind: 'sub',
      suffix: '/quizzes/1',
      type: QUIZ_TYPE,
      nameEn: 'Unit 1 Quiz',
      descriptionEn: 'Assessment quiz for the first unit of the Funademy course.',
    },
    fullNelcContext: false,
    resultKeys: ['score', 'completion', 'success'],
  },
  {
    key: 'completed_unit',
    iri: 'http://adlnet.gov/expapi/verbs/completed',
    en: 'completed',
    label: 'completed (unit)',
    object: {
      kind: 'sub',
      suffix: '/units/1',
      type: UNIT_TYPE,
      nameEn: 'Unit 1 — Engineering Foundations',
      descriptionEn: 'First unit of the Funademy course.',
    },
    fullNelcContext: false,
    resultKeys: ['completion', 'success', 'duration'],
  },
  {
    key: 'progressed',
    iri: 'http://adlnet.gov/expapi/verbs/progressed',
    en: 'progressed',
    label: 'progressed',
    object: course(null),
    fullNelcContext: false,
    // score only — this exact result passed the 2026-08-10 verifier run and
    // none of the 6 violations concerned it; don't touch what passed.
    resultKeys: ['score'],
  },
  {
    key: 'completed_course',
    iri: 'http://adlnet.gov/expapi/verbs/completed',
    en: 'completed',
    label: 'completed (course)',
    object: course(null),
    fullNelcContext: false,
    resultKeys: ['score', 'completion', 'success', 'duration'],
  },
  {
    key: 'rated',
    iri: 'http://id.tincanapi.com/verb/rated',
    en: 'rated',
    label: 'rated',
    object: course(null),
    fullNelcContext: false,
    resultKeys: ['score', 'response'],
  },
  {
    key: 'earned',
    iri: 'http://id.tincanapi.com/verb/earned',
    en: 'earned',
    label: 'earned',
    object: {
      kind: 'sub',
      suffix: '/certificate',
      type: CERTIFICATE_TYPE,
      nameEn: 'Funademy Course Completion Certificate',
      // The package's Earned.php certificate object has NO description.
      descriptionEn: null,
    },
    fullNelcContext: false,
    resultKeys: [],
  },
];

/** Legacy view {key, iri, en} — kept for the route's verb validation and ordering. */
export const JOURNEY_STEPS: { key: JourneyStepKey; iri: string; en: string }[] =
  JOURNEY_STEP_CONTRACTS.map(({ key, iri, en }) => ({ key, iri, en }));

/** Sub-activity IRI = course IRI (sans trailing slash) + contract suffix. */
export const subActivityIri = (courseIri: string, suffix: string): string =>
  `${courseIri.replace(/\/+$/, '')}${suffix}`;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
/** Language map with EXACTLY one key, en-US, holding a non-empty string. */
const isEnOnlyMap = (v: unknown): boolean =>
  isObj(v) && Object.keys(v).length === 1 && isNonEmptyStr(v['en-US']);
const hasExactKeys = (v: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every((k) => k in v);

/** The platform extension value: { name: { ar-SA, en-US } } with our exact names. */
const isPlatformExtension = (v: unknown): boolean => {
  if (!isObj(v) || !hasExactKeys(v, ['name'])) return false;
  const name = v.name;
  return (
    isObj(name) &&
    hasExactKeys(name, ['ar-SA', 'en-US']) &&
    name['ar-SA'] === NELC_PLATFORM_NAME['ar-SA'] &&
    name['en-US'] === NELC_PLATFORM_NAME['en-US']
  );
};

/** instructor/platform/language — identical on every statement. */
const hasBaseContextValues = (ctx: Record<string, unknown>): boolean => {
  if (ctx.platform !== NELC_PLATFORM_URL || ctx.language !== NELC_LANGUAGE) return false;
  const instructor = ctx.instructor;
  if (!isObj(instructor) || !hasExactKeys(instructor, ['name', 'mbox'])) return false;
  return instructor.name === NELC_INSTRUCTOR.name && instructor.mbox === NELC_INSTRUCTOR.mbox;
};

/** definition per contract: {name[,description],type} — en-US-only maps, exact type. */
const matchesObjectDefinition = (def: unknown, c: JourneyStepContract): boolean => {
  if (!isObj(def)) return false;
  const keys = c.object.descriptionEn !== null ? ['name', 'description', 'type'] : ['name', 'type'];
  if (!hasExactKeys(def, keys)) return false;
  if (!isEnOnlyMap(def.name)) return false;
  if (c.object.descriptionEn !== null && !isEnOnlyMap(def.description)) return false;
  return def.type === c.object.type;
};

/**
 * context per contract:
 *  - registered: exactly {instructor,platform,language,extensions} with the
 *    example's 4 extensions byte-for-byte (program_url = the course id).
 *  - other course-level steps: same keys but extensions = {platform} ONLY.
 *  - sub-activity steps: additionally contextActivities.parent = [course]
 *    (name+description+cmi5 type, exactly like the package), and the
 *    statement object id must equal parent id + the contract's suffix.
 */
const matchesContext = (
  s: Record<string, unknown>,
  objectId: string,
  c: JourneyStepContract,
): boolean => {
  const ctx = s.context;
  if (!isObj(ctx) || 'registration' in ctx) return false;
  if (!hasBaseContextValues(ctx)) return false;

  const ext = ctx.extensions;
  if (!isObj(ext)) return false;

  if (c.fullNelcContext) {
    if (!hasExactKeys(ctx, ['instructor', 'platform', 'language', 'extensions'])) return false;
    if (!hasExactKeys(ext, NELC_EXTENSION_IRIS)) return false;
    if (ext[EXT_DURATION] !== NELC_DURATION) return false;
    if (ext[EXT_LMS_URL] !== NELC_PLATFORM_URL) return false;
    if (ext[EXT_PROGRAM_URL] !== objectId) return false;
    return isPlatformExtension(ext[EXT_PLATFORM]);
  }

  // CTX002: outside `registered`, ONLY the platform extension.
  if (!hasExactKeys(ext, [EXT_PLATFORM]) || !isPlatformExtension(ext[EXT_PLATFORM])) return false;

  if (c.object.kind === 'course') {
    return hasExactKeys(ctx, ['instructor', 'platform', 'language', 'extensions']);
  }

  // Sub-activity: course as the single contextActivities parent.
  if (!hasExactKeys(ctx, ['instructor', 'platform', 'language', 'extensions', 'contextActivities']))
    return false;
  const ca = ctx.contextActivities;
  if (!isObj(ca) || !hasExactKeys(ca, ['parent'])) return false;
  const parents = ca.parent;
  if (!Array.isArray(parents) || parents.length !== 1) return false;
  const parent = parents[0];
  if (!isObj(parent) || parent.objectType !== 'Activity' || !isNonEmptyStr(parent.id)) return false;
  const pdef = parent.definition;
  if (!isObj(pdef) || !hasExactKeys(pdef, ['name', 'description', 'type'])) return false;
  if (!isEnOnlyMap(pdef.name) || !isEnOnlyMap(pdef.description)) return false;
  if (pdef.type !== CMI5_COURSE_TYPE) return false;
  // The object must be THIS course's sub-activity (id derived from parent).
  return objectId === subActivityIri(parent.id, c.object.suffix);
};

/** result per contract: exact keys, typed values, ASM004 response text. */
const matchesResult = (s: Record<string, unknown>, c: JourneyStepContract): boolean => {
  if (c.resultKeys.length === 0) return !('result' in s);
  const result = s.result;
  if (!isObj(result) || !hasExactKeys(result, c.resultKeys)) return false;
  if (c.resultKeys.includes('score') && !isObj(result.score)) return false;
  if (c.resultKeys.includes('completion') && typeof result.completion !== 'boolean') return false;
  if (c.resultKeys.includes('success') && typeof result.success !== 'boolean') return false;
  if (c.resultKeys.includes('duration') && !isNonEmptyStr(result.duration)) return false;
  // ASM004: the rating must carry a non-empty text response.
  if (c.resultKeys.includes('response') && !isNonEmptyStr(result.response)) return false;
  return true;
};

/**
 * Classify ONE statement (as read back from the LRS) against the journey
 * contracts: returns the step it fully satisfies, or null. The three
 * `completed` steps share a verb IRI and are discriminated by their object
 * contracts (lesson / module / course shapes are mutually exclusive).
 * Top-level extra keys (LRS-added `stored`, `authority`, `version`, …) are
 * tolerated — the LRS adds them to every stored statement.
 */
export function classifyJourneyStatement(s: unknown): JourneyStepKey | null {
  if (!isObj(s)) return null;

  const actor = s.actor;
  if (!isObj(actor) || !hasExactKeys(actor, ['mbox', 'name', 'objectType'])) return null;
  if (actor.objectType !== 'Agent' || !isNonEmptyStr(actor.name)) return null;
  if (actor.mbox !== `mailto:${actor.name}@gmail.com`) return null;

  const verb = s.verb;
  if (!isObj(verb) || !hasExactKeys(verb, ['id', 'display'])) return null;
  if (!isObj(verb.display) || !isNonEmptyStr(verb.display['en-US'])) return null;

  const object = s.object;
  if (!isObj(object) || object.objectType !== 'Activity' || !isNonEmptyStr(object.id)) return null;

  if (!isNonEmptyStr(s.timestamp) || Number.isNaN(Date.parse(s.timestamp))) return null;

  for (const c of JOURNEY_STEP_CONTRACTS) {
    if (c.iri !== verb.id) continue;
    if (!matchesObjectDefinition(object.definition, c)) continue;
    if (!matchesContext(s, object.id, c)) continue;
    if (!matchesResult(s, c)) continue;
    return c.key;
  }
  return null;
}

/** True ⇔ the statement fully satisfies one journey step contract. */
export const statementMatchesJourneyContract = (s: unknown): boolean =>
  classifyJourneyStatement(s) !== null;

/**
 * Read-back 401 classifier: NELC's LRS credentials for this platform are
 * WRITE-ONLY — a GET /statements answers HTTP 401 with a body like
 * `{"message":"The provided user account does not have read permissions"}`
 * even though POSTs from the same account succeed (observed 2026-08-10:
 * a 10/10 delivered journey and this 401 within the same minute). This is a
 * PERMISSION SCOPE limitation, not a delivery failure, so the self-check UI
 * must show it as an informational state, never a scary error. Anything else
 * (bad credentials 401, 403 geo-block, 5xx, network) stays a real error.
 * Browser-safe and shared with the tests, like the rest of this module.
 */
export function isLrsReadDenied(httpStatus: number | null, body: string): boolean {
  if (httpStatus !== 401) return false;
  return /read\s+permission/i.test(body || '');
}

/**
 * Which journey steps are missing from a set of CLASSIFIED statements
 * (classifyJourneyStatement results). Step keys are unique, so one complete
 * journey simply covers all 10. Returns unique human-readable labels
 * (`completed (lesson)`, …), empty ⇒ complete.
 */
export function missingJourneySteps(
  stepKeys: (JourneyStepKey | null | undefined)[],
): string[] {
  const have = new Set(stepKeys.filter((k): k is JourneyStepKey => Boolean(k)));
  return JOURNEY_STEP_CONTRACTS.filter((c) => !have.has(c.key)).map((c) => c.label);
}
