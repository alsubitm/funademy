import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  enrolled: vi.fn(), child: vi.fn(), lesson: vi.fn(), lessons: vi.fn(),
  subjects: vi.fn(), subject: vi.fn(), units: vi.fn(), completions: vi.fn(),
}));
vi.mock('@/lib/family-auth', () => ({ getFamilyId: async () => 1 }));
vi.mock('@/lib/kid-auth', () => ({
  getKidSession: async () => ({ familyId: 1, childId: 2 }),
  familyHasActiveEnrollment: mocks.enrolled,
}));
vi.mock('@/lib/learning', () => ({ serializeChild: (child: unknown) => child }));
vi.mock('@/lib/db', () => ({ prisma: {
  lrnChild: { findFirst: mocks.child },
  lrnLesson: { findFirst: mocks.lesson, findMany: mocks.lessons },
  lrnSubject: { findMany: mocks.subjects, findUnique: mocks.subject },
  lrnUnit: { findMany: mocks.units },
  lrnFirstCompletion: { findMany: mocks.completions },
} }));
import { requireLessonAccess } from '@/lib/lesson-guard';
import { GET as home } from '@/app/(ar)/svc/learn/home/route';
import { GET as units } from '@/app/(ar)/svc/learn/subjects/[slug]/units/route';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enrolled.mockResolvedValue(true);
  mocks.child.mockResolvedValue({ id: 2, familyId: 1, band: '6-8', dailyLimitMinutes: 10, firstCompletions: [] });
  mocks.lesson.mockResolvedValue({
    id: 3, durationMinutes: 5, unit: { band: '6-8', subjectId: 4, position: 1 }, exercises: [],
  });
  mocks.lessons.mockResolvedValue([]);
  mocks.subjects.mockResolvedValue([]);
  mocks.subject.mockResolvedValue({ id: 4 });
  mocks.units.mockResolvedValue([]);
  mocks.completions.mockResolvedValue([]);
});

describe('learning query concurrency', () => {
  it('starts the child lookup before enrollment returns and fans out dashboard reads', async () => {
    const enrollment = deferred<boolean>();
    const lessons = deferred<never[]>();
    mocks.enrolled.mockReturnValue(enrollment.promise);
    mocks.lessons.mockReturnValue(lessons.promise);
    const response = home();
    await vi.waitFor(() => expect(mocks.child).toHaveBeenCalled());
    enrollment.resolve(true);
    await vi.waitFor(() => {
      expect(mocks.lessons).toHaveBeenCalled();
      expect(mocks.subjects).toHaveBeenCalled();
      expect(mocks.completions).toHaveBeenCalled();
    });
    lessons.resolve([]);
    expect((await response).status).toBe(200);
  });

  it('reads prerequisites and usage concurrently without a separate already-completed query', async () => {
    const enrollment = deferred<boolean>();
    mocks.enrolled.mockReturnValue(enrollment.promise);
    const prior = deferred<never[]>();
    mocks.units.mockReturnValue(prior.promise);
    const result = requireLessonAccess(3);
    await vi.waitFor(() => {
      expect(mocks.child).toHaveBeenCalled();
      expect(mocks.lesson).toHaveBeenCalled();
    });
    enrollment.resolve(true);
    await vi.waitFor(() => expect(mocks.completions).toHaveBeenCalledTimes(2));
    prior.resolve([]);
    expect((await result).ok).toBe(true);
  });

  it('skips only daily usage reads when completion will check under lock', async () => {
    expect((await requireLessonAccess(3, { skipDailyLimit: true })).ok).toBe(true);
    expect(mocks.completions).toHaveBeenCalledExactlyOnceWith({
      where: { childId: 2 }, select: { lessonId: true },
    });
    mocks.units.mockResolvedValue([{ lessons: [{ id: 99 }] }]);
    const locked = await requireLessonAccess(3, { skipDailyLimit: true });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(await locked.response.json()).toEqual({ error: 'unit_locked' });
  });

  it('starts subject units and completion reads together', async () => {
    const completion = deferred<never[]>();
    mocks.completions.mockReturnValue(completion.promise);
    const response = units(new NextRequest('http://test.local/svc/learn/subjects/stem/units'), {
      params: Promise.resolve({ slug: 'stem' }),
    });
    await vi.waitFor(() => expect(mocks.units).toHaveBeenCalled());
    completion.resolve([]);
    expect((await response).status).toBe(200);
  });
});
