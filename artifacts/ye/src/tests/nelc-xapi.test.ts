/**
 * NELC xAPI journey — statement builders + admin /svc/admin/nelc endpoint.
 *
 *  - builders produce the exact 10-statement journey per the per-step
 *    contracts in xapiParity: the wizard's personalized `registered` example
 *    verbatim, package-shaped sub-activity objects (CRS003), description +
 *    full NELC extensions on `registered` ONLY (CTX001/CTX002/CRS008), and
 *    the rated text response (ASM004) — the fixture deep-comparisons below
 *    guard those rules
 *  - endpoint validates input, refuses to send when the LRS is not
 *    configured (no fake success), stops on first LRS failure, persists an
 *    audit row per attempted statement, and blocks accidental duplicate
 *    journeys per national ID (SEQ003) behind an explicit confirmation
 *  - self-check read-back (check/record_check) hands the browser a filtered
 *    statements GET and records one distinguishable audit row per check
 *
 * Runs against the isolated ye_test database; LRS HTTP calls are mocked —
 * no real network traffic to NELC.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

vi.mock('@/app/(ar)/svc/admin/guard', () => ({
  requireAdmin: vi.fn(async () => null), // admin session assumed valid in tests
}));

import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {
  buildJourneyStatements,
  JOURNEY_STEPS,
  lrsAgentStatementsQueryUrl,
  lrsConfigured,
  lrsStatementsQueryUrl,
} from '@/lib/xapi';
import {
  classifyJourneyStatement,
  classifyPrecheckResponse,
  COURSE_DESC_EN,
  COURSE_NAME_EN,
  isLrsReadDenied,
  missingJourneySteps,
  NELC_EXTENSION_IRIS,
  RATED_RESPONSE_EN,
  statementMatchesJourneyContract,
} from '@/lib/xapiParity';
import { GET as nelcGET, POST as nelcPOST } from '@/app/(ar)/svc/admin/nelc/route';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

// The workspace may hold REAL NELC LRS secrets — clear them for every test so
// the suite never depends on (or leaks into) the real environment.
beforeEach(() => {
  vi.stubEnv('NELC_LRS_ENDPOINT', '');
  vi.stubEnv('NELC_LRS_KEY', '');
  vi.stubEnv('NELC_LRS_SECRET', '');
  vi.stubEnv('NELC_LRS_ENV', '');
});

const stubLrsEnv = () => {
  vi.stubEnv('NELC_LRS_ENDPOINT', 'https://lrs.staging.example/data/xAPI');
  vi.stubEnv('NELC_LRS_KEY', 'test-key');
  vi.stubEnv('NELC_LRS_SECRET', 'test-secret');
  // prepare requires step-up re-auth with the admin password
  vi.stubEnv('ADMIN_PASSWORD', 'test-admin-pass');
};

const postReq = (body: unknown) =>
  new NextRequest('http://localhost/svc/admin/nelc', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('buildJourneyStatements', () => {
  it('builds the 10-statement NELC journey in the wizard order with NELC verb IRIs', () => {
    const journey = buildJourneyStatements('1234567890', 'https://funademy.io/course/CR001');
    expect(journey.map((s) => s.key)).toEqual([
      'registered',
      'initialized',
      'watched',
      'completed_lesson',
      'attempted',
      'completed_unit',
      'progressed',
      'completed_course',
      'rated',
      'earned',
    ]);
    const iris = journey.map((s) => (s.statement.verb as { id: string }).id);
    expect(iris).toEqual(JOURNEY_STEPS.map((v) => v.iri));
    // NELC-specific IRIs (verified against NELC's own integration packages)
    expect(iris[2]).toBe('https://w3id.org/xapi/acrossx/verbs/watched');
    expect(iris[8]).toBe('http://id.tincanapi.com/verb/rated');
    expect(iris[9]).toBe('http://id.tincanapi.com/verb/earned');
    expect(iris.filter((i) => i === 'http://adlnet.gov/expapi/verbs/completed')).toHaveLength(3);
  });

  it('uses the wizard mbox actor pattern on every statement, with per-step object IRIs anchored to ONE course', () => {
    const journey = buildJourneyStatements('1098765432', 'https://funademy.io/course/CR001');
    // CRS003: sub-activity verbs target their own objects; course-level verbs
    // keep the single course IRI (the wizard rejects multiple COURSE ids —
    // sub-activities point back to it via contextActivities.parent).
    const expectedIds: Record<string, string> = {
      registered: 'https://funademy.io/course/CR001',
      initialized: 'https://funademy.io/course/CR001',
      watched: 'https://funademy.io/course/CR001/lessons/1/video',
      completed_lesson: 'https://funademy.io/course/CR001/lessons/1',
      attempted: 'https://funademy.io/course/CR001/quizzes/1',
      completed_unit: 'https://funademy.io/course/CR001/units/1',
      progressed: 'https://funademy.io/course/CR001',
      completed_course: 'https://funademy.io/course/CR001',
      rated: 'https://funademy.io/course/CR001',
      earned: 'https://funademy.io/course/CR001/certificate',
    };
    for (const step of journey) {
      const actor = step.statement.actor as { mbox: string; name: string; objectType: string };
      expect(actor.mbox).toBe('mailto:1098765432@gmail.com');
      expect(actor.name).toBe('1098765432');
      expect(actor.objectType).toBe('Agent');
      expect((step.statement.object as { id: string }).id).toBe(expectedIds[step.key]);
      const display = (step.statement.verb as { display: Record<string, string> }).display;
      expect(Object.keys(display)).toEqual(['en-US']);
    }
    for (const key of ['watched', 'completed_lesson', 'attempted', 'completed_unit', 'earned']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = journey.find((x) => x.key === key)!.statement as Record<string, any>;
      expect(s.context.contextActivities.parent).toHaveLength(1);
      expect(s.context.contextActivities.parent[0].id).toBe('https://funademy.io/course/CR001');
    }
    for (const key of ['registered', 'initialized', 'progressed', 'completed_course', 'rated']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = journey.find((x) => x.key === key)!.statement as Record<string, any>;
      expect(s.context.contextActivities).toBeUndefined();
    }
  });

  it('spaces recent timestamps one minute apart ending now, with result details on progressed/completed', () => {
    const before = Date.now();
    const journey = buildJourneyStatements('1234567890', 'https://funademy.io/course/CR001');
    const times = journey.map((s) => new Date(s.statement.timestamp as string).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // recent journey ending "now" (the wizard example's 2022 date is just an old sample)
    expect(Math.abs(times[9] - before)).toBeLessThan(15_000);
    expect(times[9] - times[0]).toBe(9 * 60_000);

    const progressed = journey.find((s) => s.key === 'progressed')!;
    expect((progressed.statement.result as { score: { raw: number } }).score.raw).toBe(50);
    const completedCourse = journey.find((s) => s.key === 'completed_course')!;
    expect((completedCourse.statement.result as { completion: boolean }).completion).toBe(true);
    const rated = journey.find((s) => s.key === 'rated')!;
    // ASM004 — package Rated.php: score{scaled,raw,min:0,max:5} + text response
    expect(rated.statement.result).toEqual({
      score: { scaled: 1, raw: 5, min: 0, max: 5 },
      response: RATED_RESPONSE_EN,
    });
  });

  it('generates fresh statement UUIDs on every run (safe wizard retries)', () => {
    const a = buildJourneyStatements('1234567890', 'https://funademy.io/course/CR001');
    const b = buildJourneyStatements('1234567890', 'https://funademy.io/course/CR001');
    const idsA = new Set(a.map((s) => s.statementId));
    for (const s of b) expect(idsA.has(s.statementId)).toBe(false);
  });

  it('builds a filtered read-back query URL (agent + activity + related_activities + limit)', () => {
    vi.stubEnv('NELC_LRS_ENDPOINT', 'https://lrs.staging.example/data/xAPI/statements'); // pasted /statements tolerated
    const url = new URL(lrsStatementsQueryUrl('1234567890', 'https://funademy.io/course/CR001'));
    expect(`${url.origin}${url.pathname}`).toBe('https://lrs.staging.example/data/xAPI/statements');
    expect(JSON.parse(url.searchParams.get('agent')!)).toEqual({
      objectType: 'Agent',
      mbox: 'mailto:1234567890@gmail.com', // same derivation as the journey actor
    });
    expect(url.searchParams.get('activity')).toBe('https://funademy.io/course/CR001');
    // CRS003 made five statements target sub-activities — without
    // related_activities the read-back would MISS them (they reference the
    // course only via contextActivities.parent).
    expect(url.searchParams.get('related_activities')).toBe('true');
    expect(url.searchParams.get('limit')).toBe('25');
  });
});

/**
 * VERBATIM fixture: the FutureX wizard's personalized `registered` example
 * for our org (pasted from the wizard, 2026-08-10) — the AUTHORITATIVE
 * statement structure. NELC's verifier only counted statements carrying this
 * whole shape (a delivered 10/10 journey without it verified as "no_data").
 * Where the example carries placeholders (instructor "Ibrahim Khalid",
 * platform display name "Leading Tech for Training", the sample course
 * wording) the builder substitutes our real values; everything else must
 * match structurally, and the marked strings must match byte-for-byte.
 */
const WIZARD_EXAMPLE = {
  actor: { mbox: 'mailto:1059652238@gmail.com', name: '1059652238', objectType: 'Agent' },
  verb: { id: 'http://adlnet.gov/expapi/verbs/registered', display: { 'en-US': 'registered' } },
  object: {
    id: 'https://funademy.io/course/CR001',
    definition: {
      name: { 'en-US': 'Java for Beginners' },
      description: { 'en-US': 'Introductory Java course' },
      type: 'https://w3id.org/xapi/cmi5/activitytype/course',
    },
    objectType: 'Activity',
  },
  context: {
    instructor: { name: 'Ibrahim Khalid', mbox: 'mailto:ik@example.com' },
    platform: 'Https://funademy.io',
    language: 'ar-SA',
    extensions: {
      'https://nelc.gov.sa/extensions/duration': 'PT30H00M00S',
      'https://nelc.gov.sa/extensions/lms_url': 'Https://funademy.io',
      'https://nelc.gov.sa/extensions/program_url': 'https://funademy.io/course/CR001',
      'https://nelc.gov.sa/extensions/platform': {
        name: { 'ar-SA': 'التقنيات المتقدمة للتدريب', 'en-US': 'Leading Tech for Training' },
      },
    },
  },
  timestamp: '2022-01-31T07:18:32.829Z',
};

describe('example parity — deep comparison against the wizard fixture', () => {
  const built = () =>
    buildJourneyStatements('1059652238', 'https://funademy.io/course/CR001')[0].statement as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;

  it('matches actor and verb exactly (actor.name = national ID, wizard mbox pattern)', () => {
    const s = built();
    expect(s.actor).toEqual(WIZARD_EXAMPLE.actor);
    expect(s.verb).toEqual(WIZARD_EXAMPLE.verb);
  });

  it('matches the object shape — id, objectType, en-US-only definition, cmi5 course type', () => {
    const s = built();
    expect(s.object.objectType).toBe(WIZARD_EXAMPLE.object.objectType);
    expect(s.object.id).toBe(WIZARD_EXAMPLE.object.id);
    expect(new Set(Object.keys(s.object.definition))).toEqual(
      new Set(Object.keys(WIZARD_EXAMPLE.object.definition)),
    );
    // en-US ONLY — the example carries no ar-SA keys in the definition
    expect(Object.keys(s.object.definition.name)).toEqual(['en-US']);
    expect(Object.keys(s.object.definition.description)).toEqual(['en-US']);
    expect(s.object.definition.type).toBe(WIZARD_EXAMPLE.object.definition.type);
  });

  it('carries the full example context — same key set (NO registration) and the 4 NELC extension IRIs', () => {
    const s = built();
    const ctx = s.context;
    expect(new Set(Object.keys(ctx))).toEqual(new Set(Object.keys(WIZARD_EXAMPLE.context)));
    expect(ctx.registration).toBeUndefined();
    expect(ctx.language).toBe(WIZARD_EXAMPLE.context.language);
    // instructor: same shape, our real contact substituted for the placeholder
    expect(new Set(Object.keys(ctx.instructor))).toEqual(
      new Set(Object.keys(WIZARD_EXAMPLE.context.instructor)),
    );
    expect(ctx.instructor).toEqual({ name: 'Funademy Instructor', mbox: 'mailto:info@funademy.io' });
    expect(new Set(Object.keys(ctx.extensions))).toEqual(
      new Set(Object.keys(WIZARD_EXAMPLE.context.extensions)),
    );
  });

  it('copies the marked example values VERBATIM (capital-H platform/lms_url, duration)', () => {
    const ctx = built().context;
    // capital "H" intentional — byte-for-byte what NELC's generator produced for our org
    expect(ctx.platform).toBe('Https://funademy.io');
    expect(ctx.extensions['https://nelc.gov.sa/extensions/lms_url']).toBe('Https://funademy.io');
    expect(ctx.extensions['https://nelc.gov.sa/extensions/duration']).toBe('PT30H00M00S');
  });

  it('substitutes real values where the example holds placeholders (program_url, platform name)', () => {
    const ctx = built().context;
    expect(ctx.extensions['https://nelc.gov.sa/extensions/program_url']).toBe(
      'https://funademy.io/course/CR001',
    );
    const platformExt = ctx.extensions['https://nelc.gov.sa/extensions/platform'];
    expect(new Set(Object.keys(platformExt))).toEqual(new Set(['name']));
    expect(Object.keys(platformExt.name).sort()).toEqual(
      Object.keys(WIZARD_EXAMPLE.context.extensions['https://nelc.gov.sa/extensions/platform'].name).sort(),
    );
    expect(platformExt.name).toEqual({ 'ar-SA': 'فناديمي', 'en-US': 'Funademy' });
  });

  it('keeps the same top-level fields as the example (plus our client-side statement id)', () => {
    const s = built();
    // `registered` carries no result — top level must be the example's keys + id
    expect(new Set(Object.keys(s))).toEqual(new Set([...Object.keys(WIZARD_EXAMPLE), 'id']));
  });

  it('applies the verifier-rule fixes: registered-only description/extensions, per-verb objects, parent blocks', () => {
    const journey = buildJourneyStatements('1059652238', 'https://funademy.io/course/XYZ9');
    const byKey = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      journey.map((s) => [s.key, s.statement as Record<string, any>]),
    );

    // CTX002 — ONLY registered carries the 4 NELC extensions (program_url
    // follows the run's course IRI); everything else carries EXACTLY the
    // platform extension, with the same base context values.
    expect(Object.keys(byKey.registered.context.extensions).sort()).toEqual(
      [...NELC_EXTENSION_IRIS].sort(),
    );
    expect(byKey.registered.context.extensions['https://nelc.gov.sa/extensions/program_url']).toBe(
      'https://funademy.io/course/XYZ9',
    );
    for (const step of journey) {
      const ctx = step.statement.context as Record<string, unknown>;
      expect(ctx.registration).toBeUndefined();
      expect(ctx.instructor).toEqual({ name: 'Funademy Instructor', mbox: 'mailto:info@funademy.io' });
      expect(ctx.platform).toBe('Https://funademy.io');
      expect(ctx.language).toBe('ar-SA');
      if (step.key === 'registered') continue;
      const ext = ctx.extensions as Record<string, unknown>;
      expect(Object.keys(ext)).toEqual(['https://nelc.gov.sa/extensions/platform']);
      expect(ext['https://nelc.gov.sa/extensions/platform']).toEqual({
        name: { 'ar-SA': 'فناديمي', 'en-US': 'Funademy' },
      });
    }

    // CTX001/CRS008 — the course description lives ONLY in registered's object.
    expect(byKey.registered.object.definition.description).toEqual({ 'en-US': COURSE_DESC_EN });
    for (const key of ['initialized', 'progressed', 'completed_course', 'rated']) {
      expect(Object.keys(byKey[key].object.definition).sort()).toEqual(['name', 'type']);
      expect(byKey[key].object.definition.type).toBe('https://w3id.org/xapi/cmi5/activitytype/course');
      expect(byKey[key].object.definition.name).toEqual({ 'en-US': COURSE_NAME_EN });
    }

    // CRS003 — per-verb object types, verbatim from NELC's package.
    expect(byKey.watched.object.definition.type).toBe('https://w3id.org/xapi/video/activity-type/video');
    expect(byKey.completed_lesson.object.definition.type).toBe('http://adlnet.gov/expapi/activities/lesson');
    expect(byKey.attempted.object.definition.type).toBe('http://id.tincanapi.com/activitytype/unit-test');
    expect(byKey.completed_unit.object.definition.type).toBe('http://adlnet.gov/expapi/activities/module');
    expect(byKey.earned.object.definition.type).toBe(
      'https://www.opigno.org/en/tincan_registry/activity_type/certificate',
    );
    // the certificate carries NO description (package Earned.php shape)
    expect(Object.keys(byKey.earned.object.definition).sort()).toEqual(['name', 'type']);

    // Sub-activity statements put the course (name+description+cmi5 type) as
    // their single contextActivities parent — the package's parent block.
    expect(byKey.watched.context.contextActivities.parent[0]).toEqual({
      id: 'https://funademy.io/course/XYZ9',
      objectType: 'Activity',
      definition: {
        name: { 'en-US': COURSE_NAME_EN },
        description: { 'en-US': COURSE_DESC_EN },
        type: 'https://w3id.org/xapi/cmi5/activitytype/course',
      },
    });
  });
});

/**
 * Read-back contract classifier — the self-check must not count statements
 * that merely LOOK similar but violate any verifier rule; that false
 * confidence is exactly what the self-check exists to prevent. Every fixture
 * below mutates ONE aspect of a builder-emitted statement and must be
 * rejected (classified as null).
 */
describe('self-check contract classifier (classifyJourneyStatement)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Mutable = Record<string, any>;
  const journey = () => buildJourneyStatements('1059652238', 'https://funademy.io/course/CR001');
  const fresh = (key: string): Mutable =>
    structuredClone(journey().find((s) => s.key === key)!.statement) as Mutable;
  const freshStatement = (): Mutable => fresh('registered');

  it('classifies every statement the current builder emits to its own step (shared single source)', () => {
    for (const step of journey()) {
      expect(classifyJourneyStatement(step.statement)).toBe(step.key);
      expect(statementMatchesJourneyContract(step.statement)).toBe(true);
    }
    expect(missingJourneySteps(journey().map((s) => classifyJourneyStatement(s.statement)))).toEqual([]);
  });

  it('tolerates the top-level fields an LRS adds to stored statements', () => {
    const s = freshStatement();
    s.stored = '2026-08-10T12:00:00Z';
    s.authority = {
      objectType: 'Agent',
      account: { homePage: 'https://lrs.nelc.gov.sa', name: 'funademy_io' },
    };
    s.version = '1.0.3';
    expect(classifyJourneyStatement(s)).toBe('registered');
  });

  const rejected: [string, (s: Mutable) => void][] = [
    ['context.registration present (pre-parity format)', (s) => { s.context.registration = randomUUID(); }],
    ['lowercase platform string', (s) => { s.context.platform = 'https://funademy.io'; }],
    ['missing instructor', (s) => { delete s.context.instructor; }],
    ['instructor left as the example placeholder, not our real contact', (s) => { s.context.instructor = { name: 'Ibrahim Khalid', mbox: 'mailto:ik@example.com' }; }],
    ['instructor missing mbox', (s) => { s.context.instructor = { name: 'Funademy Instructor' }; }],
    ['wrong context.language', (s) => { s.context.language = 'en-US'; }],
    ['ar-SA key in object.definition.name (pre-parity format)', (s) => { s.object.definition.name['ar-SA'] = 'دورة فناديمي'; }],
    ['empty en-US description', (s) => { s.object.definition.description['en-US'] = ''; }],
    ['wrong definition.type', (s) => { s.object.definition.type = 'http://adlnet.gov/expapi/activities/course'; }],
    ['wrong duration value', (s) => { s.context.extensions['https://nelc.gov.sa/extensions/duration'] = 'PT30H'; }],
    ['lowercase lms_url value', (s) => { s.context.extensions['https://nelc.gov.sa/extensions/lms_url'] = 'https://funademy.io'; }],
    ['program_url not the statement own course id', (s) => { s.context.extensions['https://nelc.gov.sa/extensions/program_url'] = 'https://funademy.io/course/OTHER'; }],
    ['platform extension name missing en-US', (s) => { s.context.extensions['https://nelc.gov.sa/extensions/platform'] = { name: { 'ar-SA': 'فناديمي' } }; }],
    ['platform extension left as the example placeholder name', (s) => { s.context.extensions['https://nelc.gov.sa/extensions/platform'] = { name: { 'ar-SA': 'التقنيات المتقدمة للتدريب', 'en-US': 'Leading Tech for Training' } }; }],
    ['a fifth extension key added', (s) => { s.context.extensions['https://nelc.gov.sa/extensions/extra'] = 'x'; }],
    ['one of the 4 extension keys missing', (s) => { delete s.context.extensions['https://nelc.gov.sa/extensions/lms_url']; }],
    ['verb outside the journey vocabulary', (s) => { s.verb = { id: 'http://adlnet.gov/expapi/verbs/experienced', display: { 'en-US': 'experienced' } }; }],
    ['verb display missing en-US', (s) => { s.verb = { id: s.verb.id, display: { ar: 'سجل' } }; }],
    ['actor mbox not derived from actor.name (national ID)', (s) => { s.actor.mbox = 'mailto:someone@example.com'; }],
    ['actor objectType wrong', (s) => { s.actor.objectType = 'Group'; }],
    ['missing timestamp', (s) => { delete s.timestamp; }],
  ];
  for (const [label, mutate] of rejected) {
    it(`rejects on registered: ${label}`, () => {
      const s = freshStatement();
      mutate(s);
      expect(classifyJourneyStatement(s)).toBe(null);
    });
  }

  it('rejects the exact shapes the 2026-08-10 verifier flagged (per-step rules)', () => {
    // CTX001/CRS008 — a course description outside `registered`
    const init = fresh('initialized');
    init.object.definition.description = { 'en-US': COURSE_DESC_EN };
    expect(classifyJourneyStatement(init)).toBe(null);

    // CTX002 — the full 4-extension block outside `registered`
    const prog = fresh('progressed');
    prog.context.extensions = fresh('registered').context.extensions;
    expect(classifyJourneyStatement(prog)).toBe(null);

    // CRS003 — watched targeting the course object (pre-fix shape)
    const watched = fresh('watched');
    watched.object = fresh('registered').object;
    delete watched.context.contextActivities;
    expect(classifyJourneyStatement(watched)).toBe(null);

    // ASM004 — rated without (or with an empty) text response
    const rated = fresh('rated');
    delete rated.result.response;
    expect(classifyJourneyStatement(rated)).toBe(null);
    const rated2 = fresh('rated');
    rated2.result.response = '';
    expect(classifyJourneyStatement(rated2)).toBe(null);

    // sub-activity id not derived from its parent course id
    const lesson = fresh('completed_lesson');
    lesson.object.id = 'https://funademy.io/course/OTHER/lessons/1';
    expect(classifyJourneyStatement(lesson)).toBe(null);

    // sub-activity without the course parent
    const quiz = fresh('attempted');
    delete quiz.context.contextActivities;
    expect(classifyJourneyStatement(quiz)).toBe(null);

    // a result on a step that must carry none
    const earned = fresh('earned');
    earned.result = { completion: true };
    expect(classifyJourneyStatement(earned)).toBe(null);

    // the certificate must not carry a description (package Earned.php shape)
    const earned2 = fresh('earned');
    earned2.object.definition.description = { 'en-US': 'Certificate' };
    expect(classifyJourneyStatement(earned2)).toBe(null);

    // STRICT BY DESIGN — texts and scores must match the builder exactly:
    // any drift means the statement did not come from the current builder.
    const watched2 = fresh('watched');
    watched2.object.definition.name = { 'en-US': 'Some Other Video' };
    expect(classifyJourneyStatement(watched2)).toBe(null);

    const parentDrift = fresh('watched');
    parentDrift.context.contextActivities.parent[0].definition.name = { 'en-US': 'Another Course' };
    expect(classifyJourneyStatement(parentDrift)).toBe(null);

    const attemptedEmptyScore = fresh('attempted');
    attemptedEmptyScore.result.score = {};
    expect(classifyJourneyStatement(attemptedEmptyScore)).toBe(null);

    const attemptedStringRaw = fresh('attempted');
    attemptedStringRaw.result.score = { scaled: 0.8, raw: '80', min: 0, max: 100 };
    expect(classifyJourneyStatement(attemptedStringRaw)).toBe(null);

    const ratedBadBounds = fresh('rated');
    ratedBadBounds.result.score = { scaled: 1, raw: 5, min: 6, max: 5 };
    expect(classifyJourneyStatement(ratedBadBounds)).toBe(null);

    const wrongDisplay = fresh('initialized');
    wrongDisplay.verb.display = { 'en-US': 'launched' };
    expect(classifyJourneyStatement(wrongDisplay)).toBe(null);

    // VALID-but-different result values must also be rejected — results are
    // pinned in the contract, and a plausible substitute is still not ours.
    const ratedOtherText = fresh('rated');
    ratedOtherText.result.response = 'Great course, would recommend.';
    expect(classifyJourneyStatement(ratedOtherText)).toBe(null);

    const watchedOtherDuration = fresh('watched');
    watchedOtherDuration.result.duration = 'PT5M';
    expect(classifyJourneyStatement(watchedOtherDuration)).toBe(null);

    const attemptedOtherScore = fresh('attempted');
    attemptedOtherScore.result.score = { scaled: 0.7, raw: 70, min: 0, max: 100 };
    expect(classifyJourneyStatement(attemptedOtherScore)).toBe(null);

    const lessonNotCompleted = fresh('completed_lesson');
    lessonNotCompleted.result.completion = false;
    expect(classifyJourneyStatement(lessonNotCompleted)).toBe(null);
  });

  it('discriminates the three `completed` statements by their object contracts', () => {
    expect(classifyJourneyStatement(fresh('completed_lesson'))).toBe('completed_lesson');
    expect(classifyJourneyStatement(fresh('completed_unit'))).toBe('completed_unit');
    expect(classifyJourneyStatement(fresh('completed_course'))).toBe('completed_course');
  });

  it('reports missing steps by unique contract label (a full journey covers all 10)', () => {
    const keys = journey().map((s) => classifyJourneyStatement(s.statement));
    expect(missingJourneySteps(keys)).toEqual([]);
    expect(missingJourneySteps(keys.filter((k) => k !== 'completed_unit'))).toEqual(['completed (unit)']);
    // a swapped-in duplicate leaves its own step missing
    expect(
      missingJourneySteps([...keys.filter((k) => k !== 'completed_lesson'), 'earned']),
    ).toEqual(['completed (lesson)']);
    expect(missingJourneySteps([])).toHaveLength(10);
    expect(missingJourneySteps([null, undefined, 'registered'])).toHaveLength(9);
  });
});

// NELC's LRS credentials for this platform are WRITE-ONLY: GET /statements
// answers 401 «does not have read permissions» even though POSTs succeed
// (observed 2026-08-10 — a delivered 10/10 journey and this 401 in the same
// minute). The self-check must classify EXACTLY that case as informational
// (not a failure); every other error stays a real error.
describe('isLrsReadDenied — write-only credential classifier', () => {
  const NELC_BODY = '{"message":"The provided user account does not have read permissions"}';

  it('recognizes the NELC read-permission 401 (exact recorded body)', () => {
    expect(isLrsReadDenied(401, NELC_BODY)).toBe(true);
    // tolerant of whitespace/case variations of the same message
    expect(isLrsReadDenied(401, 'no READ Permissions for this account')).toBe(true);
  });

  it('keeps every other error a real error', () => {
    // 401 for a different reason (bad credentials) is NOT read-denied
    expect(isLrsReadDenied(401, '{"message":"Invalid credentials"}')).toBe(false);
    expect(isLrsReadDenied(401, '')).toBe(false);
    // geo-block / server errors / network failures are never read-denied
    expect(isLrsReadDenied(403, NELC_BODY)).toBe(false);
    expect(isLrsReadDenied(500, NELC_BODY)).toBe(false);
    expect(isLrsReadDenied(null, NELC_BODY)).toBe(false);
    // success is obviously not read-denied
    expect(isLrsReadDenied(200, '')).toBe(false);
  });
});

describe('pre-send burned-ID check primitives (precheck)', () => {
  it('builds an AGENT-ONLY query URL — all courses, small limit', () => {
    vi.stubEnv('NELC_LRS_ENDPOINT', 'https://lrs.staging.example/data/xAPI');
    const url = new URL(lrsAgentStatementsQueryUrl('1234567890'));
    expect(`${url.origin}${url.pathname}`).toBe('https://lrs.staging.example/data/xAPI/statements');
    expect(JSON.parse(url.searchParams.get('agent')!)).toEqual({
      objectType: 'Agent',
      mbox: 'mailto:1234567890@gmail.com', // same derivation as the journey actor
    });
    // NO course scoping on purpose: NELC's LRS is one shared store across our
    // environments and never deletes — a statement for ANY course burns the ID.
    expect(url.searchParams.get('activity')).toBeNull();
    expect(url.searchParams.get('related_activities')).toBeNull();
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('clean ONLY for a parseable 200 with an empty statements array', () => {
    expect(classifyPrecheckResponse(true, 200, JSON.stringify({ statements: [] }))).toEqual({
      kind: 'clean',
    });
  });

  it('ANY stored statement means burned (count + pagination flag)', () => {
    expect(
      classifyPrecheckResponse(true, 200, JSON.stringify({ statements: [{}, {}, {}] })),
    ).toEqual({ kind: 'burned', count: 3, hasMore: false });
    expect(
      classifyPrecheckResponse(
        true,
        200,
        JSON.stringify({ statements: [{}], more: '/xAPI/statements?c=1' }),
      ),
    ).toEqual({ kind: 'burned', count: 1, hasMore: true });
  });

  it('read-denied 401 (write-only credentials) is unverifiable — NEVER clean', () => {
    expect(
      classifyPrecheckResponse(
        false,
        401,
        '{"message":"The provided user account does not have read permissions"}',
      ),
    ).toEqual({ kind: 'unverifiable', reason: 'read_denied' });
  });

  it('network / HTTP failures are unverifiable — NEVER clean (fail-closed)', () => {
    expect(classifyPrecheckResponse(false, null, 'network_error')).toEqual({
      kind: 'unverifiable',
      reason: 'network',
    });
    expect(classifyPrecheckResponse(false, 403, '<html>geo</html>')).toEqual({
      kind: 'unverifiable',
      reason: 'http_403',
    });
    expect(classifyPrecheckResponse(false, 500, '')).toEqual({
      kind: 'unverifiable',
      reason: 'http_500',
    });
  });

  it('a 2xx that is not exactly 200 is unverifiable (fail-closed)', () => {
    expect(classifyPrecheckResponse(true, 204, '')).toEqual({
      kind: 'unverifiable',
      reason: 'http_204',
    });
  });

  it('an empty PAGE with a pagination cursor is not proof of a clean ID', () => {
    expect(
      classifyPrecheckResponse(
        true,
        200,
        JSON.stringify({ statements: [], more: '/xAPI/statements?c=2' }),
      ),
    ).toEqual({ kind: 'unverifiable', reason: 'empty_page_with_more' });
  });

  it('a 200 without a statements array is unverifiable, not clean', () => {
    expect(classifyPrecheckResponse(true, 200, 'not json')).toEqual({
      kind: 'unverifiable',
      reason: 'unparseable',
    });
    expect(classifyPrecheckResponse(true, 200, JSON.stringify({ ok: true }))).toEqual({
      kind: 'unverifiable',
      reason: 'unparseable',
    });
  });
});

describe('POST /svc/admin/nelc', () => {
  beforeEach(async () => {
    await prisma.xapiStatement.deleteMany({});
  });

  it('rejects an invalid national ID', async () => {
    stubLrsEnv();
    const res = await nelcPOST(postReq({ nationalId: '12345', courseIri: 'https://funademy.io/course/CR001' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_national_id');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed course IRI', async () => {
    stubLrsEnv();
    const res = await nelcPOST(postReq({ nationalId: '1234567890', courseIri: 'not-a-url' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_course_iri');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 not_configured and sends/persists nothing without LRS secrets', async () => {
    expect(lrsConfigured()).toBe(false); // no NELC_* env in tests by default
    const res = await nelcPOST(postReq({ nationalId: '1234567890', courseIri: 'https://funademy.io/course/CR001' }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe('not_configured');
    expect(data.configured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.xapiStatement.count()).toBe(0);
  });

  it('sends the journey in order, persists per-statement logs, and reports per-step results', async () => {
    stubLrsEnv();
    fetchMock.mockResolvedValue(new Response('["stored"]', { status: 200 }));

    const res = await nelcPOST(postReq({ nationalId: '1111111111', courseIri: 'https://funademy.io/course/CR001' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.environment).toBe('staging');
    expect(data.results.map((r: { verb: string }) => r.verb)).toEqual([
      'registered',
      'initialized',
      'watched',
      'completed_lesson',
      'attempted',
      'completed_unit',
      'progressed',
      'completed_course',
      'rated',
      'earned',
    ]);
    expect(data.results.every((r: { ok: boolean; httpStatus: number }) => r.ok && r.httpStatus === 200)).toBe(true);

    // Statements went to the LRS statements endpoint with Basic auth + xAPI version.
    expect(fetchMock).toHaveBeenCalledTimes(10);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://lrs.staging.example/data/xAPI/statements');
    expect(init.headers['X-Experience-API-Version']).toBe('1.0.3');
    expect(init.headers.Authorization).toMatch(/^Basic /);
    const sentBody = JSON.parse(init.body);
    expect(sentBody.actor.mbox).toBe('mailto:1111111111@gmail.com');
    expect(sentBody.actor.name).toBe('1111111111');

    // Audit rows persisted for every statement.
    const rows = await prisma.xapiStatement.findMany({ where: { runId: data.runId }, orderBy: { id: 'asc' } });
    expect(rows.map((r) => r.verb)).toEqual([
      'registered',
      'initialized',
      'watched',
      'completed_lesson',
      'attempted',
      'completed_unit',
      'progressed',
      'completed_course',
      'rated',
      'earned',
    ]);
    expect(rows.every((r) => r.ok && r.httpStatus === 200 && r.environment === 'staging')).toBe(true);
    expect(rows.every((r) => r.nationalId === '1111111111')).toBe(true);

    // SEQ003: a bare re-send for the same ID is refused (server path too)…
    const resDup = await nelcPOST(postReq({ nationalId: '1111111111', courseIri: 'https://funademy.io/course/CR001' }));
    expect(resDup.status).toBe(409);
    const dup = await resDup.json();
    expect(dup.error).toBe('duplicate_journey');
    expect(dup.delivered).toBe(true);

    // …while the confirmed override still generates fresh statement ids.
    const res2 = await nelcPOST(
      postReq({ nationalId: '1111111111', courseIri: 'https://funademy.io/course/CR001', confirmDuplicate: true }),
    );
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    const first = new Set(data.results.map((r: { statementId: string }) => r.statementId));
    for (const r of data2.results) expect(first.has(r.statementId)).toBe(false);
  });

  it('stops on the first LRS failure and records the rejected statement', async () => {
    stubLrsEnv();
    fetchMock
      .mockResolvedValueOnce(new Response('["stored"]', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"error":"invalid actor"}', { status: 400 }));

    const res = await nelcPOST(postReq({ nationalId: '2222222222', courseIri: 'https://funademy.io/course/CR001' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.results).toHaveLength(2); // registered ok, initialized failed, rest never sent
    expect(data.results[1]).toMatchObject({ verb: 'initialized', ok: false, httpStatus: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const rows = await prisma.xapiStatement.findMany({ where: { runId: data.runId }, orderBy: { id: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[1].ok).toBe(false);
    expect(rows[1].response).toContain('invalid actor');
  });

  it('records a network error as a failed attempt (no HTTP status), never fake success', async () => {
    stubLrsEnv();
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await nelcPOST(postReq({ nationalId: '3333333333', courseIri: 'https://funademy.io/course/CR001' }));
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].httpStatus).toBeNull();
    expect(data.results[0].response).toContain('network_error');

    const rows = await prisma.xapiStatement.findMany({ where: { runId: data.runId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].ok).toBe(false);
    expect(rows[0].httpStatus).toBeNull();
  });
});

// NELC's WAF geo-blocks our server egress, so the admin UI uses a browser
// relay: the server PREPARES the journey (fresh UUIDs + LRS URL + Basic auth)
// and the owner's browser sends it, then RECORDS the outcomes for the audit log.
describe('POST /svc/admin/nelc — browser relay (prepare/record)', () => {
  beforeEach(async () => {
    await prisma.xapiStatement.deleteMany({});
    await prisma.xapiPreparedRun.deleteMany({});
  });

  it('prepare returns the LRS URL, Basic authorization, and the 10 prepared statements', async () => {
    stubLrsEnv();
    const res = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe('https://lrs.staging.example/data/xAPI/statements');
    expect(data.authorization).toMatch(/^Basic /);
    expect(data.runId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(data.steps.map((s: { key: string }) => s.key)).toEqual([
      'registered',
      'initialized',
      'watched',
      'completed_lesson',
      'attempted',
      'completed_unit',
      'progressed',
      'completed_course',
      'rated',
      'earned',
    ]);
    expect(data.steps[0].statement.actor.mbox).toBe('mailto:4444444444@gmail.com');
    // prepare must not send or write audit rows by itself…
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.xapiStatement.count()).toBe(0);
    // …but it persists the prepared-run state that `record` will verify against
    const run = await prisma.xapiPreparedRun.findUnique({ where: { runId: data.runId } });
    expect(run?.consumed).toBe(false);
    expect(run?.nationalId).toBe('4444444444');

    // SEQ003 double-send guard: a second prepare while an unconsumed journey run
    // already exists returns 409 duplicate_journey with delivered:false — ID not
    // yet burned (pending run only); prevents a double-click from creating two sends.
    const res2 = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res2.status).toBe(409);
    const dup = await res2.json();
    expect(dup.error).toBe('duplicate_journey');
    expect(dup.delivered).toBe(false); // pending run only — ID not yet burned in LRS
  });

  it('prepare issues fresh statement IDs once the prior run is consumed', async () => {
    stubLrsEnv();
    // First prepare + record (consume the run).
    const res1 = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    const data1 = await res1.json();
    // Record all steps as ok so the run is consumed and a delivered row exists.
    const results = data1.steps.map((s: { key: string; statementId: string }) => ({
      verb: s.key, statementId: s.statementId, ok: true, httpStatus: 204, response: '',
    }));
    await nelcPOST(postReq({ action: 'record', runId: data1.runId, results }));

    // After recording, the first run is consumed and a delivered row exists.
    // A second prepare WITHOUT override → 409 duplicate_journey with delivered:true (ID burned in LRS).
    const res2 = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res2.status).toBe(409);
    const dup2 = await res2.json();
    expect(dup2.error).toBe('duplicate_journey');
    expect(dup2.delivered).toBe(true); // delivered rows exist — ID permanently burned

    // confirmDuplicate:true bypasses the guard and produces fresh statement IDs.
    const res3 = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001', confirmDuplicate: true }),
    );
    expect(res3.status).toBe(200);
    const data3 = await res3.json();
    const first = new Set(data1.steps.map((s: { statementId: string }) => s.statementId));
    for (const s of data3.steps) expect(first.has(s.statementId)).toBe(false);
  });

  it('prepare succeeds after a prior unconsumed run expires (browser-crash retry)', async () => {
    stubLrsEnv();
    // Manually insert an unconsumed journey run that is already expired (past
    // its TTL) — simulates the owner's browser crashing before recording.
    await prisma.xapiPreparedRun.create({
      data: {
        runId: '00000000-dead-beef-cafe-000000000001',
        environment: 'staging',
        nationalId: '6666666666',
        courseIri: 'https://funademy.io/course/CR001',
        steps: [{ key: 'registered', statementId: '00000000-dead-beef-cafe-000000000002' }],
        expiresAt: new Date(Date.now() - 1), // already expired
        consumed: false,
      },
    });

    // A fresh prepare for the same ID MUST succeed — the expired run must not
    // permanently block retries after the TTL. findPriorJourneySignal cleans
    // expired rows and filters `expiresAt > now` so the 409 is never returned.
    const res = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '6666666666', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.steps).toHaveLength(10);
    // The expired run should have been cleaned up.
    const expired = await prisma.xapiPreparedRun.findUnique({
      where: { runId: '00000000-dead-beef-cafe-000000000001' },
    });
    expect(expired).toBeNull();
  });

  it('prepare requires re-entering the admin password (step-up) before exposing LRS credentials', async () => {
    stubLrsEnv();
    const bad = await nelcPOST(
      postReq({
        action: 'prepare',
        password: 'wrong-password',
        nationalId: '4444444444',
        courseIri: 'https://funademy.io/course/CR001',
      }),
    );
    expect(bad.status).toBe(401);
    expect((await bad.json()).error).toBe('reauth_failed');
    expect(await prisma.xapiPreparedRun.count()).toBe(0);
  });

  it('prepare refuses without LRS secrets (never hands out fake credentials)', async () => {
    const res = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('not_configured');
  });

  it('record persists browser-reported results (failures included) into the audit log', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '5555555555', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const results = prep.steps
      .slice(0, 3)
      .map((s: { key: string; statementId: string }, i: number) => ({
        verb: s.key,
        statementId: s.statementId,
        ok: i < 2,
        httpStatus: i < 2 ? 200 : 403,
        response: i < 2 ? '["stored"]' : '<html>blocked</html>',
      }));
    const res = await nelcPOST(
      postReq({
        action: 'record',
        runId: prep.runId,
        nationalId: '5555555555',
        courseIri: 'https://funademy.io/course/CR001',
        results,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false); // one step failed
    expect(data.recorded).toBe(3);

    const rows = await prisma.xapiStatement.findMany({ where: { runId: prep.runId }, orderBy: { id: 'asc' } });
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'initialized', 'watched']);
    expect(rows[2].ok).toBe(false);
    expect(rows[2].httpStatus).toBe(403);
    expect(rows.every((r) => r.environment === 'staging' && r.nationalId === '5555555555')).toBe(true);
    // Browser-relay rows are explicitly labeled as browser-reported.
    expect(rows.every((r) => r.source === 'browser')).toBe(true);

    // The prepared run is consumed — recording the same run again is refused.
    const dup = await nelcPOST(postReq({ action: 'record', runId: prep.runId, results }));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('already_recorded');
    expect(await prisma.xapiStatement.count()).toBe(3);
  });

  it('record refuses well-formed results the server never prepared (no fabricated audit)', async () => {
    stubLrsEnv();
    const results = JOURNEY_STEPS.map((s) => ({
      verb: s.key,
      statementId: randomUUID(),
      ok: true,
      httpStatus: 200,
      response: '["stored"]',
    }));
    const res = await nelcPOST(postReq({ action: 'record', runId: randomUUID(), results }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('unknown_run');
    expect(await prisma.xapiStatement.count()).toBe(0);
  });

  it('record accepts only the exact prepared ids, in order, as a stop-on-failure prefix', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '7777777777', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const mk = (i: number, ok = true) => ({
      verb: prep.steps[i].key,
      statementId: prep.steps[i].statementId,
      ok,
      httpStatus: ok ? 200 : 400,
      response: 'x',
    });
    // swapped statement id
    const swapped = { ...mk(0), statementId: prep.steps[1].statementId };
    expect((await nelcPOST(postReq({ action: 'record', runId: prep.runId, results: [swapped] }))).status).toBe(400);
    // not starting at the first step
    expect((await nelcPOST(postReq({ action: 'record', runId: prep.runId, results: [mk(1)] }))).status).toBe(400);
    // failure in the middle (the browser must stop on the first failure)
    expect(
      (await nelcPOST(postReq({ action: 'record', runId: prep.runId, results: [mk(0, false), mk(1)] }))).status,
    ).toBe(400);
    // none of the rejections consumed the run or wrote audit rows
    expect(await prisma.xapiStatement.count()).toBe(0);
    // the genuine stop-on-failure prefix is accepted
    const okRes = await nelcPOST(
      postReq({ action: 'record', runId: prep.runId, results: [mk(0), mk(1, false)] }),
    );
    expect(okRes.status).toBe(200);
    expect(await prisma.xapiStatement.count()).toBe(2);
  });

  it('record refuses an expired prepared run', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '8888888888', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    await prisma.xapiPreparedRun.update({
      where: { runId: prep.runId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await nelcPOST(
      postReq({
        action: 'record',
        runId: prep.runId,
        results: [{ verb: prep.steps[0].key, statementId: prep.steps[0].statementId, ok: true, httpStatus: 200, response: 'x' }],
      }),
    );
    expect(res.status).toBe(410);
    expect((await res.json()).error).toBe('run_expired');
    expect(await prisma.xapiStatement.count()).toBe(0);
  });

  it('record rejects tampered payloads (bad verb / uuid / status / empty)', async () => {
    stubLrsEnv();
    const runId = '3f2f0d68-6d4e-4a5e-9b1a-2c7f8e9a0b1c';
    const good = { verb: 'registered', statementId: runId, ok: true, httpStatus: 200, response: 'ok' };
    for (const bad of [
      { ...good, verb: 'hacked' },
      { ...good, statementId: 'not-a-uuid' },
      { ...good, httpStatus: 12345 },
    ]) {
      const res = await nelcPOST(
        postReq({
          action: 'record',
          runId,
          nationalId: '6666666666',
          courseIri: 'https://funademy.io/course/CR001',
          results: [bad],
        }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_results');
    }
    const resEmpty = await nelcPOST(
      postReq({
        action: 'record',
        runId,
        nationalId: '6666666666',
        courseIri: 'https://funademy.io/course/CR001',
        results: [],
      }),
    );
    expect(resEmpty.status).toBe(400);
    const resBadRun = await nelcPOST(
      postReq({
        action: 'record',
        runId: 'nope',
        nationalId: '6666666666',
        courseIri: 'https://funademy.io/course/CR001',
        results: [good],
      }),
    );
    expect(resBadRun.status).toBe(400);
    expect((await resBadRun.json()).error).toBe('invalid_run_id');
    expect(await prisma.xapiStatement.count()).toBe(0);
  });

  it('prepare enforces the SEQ003 duplicate guard (409) until explicitly confirmed', async () => {
    stubLrsEnv();
    // Deliver a journey for this ID: prepare + record one ok row.
    const prep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '9999999999', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    await nelcPOST(
      postReq({
        action: 'record',
        runId: prep.runId,
        results: [{ verb: prep.steps[0].key, statementId: prep.steps[0].statementId, ok: true, httpStatus: 200, response: '["stored"]' }],
      }),
    );

    // The same ID+course now warns instead of silently re-sending…
    const again = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '9999999999', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(again.status).toBe(409);
    const dup = await again.json();
    expect(dup.error).toBe('duplicate_journey');
    expect(dup.delivered).toBe(true); // delivered rows exist — strong warning
    expect(dup.lastSentAt).toBeTruthy();

    // …a fresh national ID sails through…
    const other = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '9999999998', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(other.status).toBe(200);

    // …and the explicit override still works (owner's informed choice).
    const confirmed = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '9999999999', courseIri: 'https://funademy.io/course/CR001', confirmDuplicate: true }),
    );
    expect(confirmed.status).toBe(200);
  });

  it('failed-only journeys and self-check rows do NOT trigger the duplicate guard', async () => {
    stubLrsEnv();
    // A journey whose only reported row FAILED — nothing reached the LRS,
    // so re-sending is the fix, not a duplicate.
    const prep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '1212121212', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    await nelcPOST(
      postReq({
        action: 'record',
        runId: prep.runId,
        results: [{ verb: prep.steps[0].key, statementId: prep.steps[0].statementId, ok: false, httpStatus: 403, response: '<html>blocked</html>' }],
      }),
    );
    // A successful self-check row for the same learner (ok=true, but a READ).
    const check = await (
      await nelcPOST(
        postReq({ action: 'check', password: 'test-admin-pass', nationalId: '1212121212', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    await nelcPOST(
      postReq({ action: 'record_check', checkId: check.checkId, ok: true, httpStatus: 200, matched: 0, parityMatched: 0, verbs: [], missingSteps: [] }),
    );

    const again = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '1212121212', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(again.status).toBe(200);
  });

  it('an unrecorded prepared run counts as a possible send (weak duplicate warning)', async () => {
    stubLrsEnv();
    // Prepared but never recorded — the browser may have POSTed the
    // statements and died before `record` (the crash-before-record gap).
    await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '7777777777', courseIri: 'https://funademy.io/course/CR001' }),
    );
    const again = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '7777777777', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(again.status).toBe(409);
    const dup = await again.json();
    expect(dup.error).toBe('duplicate_journey');
    expect(dup.delivered).toBe(false); // no delivered rows — weak warning

    // An unrecorded self-CHECK never blocks — it is read-only.
    await nelcPOST(
      postReq({ action: 'check', password: 'test-admin-pass', nationalId: '7676767676', courseIri: 'https://funademy.io/course/CR001' }),
    );
    const fresh = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '7676767676', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(fresh.status).toBe(200);
  });
});

// Read-back self-check: the server prepares a one-time filtered statements
// GET for the owner's browser (same step-up + relay pattern as the journey),
// and record_check persists ONE distinguishable audit row per check.
describe('POST /svc/admin/nelc — pre-send burned-ID check (precheck)', () => {
  beforeEach(async () => {
    await prisma.xapiStatement.deleteMany({});
    await prisma.xapiPreparedRun.deleteMany({});
  });

  it('hands the browser an AGENT-ONLY query URL + Basic auth and persists NOTHING', async () => {
    stubLrsEnv();
    const res = await nelcPOST(
      postReq({ action: 'precheck', password: 'test-admin-pass', nationalId: '8888888888', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(true);
    expect(data.environment).toBe('staging');
    expect(data.authorization).toMatch(/^Basic /);
    const url = new URL(data.url);
    expect(`${url.origin}${url.pathname}`).toBe('https://lrs.staging.example/data/xAPI/statements');
    expect(JSON.parse(url.searchParams.get('agent')!)).toEqual({
      objectType: 'Agent',
      mbox: 'mailto:8888888888@gmail.com',
    });
    // AGENT-ONLY on purpose — a statement for ANY course burns the ID.
    expect(url.searchParams.get('activity')).toBeNull();
    // READ-ONLY + record-free: the server called nothing and stored nothing —
    // unlike `check`, there is no one-time run row at all.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.xapiStatement.count()).toBe(0);
    expect(await prisma.xapiPreparedRun.count()).toBe(0);
  });

  it('refuses when not configured, requires the step-up password, validates the ID', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-admin-pass');
    const un = await nelcPOST(
      postReq({ action: 'precheck', password: 'test-admin-pass', nationalId: '8888888888', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(un.status).toBe(503);
    expect((await un.json()).error).toBe('not_configured');

    stubLrsEnv();
    const bad = await nelcPOST(
      postReq({ action: 'precheck', password: 'wrong-password', nationalId: '8888888888', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(bad.status).toBe(401);
    expect((await bad.json()).error).toBe('reauth_failed');

    const badId = await nelcPOST(
      postReq({ action: 'precheck', password: 'test-admin-pass', nationalId: '12345', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(badId.status).toBe(400);
    expect((await badId.json()).error).toBe('invalid_national_id');
    expect(await prisma.xapiPreparedRun.count()).toBe(0);
  });
});

describe('POST /svc/admin/nelc — self-check read-back (check/record_check)', () => {
  beforeEach(async () => {
    await prisma.xapiStatement.deleteMany({});
    await prisma.xapiPreparedRun.deleteMany({});
  });

  it('check hands the browser a filtered read-back URL + Basic auth and persists a one-time check', async () => {
    stubLrsEnv();
    const res = await nelcPOST(
      postReq({ action: 'check', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.checkId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(data.authorization).toMatch(/^Basic /);
    const url = new URL(data.url);
    expect(`${url.origin}${url.pathname}`).toBe('https://lrs.staging.example/data/xAPI/statements');
    expect(JSON.parse(url.searchParams.get('agent')!)).toEqual({
      objectType: 'Agent',
      mbox: 'mailto:4444444444@gmail.com',
    });
    expect(url.searchParams.get('activity')).toBe('https://funademy.io/course/CR001');
    expect(url.searchParams.get('limit')).toBe('25');
    // read-only: nothing sent by the server, no audit rows yet…
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.xapiStatement.count()).toBe(0);
    // …but the one-time check run is persisted, marked as a self_check
    const run = await prisma.xapiPreparedRun.findUnique({ where: { runId: data.checkId } });
    expect(run?.consumed).toBe(false);
    expect(run?.nationalId).toBe('4444444444');
    expect((run?.steps as { key: string }[])[0].key).toBe('self_check');
  });

  it('check refuses when not configured, and requires the step-up password when configured', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-admin-pass');
    const un = await nelcPOST(
      postReq({ action: 'check', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(un.status).toBe(503);
    expect((await un.json()).error).toBe('not_configured');

    stubLrsEnv();
    const bad = await nelcPOST(
      postReq({ action: 'check', password: 'wrong-password', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(bad.status).toBe(401);
    expect((await bad.json()).error).toBe('reauth_failed');
    const badId = await nelcPOST(
      postReq({ action: 'check', password: 'test-admin-pass', nationalId: '12345', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(badId.status).toBe(400);
    expect(await prisma.xapiPreparedRun.count()).toBe(0);
  });

  it('record_check persists ONE distinguishable audit row (matched count + verbs) and consumes the check', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'check', password: 'test-admin-pass', nationalId: '5555555555', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const res = await nelcPOST(
      postReq({
        action: 'record_check',
        checkId: prep.checkId,
        ok: true,
        httpStatus: 200,
        matched: 12,
        parityMatched: 10,
        verbs: ['earned', 'rated', 'completed'],
        missingSteps: [],
        detail: '',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      matched: 12,
      parityMatched: 10,
      recorded: 1,
      source: 'browser',
    });

    const rows = await prisma.xapiStatement.findMany({ where: { runId: prep.checkId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].verb).toBe('self_check'); // distinguishable from journey verbs
    expect(rows[0].source).toBe('browser');
    expect(rows[0].ok).toBe(true);
    expect(rows[0].httpStatus).toBe(200);
    // identity/course come from the server-stored check, never the client
    expect(rows[0].nationalId).toBe('5555555555');
    expect(rows[0].courseIri).toBe('https://funademy.io/course/CR001');
    const summary = JSON.parse(rows[0].response!);
    expect(summary.matched).toBe(12);
    // example-structure count is stored separately — old-format statements
    // inflate `matched` but NELC's verifier only counts parity ones
    expect(summary.parityMatched).toBe(10);
    expect(summary.missingSteps).toEqual([]);
    expect(summary.verbs).toEqual(['earned', 'rated', 'completed']);

    // one-time: a duplicate report is refused and writes nothing
    const dup = await nelcPOST(
      postReq({ action: 'record_check', checkId: prep.checkId, ok: true, httpStatus: 200, matched: 12, parityMatched: 10, verbs: [], missingSteps: [] }),
    );
    expect(dup.status).toBe(409);
    expect(await prisma.xapiStatement.count()).toBe(1);
  });

  it('record_check stores failed reads honestly (ok=false, null status, detail)', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'check', password: 'test-admin-pass', nationalId: '5555555555', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const res = await nelcPOST(
      postReq({
        action: 'record_check',
        checkId: prep.checkId,
        ok: false,
        httpStatus: null,
        matched: 0,
        parityMatched: 0,
        verbs: [],
        missingSteps: [],
        detail: 'browser_network_or_cors: Failed to fetch',
      }),
    );
    expect(res.status).toBe(200);
    const rows = await prisma.xapiStatement.findMany({ where: { runId: prep.checkId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].ok).toBe(false);
    expect(rows[0].httpStatus).toBeNull();
    expect(rows[0].response).toContain('browser_network_or_cors');
  });

  it('record_check stores the read-denied 401 with its detail, recognizable by the classifier', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'check', password: 'test-admin-pass', nationalId: '5555555555', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const detail = '{"message":"The provided user account does not have read permissions"}';
    const res = await nelcPOST(
      postReq({
        action: 'record_check',
        checkId: prep.checkId,
        ok: false,
        httpStatus: 401,
        matched: 0,
        parityMatched: 0,
        verbs: [],
        missingSteps: [],
        detail,
      }),
    );
    expect(res.status).toBe(200);
    const rows = await prisma.xapiStatement.findMany({ where: { runId: prep.checkId } });
    expect(rows).toHaveLength(1);
    // stored honestly as a non-ok read…
    expect(rows[0].ok).toBe(false);
    expect(rows[0].httpStatus).toBe(401);
    // …with the detail in the summary JSON, so the log UI can re-classify the
    // row as informational (write-only credentials) instead of a failure
    const summary = JSON.parse(rows[0].response!);
    expect(isLrsReadDenied(rows[0].httpStatus, summary.detail)).toBe(true);
  });

  it('record_check refuses unknown/journey/tampered/expired payloads (and record refuses check runs)', async () => {
    stubLrsEnv();
    // unknown check id
    expect(
      (
        await nelcPOST(
          postReq({ action: 'record_check', checkId: randomUUID(), ok: true, httpStatus: 200, matched: 1, parityMatched: 1, verbs: [], missingSteps: [] }),
        )
      ).status,
    ).toBe(404);
    // malformed check id
    expect(
      (
        await nelcPOST(postReq({ action: 'record_check', checkId: 'nope', ok: true, httpStatus: 200, matched: 1, parityMatched: 1, verbs: [], missingSteps: [] }))
      ).status,
    ).toBe(400);

    // a prepared JOURNEY run may not be consumed as a self-check…
    const journeyPrep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '6666666666', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const cross = await nelcPOST(
      postReq({ action: 'record_check', checkId: journeyPrep.runId, ok: true, httpStatus: 200, matched: 10, parityMatched: 10, verbs: [], missingSteps: [] }),
    );
    expect(cross.status).toBe(400);
    expect((await cross.json()).error).toBe('not_a_check');

    // …and a prepared CHECK may not feed the journey `record` action
    const checkPrep = await (
      await nelcPOST(
        postReq({ action: 'check', password: 'test-admin-pass', nationalId: '6666666666', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const rev = await nelcPOST(
      postReq({
        action: 'record',
        runId: checkPrep.checkId,
        results: [{ verb: 'registered', statementId: randomUUID(), ok: true, httpStatus: 200, response: 'x' }],
      }),
    );
    expect(rev.status).toBe(400);

    // tampered payloads
    for (const bad of [
      { matched: -1 },
      { matched: 3.5 },
      { matched: 'many' },
      { parityMatched: -1 },
      { parityMatched: 2.5 },
      { parityMatched: 'all' },
      { verbs: 'registered' },
      { verbs: Array.from({ length: 61 }, () => 'v') },
      { missingSteps: 'completed' },
      { missingSteps: Array.from({ length: 13 }, () => 's') },
      { missingSteps: [42] },
      { httpStatus: 12345 },
    ]) {
      const res = await nelcPOST(
        postReq({ action: 'record_check', checkId: checkPrep.checkId, ok: true, httpStatus: 200, matched: 1, parityMatched: 1, verbs: [], missingSteps: [], ...bad }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_check_results');
    }

    // expired check
    await prisma.xapiPreparedRun.update({
      where: { runId: checkPrep.checkId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await nelcPOST(
          postReq({ action: 'record_check', checkId: checkPrep.checkId, ok: true, httpStatus: 200, matched: 1, parityMatched: 1, verbs: [], missingSteps: [] }),
        )
      ).status,
    ).toBe(410);
    // none of the rejections wrote audit rows
    expect(await prisma.xapiStatement.count()).toBe(0);
  });
});

describe('GET /svc/admin/nelc', () => {
  it('reports config status and returns the persisted log', async () => {
    const res = await nelcGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(false);
    expect(data.environment).toBe('staging');
    expect(data.defaultCourseIri).toBe('https://funademy.io/course/CR001');
    expect(Array.isArray(data.logs)).toBe(true);
  });
});
