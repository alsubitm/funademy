/**
 * NELC wizard-example parity — SINGLE SOURCE shared by:
 *   - the journey builder (src/lib/xapi.ts) — emits statements FROM these
 *     constants,
 *   - the admin self-check classifier (NelcTab) — validates statements read
 *     back from the LRS AGAINST the same constants in the owner's browser,
 *   - the test suite — fixture deep-comparison + classifier fixtures.
 * Keeping vocabulary and validation in one pure module means the builder and
 * the read-back classifier can never drift apart.
 *
 * WHY THIS EXISTS: NELC's FutureX verifier only counts statements that carry
 * the WHOLE structure of the wizard's personalized example — an earlier
 * journey was delivered and stored (HTTP 200) yet verified as
 * status:"no_data". The self-check therefore must not report "ready" for
 * statements that merely look similar: `statementMatchesWizardExample`
 * validates every structural/value requirement the parity fix asserts, and
 * `missingJourneySteps` checks the required 10-step verb multiset.
 *
 * STRICT BY DESIGN: a false NEGATIVE only costs a cheap, safe re-send
 * (fresh statement UUIDs every run); a false POSITIVE burns a wizard
 * verification attempt. When in doubt this module fails the statement.
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

export const EXT_DURATION = 'https://nelc.gov.sa/extensions/duration';
export const EXT_LMS_URL = 'https://nelc.gov.sa/extensions/lms_url';
export const EXT_PROGRAM_URL = 'https://nelc.gov.sa/extensions/program_url';
export const EXT_PLATFORM = 'https://nelc.gov.sa/extensions/platform';
/** The example's 4 context extension IRIs — exactly these, no more, no fewer. */
export const NELC_EXTENSION_IRIS = [EXT_DURATION, EXT_LMS_URL, EXT_PROGRAM_URL, EXT_PLATFORM];

const JOURNEY_VERB_IRIS = new Set(JOURNEY_STEPS.map((s) => s.iri));

/** Required verb multiset for one complete journey (completed appears ×3). */
const REQUIRED_VERB_COUNTS: Map<string, { count: number; en: string }> = (() => {
  const m = new Map<string, { count: number; en: string }>();
  for (const s of JOURNEY_STEPS) m.set(s.iri, { count: (m.get(s.iri)?.count ?? 0) + 1, en: s.en });
  return m;
})();

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
/** Language map with EXACTLY one key, en-US, holding a non-empty string. */
const isEnOnlyMap = (v: unknown): boolean =>
  isObj(v) && Object.keys(v).length === 1 && isNonEmptyStr(v['en-US']);
const hasExactKeys = (v: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every((k) => k in v);

/**
 * Full structural/value validation of ONE statement (as read back from the
 * LRS) against the wizard's personalized example. Everything the parity fix
 * asserts is checked:
 *   - actor: Agent, exactly {mbox,name,objectType}, mbox derived from
 *     actor.name via the example's `mailto:<id>@gmail.com` pattern
 *   - verb: one of the journey's verb IRIs, exactly {id,display} with an
 *     en-US display
 *   - object: Activity + definition with exactly {name,description,type},
 *     name/description en-US-ONLY (an ar-SA key ⇒ pre-parity format),
 *     cmi5 course type
 *   - context: exactly {instructor,platform,language,extensions} — which
 *     forbids context.registration; instructor exactly our real contact;
 *     platform/lms_url/duration byte-for-byte; program_url = the statement's
 *     own object.id; platform extension name exactly our ar-SA/en-US pair
 *   - timestamp present and parseable
 * Per-step `result` objects are deliberately NOT validated: they legitimately
 * differ per verb, several steps carry none, and the example marks results as
 * values to substitute.
 * Top-level extra keys (LRS-added `stored`, `authority`, `version`, …) are
 * tolerated — the LRS adds them to every stored statement.
 */
export function statementMatchesWizardExample(s: unknown): boolean {
  if (!isObj(s)) return false;

  const actor = s.actor;
  if (!isObj(actor) || !hasExactKeys(actor, ['mbox', 'name', 'objectType'])) return false;
  if (actor.objectType !== 'Agent' || !isNonEmptyStr(actor.name)) return false;
  if (actor.mbox !== `mailto:${actor.name}@gmail.com`) return false;

  const verb = s.verb;
  if (!isObj(verb) || !hasExactKeys(verb, ['id', 'display'])) return false;
  if (!isNonEmptyStr(verb.id) || !JOURNEY_VERB_IRIS.has(verb.id)) return false;
  if (!isObj(verb.display) || !isNonEmptyStr(verb.display['en-US'])) return false;

  const object = s.object;
  if (!isObj(object) || object.objectType !== 'Activity' || !isNonEmptyStr(object.id)) return false;
  const def = object.definition;
  if (!isObj(def) || !hasExactKeys(def, ['name', 'description', 'type'])) return false;
  if (!isEnOnlyMap(def.name) || !isEnOnlyMap(def.description)) return false;
  if (def.type !== CMI5_COURSE_TYPE) return false;

  const ctx = s.context;
  if (!isObj(ctx) || 'registration' in ctx) return false;
  if (!hasExactKeys(ctx, ['instructor', 'platform', 'language', 'extensions'])) return false;
  if (ctx.platform !== NELC_PLATFORM_URL || ctx.language !== NELC_LANGUAGE) return false;
  const instructor = ctx.instructor;
  if (!isObj(instructor) || !hasExactKeys(instructor, ['name', 'mbox'])) return false;
  if (instructor.name !== NELC_INSTRUCTOR.name || instructor.mbox !== NELC_INSTRUCTOR.mbox)
    return false;
  const ext = ctx.extensions;
  if (!isObj(ext) || !hasExactKeys(ext, NELC_EXTENSION_IRIS)) return false;
  if (ext[EXT_DURATION] !== NELC_DURATION) return false;
  if (ext[EXT_LMS_URL] !== NELC_PLATFORM_URL) return false;
  if (ext[EXT_PROGRAM_URL] !== object.id) return false;
  const platExt = ext[EXT_PLATFORM];
  if (!isObj(platExt) || !hasExactKeys(platExt, ['name'])) return false;
  const platName = platExt.name;
  if (!isObj(platName) || !hasExactKeys(platName, ['ar-SA', 'en-US'])) return false;
  if (
    platName['ar-SA'] !== NELC_PLATFORM_NAME['ar-SA'] ||
    platName['en-US'] !== NELC_PLATFORM_NAME['en-US']
  )
    return false;

  if (!isNonEmptyStr(s.timestamp) || Number.isNaN(Date.parse(s.timestamp))) return false;

  return true;
}

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
 * Which journey steps are still missing from a set of (example-parity)
 * statements' verb IRIs, as a required MULTISET — one complete journey needs
 * `completed` three times (lesson/unit/course) and every other verb once.
 * Returns human-readable labels (e.g. `completed ×3`), empty ⇒ complete.
 */
export function missingJourneySteps(verbIris: string[]): string[] {
  const have = new Map<string, number>();
  for (const iri of verbIris) have.set(iri, (have.get(iri) ?? 0) + 1);
  const missing: string[] = [];
  for (const [iri, req] of REQUIRED_VERB_COUNTS) {
    if ((have.get(iri) ?? 0) < req.count)
      missing.push(req.count > 1 ? `${req.en} ×${req.count}` : req.en);
  }
  return missing;
}
