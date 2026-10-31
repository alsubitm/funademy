/**
 * Learning platform — authorization and progression tests.
 *
 * Covers:
 *   - No-kid-session access to lesson GET → 401
 *   - Cross-band lesson (child is explorers, lesson is builders) → 404
 *   - Draft-unit lesson → 404
 *   - Locked unit lesson (prior unit not fully completed) → 403
 *   - First completion: XP awarded
 *   - Repeated completion of same lesson: no additional XP
 *
 * Uses the ye_test DB and the same cookie-mock pattern as other tests.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// ── cookie store mock ──────────────────────────────────────────────────────
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => { cookieJar.delete(name); },
  }),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { FAMILY_COOKIE, familyToken } from '@/lib/family-auth';
import { KID_COOKIE, kidToken, hashPin } from '@/lib/kid-auth';
import { GET as lessonGET } from '@/app/(ar)/svc/learn/lessons/[id]/route';
import { GET as searchGET } from '@/app/(ar)/svc/learn/search/route';
import { GET as unitsGET } from '@/app/(ar)/svc/learn/subjects/[slug]/units/route';
import { POST as completePOST } from '@/app/(ar)/svc/learn/lessons/[id]/complete/route';
import { previousRiyadhDateKey, riyadhDateKey, riyadhDayStart } from '@/lib/riyadh-time';
import { explorerExercises, builderExercises } from '@/lib/seeded-learning-exercises';
import { hasEnglishOptions, optionLabel } from '@/lib/learning-options';
import { backfillEnglishLearningOptions } from '@/lib/backfill-learning-options';

describe('Asia/Riyadh learning day boundaries', () => {
  it('rolls the learning date over at Riyadh midnight, not UTC midnight', () => {
    expect(riyadhDateKey(new Date('2026-01-01T20:59:59.999Z'))).toBe('2026-01-01');
    expect(riyadhDateKey(new Date('2026-01-01T21:00:00.000Z'))).toBe('2026-01-02');
    expect(riyadhDayStart(new Date('2026-01-01T22:00:00.000Z')).toISOString())
      .toBe('2026-01-01T21:00:00.000Z');
    expect(previousRiyadhDateKey(new Date('2026-01-01T21:00:00.000Z'))).toBe('2026-01-01');
  });
});

// ── test-scoped unique suffix ──────────────────────────────────────────────
const RUN = `lrn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// ── IDs set up in beforeAll ───────────────────────────────────────────────
let familyId: number;
let childId: number;           // band: explorers
let enrollmentId: number;

let subjectId: number;
let unit1Id: number;           // position 0, explorers, published
let unit2Id: number;           // position 1, explorers, published (locked until unit1 done)
let draftUnitId: number;       // position 2, explorers, DRAFT
let buildersUnitId: number;    // explorers band: builders — wrong band for the child

let lesson1aId: number;        // unit1, lesson 0 — accessible
let lesson2aId: number;        // unit2, lesson 0 — locked (unit1 not yet complete)
let raceLessonId: number;      // fresh lesson used only for the single-lesson concurrent-race test
let raceSubjectId: number;     // isolated subject for the two-lesson concurrent-race test
let raceLesson2Id: number;     // first lesson in raceSubject's unit (two-lesson race)
let raceLesson3Id: number;     // second lesson in raceSubject's unit (two-lesson race)
let draftUnitLessonId: number; // draft unit
let buildersLessonId: number;  // builders band

function jsonReq(url: string, method = 'GET', body?: unknown): NextRequest {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function asFamily(id: number) {
  cookieJar.set(FAMILY_COOKIE, familyToken(id));
}
function asKid(fId: number, cId: number) {
  cookieJar.set(KID_COOKIE, kidToken(fId, cId));
}
function clearKid() { cookieJar.delete(KID_COOKIE); }
function clearAll() { cookieJar.clear(); }

function params(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}

// ── setup ──────────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Family with active enrollment
  const fam = await prisma.family.create({
    data: {
      phone: `+9665${RUN.slice(-8)}`,
      parentName: 'Test Parent',
      students: { create: { firstName: 'Hamad', birthYear: 2018 } },
    },
    include: { students: true },
  });
  familyId = fam.id;

  // Create a program + course run so we can make an active enrollment
  const program = await prisma.program.create({
    data: {
      slug: `lrn-prog-${RUN}`,
      kitCode: 'KIT-01', nameEn: 'LRN', nameAr: 'لرن', ageMin: 4, ageMax: 14,
      format: 'online', color: '#1C54CB', level: 1,
      taglineEn: 't', taglineAr: 'ت', descEn: 'd', descAr: 'د',
      buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
    },
  });
  const run = await prisma.courseRun.create({
    data: {
      programId: program.id,
      startDate: new Date('2026-08-01'), endDate: new Date('2026-12-31'),
      weekday: 0, time: '17:00', format: 'online',
    },
  });
  const enroll = await prisma.enrollment.create({
    data: { studentId: fam.students[0].id, courseRunId: run.id, status: 'active' },
  });
  enrollmentId = enroll.id;

  // Kid profile (band: explorers)
  const kid = await prisma.lrnChild.create({
    data: {
      familyId,
      name: 'Hamad',
      avatar: '⭐',
      band: 'explorers',
      pin: await hashPin('1234'),
    },
  });
  childId = kid.id;

  // Subject
  const subject = await prisma.lrnSubject.create({
    data: { nameAr: 'رياضيات', nameEn: 'Math', slug: `math-${RUN}`, icon: '🔢', color: '#1C54CB' },
  });
  subjectId = subject.id;

  // Unit 1 (position 0, explorers, published) — 2 lessons
  const unit1 = await prisma.lrnUnit.create({
    data: {
      subjectId, band: 'explorers', titleAr: 'الوحدة ١', titleEn: 'Unit 1',
      position: 0, status: 'published',
      lessons: {
        createMany: {
          data: [
            { titleAr: 'درس أ', titleEn: 'Lesson A', position: 0, status: 'published', durationMinutes: 5 },
            { titleAr: 'درس ب', titleEn: 'Lesson B', position: 1, status: 'published', durationMinutes: 5 },
          ],
        },
      },
    },
    include: { lessons: { orderBy: { position: 'asc' } } },
  });
  unit1Id = unit1.id;
  lesson1aId = unit1.lessons[0].id;

  // Unit 2 (position 1, explorers, published) — locked until unit1 done
  const unit2 = await prisma.lrnUnit.create({
    data: {
      subjectId, band: 'explorers', titleAr: 'الوحدة ٢', titleEn: 'Unit 2',
      position: 1, status: 'published',
      lessons: {
        create: { titleAr: 'درس ج', titleEn: 'Lesson C', position: 0, status: 'published', durationMinutes: 5 },
      },
    },
    include: { lessons: true },
  });
  unit2Id = unit2.id;
  lesson2aId = unit2.lessons[0].id;

  // Draft unit (position 2)
  const draftUnit = await prisma.lrnUnit.create({
    data: {
      subjectId, band: 'explorers', titleAr: 'مسودة', titleEn: 'Draft',
      position: 2, status: 'draft',
      lessons: {
        create: { titleAr: 'درس مسودة', titleEn: 'Draft Lesson', position: 0, status: 'published', durationMinutes: 5 },
      },
    },
    include: { lessons: true },
  });
  draftUnitId = draftUnit.id;
  draftUnitLessonId = draftUnit.lessons[0].id;

  // Extra lesson in unit2 for the single-lesson concurrent-race test.
  // Placed in unit2 (accessible after unit1 is complete), never claimed by
  // other suites → guaranteed first-completion for the race test.
  const raceLesson = await prisma.lrnLesson.create({
    data: {
      unitId: unit2Id,
      titleAr: 'درس السباق',
      titleEn: 'Race Lesson',
      position: 1,
      status: 'published',
      durationMinutes: 5,
    },
  });
  raceLessonId = raceLesson.id;

  // Isolated subject+unit with two lessons for the two-distinct-lessons concurrent test.
  // No other units exist in this subject so there are no prerequisite locks.
  const raceSubject = await prisma.lrnSubject.create({
    data: {
      nameAr: 'مادة السباق',
      nameEn: 'Race Subject',
      slug: `race-${RUN}`,
      icon: '🏁',
      color: '#6B7280',
      position: 99,
    },
  });
  raceSubjectId = raceSubject.id;

  const raceUnit = await prisma.lrnUnit.create({
    data: {
      subjectId: raceSubject.id,
      band: 'explorers',
      titleAr: 'وحدة السباق',
      titleEn: 'Race Unit',
      position: 0,
      status: 'published',
      lessons: {
        createMany: {
          data: [
            { titleAr: 'درس السباق ٢', titleEn: 'Race Lesson 2', position: 0, status: 'published', durationMinutes: 5 },
            { titleAr: 'درس السباق ٣', titleEn: 'Race Lesson 3', position: 1, status: 'published', durationMinutes: 5 },
          ],
        },
      },
    },
    include: { lessons: { orderBy: { position: 'asc' } } },
  });
  raceLesson2Id = raceUnit.lessons[0].id;
  raceLesson3Id = raceUnit.lessons[1].id;

  // Builders unit (wrong band for the child who is explorers)
  const buildersUnit = await prisma.lrnUnit.create({
    data: {
      subjectId, band: 'builders', titleAr: 'بناة', titleEn: 'Builders',
      position: 0, status: 'published',
      lessons: {
        create: { titleAr: 'درس بناة', titleEn: 'Builders Lesson', position: 0, status: 'published', durationMinutes: 5 },
      },
    },
    include: { lessons: true },
  });
  buildersUnitId = buildersUnit.id;
  buildersLessonId = buildersUnit.lessons[0].id;
});

afterAll(async () => {
  await prisma.lrnFirstCompletion.deleteMany({ where: { childId } });
  await prisma.lrnCompletion.deleteMany({ where: { childId } });
  await prisma.lrnChild.deleteMany({ where: { familyId } });
  await prisma.lrnUnit.deleteMany({ where: { subjectId } });
  await prisma.lrnSubject.deleteMany({ where: { id: subjectId } });
  // Clean up the isolated race subject (if created)
  if (raceSubjectId) await prisma.lrnSubject.deleteMany({ where: { id: raceSubjectId } });
  await prisma.enrollment.deleteMany({ where: { id: enrollmentId } });
  await prisma.family.deleteMany({ where: { id: familyId } });
  await prisma.program.deleteMany({ where: { slug: `lrn-prog-${RUN}` } });
});

describe('Learning discovery requires an owned selected child', () => {
  const endpoints = [
    ['search', () => searchGET(jsonReq('/svc/learn/search?q=Lesson'))],
    ['empty search', () => searchGET(jsonReq('/svc/learn/search?q=%20'))],
    ['subject units', () => unitsGET(jsonReq(`/svc/learn/subjects/math-${RUN}/units`),
      { params: Promise.resolve({ slug: `math-${RUN}` }) })],
  ] as const;

  describe.each(endpoints)('%s', (_name, request) => {
    it('rejects an absent family session', async () => {
      clearAll();
      asKid(familyId, childId);
      const response = await request();
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
    });

    it.each(['absent', 'expired', 'deleted', 'cross-family', 'foreign-child'] as const)(
      'rejects a %s child session', async (scenario) => {
        clearAll();
        asFamily(familyId);
        if (scenario === 'expired') {
          const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() - 25 * 60 * 60 * 1000);
          try { asKid(familyId, childId); } finally { clock.mockRestore(); }
        } else if (scenario === 'deleted') {
          const child = await prisma.lrnChild.create({
            data: { familyId, name: 'Deleted', pin: 'unused', band: 'builders' },
          });
          asKid(familyId, child.id);
          await prisma.lrnChild.delete({ where: { id: child.id } });
        } else if (scenario === 'cross-family' || scenario === 'foreign-child') {
          const other = await prisma.family.create({ data: { phone: `${RUN}-${scenario}`, parentName: 'Other parent' } });
          try {
            if (scenario === 'cross-family') {
              asKid(other.id, childId);
            } else {
              const child = await prisma.lrnChild.create({
                data: { familyId: other.id, name: 'Other', pin: 'unused', band: 'builders' },
              });
              asKid(familyId, child.id);
            }
            const response = await request();
            expect(response.status).toBe(401);
            expect(await response.json()).toEqual({ error: 'no_kid_selected' });
          } finally {
            await prisma.family.delete({ where: { id: other.id } });
          }
          return;
        }
        const response = await request();
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'no_kid_selected' });
      },
    );
  });

  it.each(['explorers', 'builders', 'achievers', 'graduates'] as const)(
    'uses the selected %s child’s band for search and units', async (band) => {
      const child = await prisma.lrnChild.create({
        data: { familyId, name: 'Selected', pin: 'unused', band },
      });
      const marker = `Discovery-${RUN}`;
      const units = await Promise.all(
        (['explorers', 'builders', 'achievers', 'graduates'] as const).map((unitBand) =>
          prisma.lrnUnit.create({
            data: {
              subjectId, band: unitBand, titleAr: marker, titleEn: marker, position: 10, status: 'published',
              lessons: { create: [
                { titleAr: marker, titleEn: marker, status: 'published' },
                { titleAr: marker, titleEn: marker, status: 'draft' },
              ] },
            },
            include: { lessons: true },
          }),
        ),
      );
      try {
        clearAll();
        asFamily(familyId);
        asKid(familyId, child.id);
        const ownUnit = units.find(u => u.band === band)!;
        const ownLesson = ownUnit.lessons.find(l => l.status === 'published')!;
        const search = await searchGET(jsonReq(`/svc/learn/search?q=${marker}&band=builders`));
        expect(search.status).toBe(200);
        expect((await search.json()).map((l: { id: number }) => l.id)).toEqual([ownLesson.id]);
        const response = await unitsGET(jsonReq('/svc/learn/subjects/ignored/units?band=builders'),
          { params: Promise.resolve({ slug: `math-${RUN}` }) });
        expect(response.status).toBe(200);
        const body = await response.json();
        const expected = await prisma.lrnUnit.findMany({ where: { subjectId, band, status: 'published' } });
        expect(body.units.map((u: { id: number }) => u.id).sort()).toEqual(expected.map(u => u.id).sort());
        expect(body.units.find((u: { id: number }) => u.id === ownUnit.id).lessons.map((l: { id: number }) => l.id))
          .toEqual([ownLesson.id]);
        const empty = await searchGET(jsonReq('/svc/learn/search'));
        expect(empty.status).toBe(200);
        expect(await empty.json()).toEqual([]);
      } finally {
        await prisma.lrnUnit.deleteMany({ where: { id: { in: units.map(u => u.id) } } });
        await prisma.lrnChild.delete({ where: { id: child.id } });
      }
    },
  );
});

// ── Lesson GET auth / access tests ─────────────────────────────────────────
describe('GET /svc/learn/lessons/:id — authorization', () => {
  it.each([
    ['new explorer', () => explorerExercises(0), false],
    ['existing explorer', () => explorerExercises(0), true],
    ['new builder', builderExercises, false],
    ['existing builder', builderExercises, true],
  ] as const)('opens and completes %s starter exercises in English', async (_name, factory, legacy) => {
    const seeded = factory();
    const child = await prisma.lrnChild.create({
      data: { familyId, name: 'English learner', pin: await hashPin('1234'), band: 'explorers' },
    });
    const lesson = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'درس أولي', titleEn: 'Starter lesson',
        durationMinutes: 1, position: 99,
        exercises: { create: seeded.map(e => ({ ...e, optionsEn: legacy ? [] : e.optionsEn ?? [] })) } },
    });
    try {
      clearAll(); asFamily(familyId); asKid(familyId, child.id);
      const response = await lessonGET(jsonReq(`/svc/learn/lessons/${lesson.id}`), params(lesson.id));
      expect(response.status).toBe(200);
      const body = await response.json();
      const answers = body.exercises.map((exercise: { id: number; options: string[]; optionsEn: string[]; promptEn: string }, index: number) => {
        expect(exercise.promptEn.trim()).not.toBe('');
        expect(hasEnglishOptions(exercise.options, exercise.optionsEn)).toBe(true);
        const correctIndex = exercise.options.indexOf(seeded[index].correctAnswer);
        const displayedLabel = optionLabel(exercise.options, exercise.optionsEn, correctIndex, true);
        expect(displayedLabel).not.toMatch(/[\u0600-\u06ff]/);
        return { exerciseId: exercise.id, answer: exercise.options[correctIndex] };
      });
      // The translated word exercise remains keyed by its canonical Arabic answer.
      expect(body.exercises[3].optionsEn).toEqual(seeded[3].optionsEn);
      expect(await backfillEnglishLearningOptions(prisma, lesson.id)).toBe(0);
      const completed = await completePOST(jsonReq(`/svc/learn/lessons/${lesson.id}/complete`, 'POST', { answers, timeSpentSeconds: 60 }), params(lesson.id));
      expect(completed.status).toBe(200);
      const reward = await completed.json();
      expect(reward.score).toBe(100);
      expect(reward.xpEarned).toBeGreaterThan(0);
      const repeat = await completePOST(jsonReq(`/svc/learn/lessons/${lesson.id}/complete`, 'POST', { answers, timeSpentSeconds: 60 }), params(lesson.id));
      expect((await repeat.json()).xpEarned).toBe(0);
      const stored = await prisma.lrnExercise.findMany({ where: { lessonId: lesson.id }, orderBy: { position: 'asc' } });
      expect(stored.map(e => e.correctAnswer)).toEqual(seeded.map(e => e.correctAnswer));
    } finally {
      await prisma.lrnLesson.delete({ where: { id: lesson.id } });
      await prisma.lrnChild.delete({ where: { id: child.id } });
    }
  });
  it('returns bilingual display labels without exposing the answer key', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);
    const exercise = await prisma.lrnExercise.create({
      data: { lessonId: lesson1aId, promptAr: 'اختر الأزرق', promptEn: 'Choose blue',
        options: ['أحمر', 'أزرق'], optionsEn: ['Red', 'Blue'], correctAnswer: 'أزرق' },
    });
    try {
      const response = await lessonGET(jsonReq(`/svc/learn/lessons/${lesson1aId}`), params(lesson1aId));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.titleEn).toBe('Lesson A');
      expect(body.subjectNameEn).toBe('Math');
      expect(body.exercises[0]).toMatchObject({ promptEn: 'Choose blue', optionsEn: ['Red', 'Blue'] });
      expect(body.exercises[0]).not.toHaveProperty('correctAnswer');
    } finally {
      await prisma.lrnExercise.delete({ where: { id: exercise.id } });
    }
  });
  it('returns 401 when no session at all', async () => {
    clearAll();
    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${lesson1aId}`), params(lesson1aId));
    expect(res.status).toBe(401);
  });

  it('returns 401 when family session exists but no kid session', async () => {
    clearAll();
    asFamily(familyId);
    // No kid cookie set
    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${lesson1aId}`), params(lesson1aId));
    expect(res.status).toBe(401);
  });

  it('returns 404 for a lesson in a different band (builders) than the child (explorers)', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);
    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${buildersLessonId}`), params(buildersLessonId));
    expect(res.status).toBe(404);
  });

  it('returns 404 for a lesson whose unit is draft', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);
    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${draftUnitLessonId}`), params(draftUnitLessonId));
    expect(res.status).toBe(404);
  });

  it('returns 403 for a lesson in a locked unit (prior unit not completed)', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);
    // No completions yet — unit 2 is locked
    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${lesson2aId}`), params(lesson2aId));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('unit_locked');
  });

  it('returns 200 for an accessible first-unit lesson', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);
    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${lesson1aId}`), params(lesson1aId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(lesson1aId);
    expect(body.completed).toBe(false);
  });
});

// ── Completion POST — rewards idempotency ──────────────────────────────────
describe('POST /svc/learn/lessons/:id/complete — XP idempotency', () => {
  const completeReq = (id: number) =>
    jsonReq(`/svc/learn/lessons/${id}/complete`, 'POST', { answers: [], timeSpentSeconds: 120 });

  it('awards XP on first completion', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    const childBefore = await prisma.lrnChild.findUnique({ where: { id: childId } });
    const xpBefore = childBefore!.xp;

    const res = await completePOST(completeReq(lesson1aId), params(lesson1aId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.repeated).toBe(false);
    expect(body.xpEarned).toBe(50);
    expect(body.totalXp).toBe(xpBefore + 50);
  });

  it('does NOT award XP on a repeated completion of the same lesson', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    const childBefore = await prisma.lrnChild.findUnique({ where: { id: childId } });
    const xpBefore = childBefore!.xp;

    // Lesson1a was already completed above — this is a repeat
    const res = await completePOST(completeReq(lesson1aId), params(lesson1aId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.repeated).toBe(true);
    expect(body.xpEarned).toBe(0);
    expect(body.totalXp).toBe(xpBefore); // unchanged

    // Confirm DB XP hasn't changed either
    const childAfter = await prisma.lrnChild.findUnique({ where: { id: childId } });
    expect(childAfter!.xp).toBe(xpBefore);
  });

  it('returns 403 for a locked lesson (unit 2) even if authenticated', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);
    // unit1 lesson B is NOT yet completed, so unit2 is still locked
    const res = await completePOST(completeReq(lesson2aId), params(lesson2aId));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('unit_locked');
  });

  it('unlocks unit 2 once all unit 1 lessons are completed', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    // Complete unit1 lesson B (lesson1a was done above)
    const unit1Lessons = await prisma.lrnLesson.findMany({
      where: { unitId: unit1Id },
      orderBy: { position: 'asc' },
    });
    const lesson1bId = unit1Lessons[1].id;
    const r1 = await completePOST(completeReq(lesson1bId), params(lesson1bId));
    expect(r1.status).toBe(200);

    // Now unit 2 should be unlocked
    const res = await completePOST(completeReq(lesson2aId), params(lesson2aId));
    expect(res.status).toBe(200);
    expect((await res.json()).repeated).toBe(false);
  });
});

// ── Concurrent completion — atomic first-completion claim ──────────────────
describe('POST /svc/learn/lessons/:id/complete — concurrent idempotency', () => {
  it('awards XP exactly once when two requests race on the same lesson', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    // raceLessonId is a fresh lesson in unit1 that was never completed before
    const childBefore = await prisma.lrnChild.findUnique({ where: { id: childId } });
    const xpBefore = childBefore!.xp;

    // Fire three concurrent requests for the same fresh lesson
    const makeReq = () =>
      new NextRequest(`http://test.local/svc/learn/lessons/${raceLessonId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [], timeSpentSeconds: 10 }),
      });

    const [r1, r2, r3] = await Promise.all([
      completePOST(makeReq(), params(raceLessonId)),
      completePOST(makeReq(), params(raceLessonId)),
      completePOST(makeReq(), params(raceLessonId)),
    ]);

    const bodies = await Promise.all([r1.json(), r2.json(), r3.json()]);
    const notRepeated = bodies.filter((b) => !b.repeated);
    const repeated = bodies.filter((b) => b.repeated);

    // Exactly one response should report first completion
    expect(notRepeated).toHaveLength(1);
    expect(repeated).toHaveLength(2);
    expect(notRepeated[0].xpEarned).toBe(50);
    repeated.forEach((b) => expect(b.xpEarned).toBe(0));

    // DB XP should have increased by exactly 50 (one award)
    const childAfter = await prisma.lrnChild.findUnique({ where: { id: childId } });
    expect(childAfter!.xp).toBe(xpBefore + 50);

    // Exactly one first-completion row in the DB
    const claimCount = await prisma.lrnFirstCompletion.count({
      where: { childId, lessonId: raceLessonId },
    });
    expect(claimCount).toBe(1);
  });
});

// ── Two-distinct-lessons concurrent race ───────────────────────────────────
describe('POST /svc/learn/lessons/:id/complete — two distinct lessons concurrent', () => {
  it('awards XP for both lessons without losing updates when requests race', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    const childBefore = await prisma.lrnChild.findUnique({ where: { id: childId } });
    const xpBefore = childBefore!.xp;

    // raceLesson2Id and raceLesson3Id are both in unit1 (always unlocked),
    // never completed — fire them concurrently.
    const makeReq = (id: number) =>
      new NextRequest(`http://test.local/svc/learn/lessons/${id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [], timeSpentSeconds: 15 }),
      });

    const [r2, r3] = await Promise.all([
      completePOST(makeReq(raceLesson2Id), params(raceLesson2Id)),
      completePOST(makeReq(raceLesson3Id), params(raceLesson3Id)),
    ]);

    const b2 = await r2.json();
    const b3 = await r3.json();

    // Both should be first completions (different lessons)
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(b2.repeated).toBe(false);
    expect(b3.repeated).toBe(false);
    expect(b2.xpEarned).toBe(50);
    expect(b3.xpEarned).toBe(50);

    // Total XP in DB must reflect both awards (no lost-update)
    const childAfter = await prisma.lrnChild.findUnique({ where: { id: childId } });
    expect(childAfter!.xp).toBe(xpBefore + 100);

    // Two distinct first-completion rows
    const claims = await prisma.lrnFirstCompletion.count({
      where: { childId, lessonId: { in: [raceLesson2Id, raceLesson3Id] } },
    });
    expect(claims).toBe(2);
  });
});

// ── Daily time limit enforcement ───────────────────────────────────────────
describe('daily time limit — server-side enforcement', () => {
  // Use a fresh child with a tight daily limit so other tests don't interfere.
  let limitedChildId: number;
  let limitedLessonAId: number;
  let limitedLessonBId: number;

  beforeAll(async () => {
    // Child with a 5-minute daily limit (= one 5-min lesson exactly)
    // First lesson: 0+5=5 ≤ 5 → ALLOW; second: 5+5=10 > 5 → DENY
    const kid = await prisma.lrnChild.create({
      data: {
        familyId,
        name: 'Limited',
        avatar: '⏱️',
        band: 'explorers',
        pin: await hashPin('5678'),
        dailyLimitMinutes: 5,
      },
    });
    limitedChildId = kid.id;

    // Two short lessons in unit1 (always unlocked for explorers)
    const la = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'ح١', titleEn: 'Limit A', position: 20, status: 'published', durationMinutes: 5 },
    });
    limitedLessonAId = la.id;

    const lb = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'ح٢', titleEn: 'Limit B', position: 21, status: 'published', durationMinutes: 5 },
    });
    limitedLessonBId = lb.id;
  });

  afterAll(async () => {
    await prisma.lrnFirstCompletion.deleteMany({ where: { childId: limitedChildId } });
    await prisma.lrnCompletion.deleteMany({ where: { childId: limitedChildId } });
    await prisma.lrnChild.deleteMany({ where: { id: limitedChildId } });
  });

  it('allows lesson access when no completions today', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, limitedChildId);
    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${limitedLessonAId}`), params(limitedLessonAId));
    expect(res.status).toBe(200);
  });

  it('denies lesson access after daily limit is exceeded', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, limitedChildId);

    // Complete lesson A (5 minutes) — exceeds the 1-minute limit
    const completeReq = (id: number) =>
      new NextRequest(`http://test.local/svc/learn/lessons/${id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [], timeSpentSeconds: 300 }),
      });
    const r = await completePOST(completeReq(limitedLessonAId), params(limitedLessonAId));
    expect(r.status).toBe(200);

    // Now trying to access lesson B should be denied (server-computed 5 min ≥ 1 min limit)
    const denyGET = await lessonGET(jsonReq(`/svc/learn/lessons/${limitedLessonBId}`), params(limitedLessonBId));
    expect(denyGET.status).toBe(403);
    expect((await denyGET.json()).error).toBe('daily_limit_reached');

    // Completion also denied
    const denyPOST = await completePOST(completeReq(limitedLessonBId), params(limitedLessonBId));
    expect(denyPOST.status).toBe(403);
    expect((await denyPOST.json()).error).toBe('daily_limit_reached');

    // Retrying/replaying the already completed lesson remains idempotent:
    // it succeeds as a repeat and does not consume a second daily-use slot.
    const repeat = await completePOST(completeReq(limitedLessonAId), params(limitedLessonAId));
    expect(repeat.status).toBe(200);
    expect((await repeat.json()).repeated).toBe(true);
    const dailyClaims = await prisma.lrnFirstCompletion.count({
      where: { childId: limitedChildId, lessonId: limitedLessonAId },
    });
    expect(dailyClaims).toBe(1);
  });

  it('concurrent completions cannot together exceed the daily limit', async () => {
    // Fresh child with a 5-minute daily limit (= one lesson's durationMinutes)
    // so completing a second lesson concurrently should be blocked after the
    // first one commits inside the locked transaction.
    const limitedKid = await prisma.lrnChild.create({
      data: {
        familyId,
        name: 'ConcurrentLimit',
        avatar: '⏱️',
        band: 'explorers',
        pin: await hashPin('0000'),
        dailyLimitMinutes: 5, // exactly one 5-min lesson
      },
    });

    // Two 5-minute lessons in unit1 (immediately accessible, no prerequisites)
    const concLa = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'سباق أ', titleEn: 'ConcA', position: 30, status: 'published', durationMinutes: 5 },
    });
    const concLb = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'سباق ب', titleEn: 'ConcB', position: 31, status: 'published', durationMinutes: 5 },
    });

    clearAll();
    asFamily(familyId);
    asKid(familyId, limitedKid.id);

    const makeReq = (id: number) =>
      new NextRequest(`http://test.local/svc/learn/lessons/${id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [], timeSpentSeconds: 300 }),
      });

    // Fire both completions concurrently
    const [ra, rb] = await Promise.all([
      completePOST(makeReq(concLa.id), params(concLa.id)),
      completePOST(makeReq(concLb.id), params(concLb.id)),
    ]);

    const statuses = [ra.status, rb.status].sort();
    // Exactly one must succeed (200) and one must be denied (403)
    expect(statuses).toEqual([200, 403]);
    const winner = ra.status === 200 ? ra : rb;
    const loser = ra.status === 403 ? ra : rb;
    expect((await winner.json()).xpEarned).toBe(50);
    expect((await loser.json()).error).toBe('daily_limit_reached');

    // Total consumed time in DB must not exceed the limit
    const completions = await prisma.lrnCompletion.findMany({
      where: { childId: limitedKid.id },
      include: { lesson: { select: { durationMinutes: true } } },
    });
    const totalMinutes = completions.reduce((s, c) => s + c.lesson.durationMinutes, 0);
    expect(totalMinutes).toBeLessThanOrEqual(5);

    // Cleanup
    await prisma.lrnFirstCompletion.deleteMany({ where: { childId: limitedKid.id } });
    await prisma.lrnCompletion.deleteMany({ where: { childId: limitedKid.id } });
    await prisma.lrnChild.deleteMany({ where: { id: limitedKid.id } });
  });

  it('non-divisible limit: 8-min limit with 5-min lessons — first allowed, second denied', async () => {
    // A child with an 8-min daily limit and 5-min lessons:
    // - First lesson: consumed=0, 0+5=5 ≤ 8 → ALLOW
    // - Second lesson: consumed=5, 5+5=10 > 8 → DENY
    const kid = await prisma.lrnChild.create({
      data: { familyId, name: 'NonDivisible', avatar: '🧮', band: 'explorers', pin: await hashPin('1111'), dailyLimitMinutes: 8 },
    });

    const la = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'غير قابل أ', titleEn: 'ND A', position: 40, status: 'published', durationMinutes: 5 },
    });
    const lb = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'غير قابل ب', titleEn: 'ND B', position: 41, status: 'published', durationMinutes: 5 },
    });

    clearAll();
    asFamily(familyId);
    asKid(familyId, kid.id);

    const makeReq = (id: number) =>
      new NextRequest(`http://test.local/svc/learn/lessons/${id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [], timeSpentSeconds: 300 }),
      });

    // First lesson succeeds (0+5=5 ≤ 8)
    const r1 = await completePOST(makeReq(la.id), params(la.id));
    expect(r1.status).toBe(200);

    // Second lesson denied (5+5=10 > 8)
    const r2 = await completePOST(makeReq(lb.id), params(lb.id));
    expect(r2.status).toBe(403);
    expect((await r2.json()).error).toBe('daily_limit_reached');

    // GET is also denied for the second lesson
    const getRes = await lessonGET(jsonReq(`/svc/learn/lessons/${lb.id}`), params(lb.id));
    expect(getRes.status).toBe(403);

    // Cleanup
    await prisma.lrnFirstCompletion.deleteMany({ where: { childId: kid.id } });
    await prisma.lrnCompletion.deleteMany({ where: { childId: kid.id } });
    await prisma.lrnChild.deleteMany({ where: { id: kid.id } });
  });

  it('non-divisible concurrent: 8-min limit with two concurrent 5-min lessons — only one succeeds', async () => {
    const kid = await prisma.lrnChild.create({
      data: { familyId, name: 'ConcND', avatar: '⚡', band: 'explorers', pin: await hashPin('2222'), dailyLimitMinutes: 8 },
    });

    const la = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'متزامن أ', titleEn: 'CNC A', position: 42, status: 'published', durationMinutes: 5 },
    });
    const lb = await prisma.lrnLesson.create({
      data: { unitId: unit1Id, titleAr: 'متزامن ب', titleEn: 'CNC B', position: 43, status: 'published', durationMinutes: 5 },
    });

    clearAll();
    asFamily(familyId);
    asKid(familyId, kid.id);

    const makeReq = (id: number) =>
      new NextRequest(`http://test.local/svc/learn/lessons/${id}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [], timeSpentSeconds: 300 }),
      });

    // Fire both concurrently
    const [ra, rb] = await Promise.all([
      completePOST(makeReq(la.id), params(la.id)),
      completePOST(makeReq(lb.id), params(lb.id)),
    ]);

    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual([200, 403]);

    const loser = ra.status === 403 ? ra : rb;
    expect((await loser.json()).error).toBe('daily_limit_reached');

    // Only one completion in DB (from the winner)
    const comps = await prisma.lrnCompletion.findMany({
      where: { childId: kid.id },
      include: { lesson: { select: { durationMinutes: true } } },
    });
    const totalConsumed = comps.reduce((s, c) => s + c.lesson.durationMinutes, 0);
    expect(totalConsumed).toBeLessThanOrEqual(8);

    // Cleanup
    await prisma.lrnFirstCompletion.deleteMany({ where: { childId: kid.id } });
    await prisma.lrnCompletion.deleteMany({ where: { childId: kid.id } });
    await prisma.lrnChild.deleteMany({ where: { id: kid.id } });
  });
});

// ── Repeat-only completion does not satisfy prerequisites ──────────────────
describe('prerequisite gate uses LrnFirstCompletion, not repeat LrnCompletion', () => {
  // Fresh child with no completions; fresh subject with 2 units to test locking.
  let freshChildId: number;
  let freshSubjectId: number;
  let freshUnit1Id: number;
  let freshUnit2LessonId: number;
  let freshUnit1LessonId: number;

  beforeAll(async () => {
    const kid = await prisma.lrnChild.create({
      data: { familyId, name: 'Fresh', avatar: '🆕', band: 'explorers', pin: await hashPin('9999') },
    });
    freshChildId = kid.id;

    const subj = await prisma.lrnSubject.create({
      data: { nameAr: 'اختبار', nameEn: 'PrereqTest', slug: `prereq-${RUN}`, icon: '🔒', color: '#000', position: 98 },
    });
    freshSubjectId = subj.id;

    // Unit 0 with one lesson
    const u1 = await prisma.lrnUnit.create({
      data: {
        subjectId: subj.id, band: 'explorers', titleAr: 'و١', titleEn: 'U1', position: 0, status: 'published',
        lessons: { create: { titleAr: 'د١', titleEn: 'L1', position: 0, status: 'published', durationMinutes: 5 } },
      },
      include: { lessons: true },
    });
    freshUnit1Id = u1.id;
    freshUnit1LessonId = u1.lessons[0].id;

    // Unit 1 with one lesson (locked until u1 is first-completed)
    const u2 = await prisma.lrnUnit.create({
      data: {
        subjectId: subj.id, band: 'explorers', titleAr: 'و٢', titleEn: 'U2', position: 1, status: 'published',
        lessons: { create: { titleAr: 'د٢', titleEn: 'L2', position: 0, status: 'published', durationMinutes: 5 } },
      },
      include: { lessons: true },
    });
    freshUnit2LessonId = u2.lessons[0].id;
  });

  afterAll(async () => {
    await prisma.lrnFirstCompletion.deleteMany({ where: { childId: freshChildId } });
    await prisma.lrnCompletion.deleteMany({ where: { childId: freshChildId } });
    await prisma.lrnChild.deleteMany({ where: { id: freshChildId } });
    await prisma.lrnSubject.deleteMany({ where: { id: freshSubjectId } });
  });

  it('unit2 is locked when unit1 lesson has only a LrnCompletion (no LrnFirstCompletion)', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, freshChildId);

    // Manually insert a LrnCompletion WITHOUT a LrnFirstCompletion — simulates
    // a repeat attempt where first-completion was never actually awarded.
    await prisma.lrnCompletion.create({
      data: { childId: freshChildId, lessonId: freshUnit1LessonId, score: 0, timeSpentSeconds: 0 },
    });

    // Unit2 must still be locked because there is no LrnFirstCompletion for U1 L1
    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${freshUnit2LessonId}`), params(freshUnit2LessonId));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('unit_locked');
  });

  it('unit2 unlocks once unit1 lesson has a LrnFirstCompletion', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, freshChildId);

    // Add a LrnFirstCompletion for U1 L1
    await prisma.lrnFirstCompletion.create({
      data: { childId: freshChildId, lessonId: freshUnit1LessonId },
    });

    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${freshUnit2LessonId}`), params(freshUnit2LessonId));
    expect(res.status).toBe(200);
  });
});

// ── Answer-key confidentiality and server-side grading ─────────────────────
describe('GET /svc/learn/lessons/:id — no answer keys in response', () => {
  it('lesson GET response never includes correctAnswer on any exercise', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${lesson1aId}`), params(lesson1aId));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Exercises exist and MUST NOT include correctAnswer
    expect(Array.isArray(body.exercises)).toBe(true);
    for (const ex of body.exercises) {
      expect(ex).not.toHaveProperty('correctAnswer');
      // Required fields are present
      expect(ex).toHaveProperty('id');
      expect(ex).toHaveProperty('type');
      expect(ex).toHaveProperty('promptAr');
      expect(ex).toHaveProperty('options');
    }
  });
});

describe('POST /svc/learn/lessons/:id/complete — server-side grading and perAnswer', () => {
  // Use a lesson that has exercises with known correct answers for grading tests.
  // Create a dedicated lesson with one MCQ exercise.
  let gradeLessonId: number;
  let gradeExerciseId: number;
  const CORRECT_ANSWER = '42';
  const WRONG_ANSWER = '7';

  beforeAll(async () => {
    // Lesson in unit1 (always accessible for our main child)
    const gl = await prisma.lrnLesson.create({
      data: {
        unitId: unit1Id,
        titleAr: 'درس التصحيح',
        titleEn: 'Grade Lesson',
        position: 50,
        status: 'published',
        durationMinutes: 5,
      },
    });
    gradeLessonId = gl.id;

    const ex = await prisma.lrnExercise.create({
      data: {
        lessonId: gradeLessonId,
        type: 'multiple_choice',
        promptAr: 'كم؟',
        promptEn: 'How many?',
        options: ['7', '42', '100'],
        correctAnswer: CORRECT_ANSWER,
        position: 0,
      },
    });
    gradeExerciseId = ex.id;
  });

  afterAll(async () => {
    await prisma.lrnFirstCompletion.deleteMany({ where: { childId, lessonId: gradeLessonId } });
    await prisma.lrnCompletion.deleteMany({ where: { childId, lessonId: gradeLessonId } });
  });

  async function submitAnswers(answers: Array<{ exerciseId: number; answer: string }>) {
    return completePOST(
      new NextRequest(`http://test.local/svc/learn/lessons/${gradeLessonId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers, timeSpentSeconds: 10 }),
      }),
      params(gradeLessonId),
    );
  }

  it('rejects missing exercise answers without recording completion', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);
    const before = await prisma.lrnCompletion.count({ where: { childId, lessonId: gradeLessonId } });
    const res = await submitAnswers([]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('missing_exercise_answer');
    expect(await prisma.lrnCompletion.count({ where: { childId, lessonId: gradeLessonId } })).toBe(before);
  });

  it('rejects unknown and duplicate exercise IDs', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    const unknown = await submitAnswers([{ exerciseId: gradeExerciseId + 999_999, answer: CORRECT_ANSWER }]);
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toBe('unknown_exercise_answer');

    const duplicate = await submitAnswers([
      { exerciseId: gradeExerciseId, answer: CORRECT_ANSWER },
      { exerciseId: gradeExerciseId, answer: WRONG_ANSWER },
    ]);
    expect(duplicate.status).toBe(400);
    expect((await duplicate.json()).error).toBe('duplicate_exercise_answer');
  });

  it('returns perAnswer with correct=true when child answers correctly', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    const res = await completePOST(
      new NextRequest(`http://test.local/svc/learn/lessons/${gradeLessonId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [{ exerciseId: gradeExerciseId, answer: CORRECT_ANSWER }], timeSpentSeconds: 60 }),
      }),
      params(gradeLessonId),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('perAnswer');
    expect(body.perAnswer).toHaveLength(1);
    expect(body.perAnswer[0].exerciseId).toBe(gradeExerciseId);
    expect(body.perAnswer[0].correct).toBe(true);
    expect(body.score).toBe(100);
  });

  it('returns perAnswer with correct=false and score 0 when child answers wrong', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    // Repeat attempt (first-completion already claimed above) — still returns grading
    const res = await completePOST(
      new NextRequest(`http://test.local/svc/learn/lessons/${gradeLessonId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: [{ exerciseId: gradeExerciseId, answer: WRONG_ANSWER }], timeSpentSeconds: 30 }),
      }),
      params(gradeLessonId),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.repeated).toBe(true);
    expect(body.perAnswer).toHaveLength(1);
    expect(body.perAnswer[0].exerciseId).toBe(gradeExerciseId);
    expect(body.perAnswer[0].correct).toBe(false);
    expect(body.score).toBe(0);
    // XP should NOT change on repeat
    expect(body.xpEarned).toBe(0);
  });

  it('correct answers submitted by client are never reflected back in GET (no answer-key leak)', async () => {
    clearAll();
    asFamily(familyId);
    asKid(familyId, childId);

    const res = await lessonGET(jsonReq(`/svc/learn/lessons/${gradeLessonId}`), params(gradeLessonId));
    expect(res.status).toBe(200);
    const body = await res.json();

    // The correctAnswer FIELD must not appear in any exercise object.
    // Note: the answer value itself ('42') may legitimately appear in the
    // options array — that is expected. Only the field name is forbidden.
    for (const ex of body.exercises) {
      expect(ex).not.toHaveProperty('correctAnswer');
    }
    // Double-check: the serialized JSON must not contain the key "correctAnswer"
    const rawJson = JSON.stringify(body);
    expect(rawJson).not.toContain('"correctAnswer"');
  });
});
