import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (key: string) => jar.has(key) ? { value: jar.get(key) } : undefined }),
}));
import { prisma } from '@/lib/db';
import { familyToken } from '@/lib/family-auth';
import { kidToken } from '@/lib/kid-auth';
import { GET as home } from '@/app/(ar)/svc/learn/home/route';
import { requireLessonAccess } from '@/lib/lesson-guard';

const prefix = `panel-home-${Date.now()}`;
let familyId: number, childId: number, programId: number, subjectId: number;
let firstId: number, laterId: number, enrollmentId: number;
beforeAll(async () => {
  const family = await prisma.family.create({ data: {
    phone: prefix, parentName: 'Synthetic parent',
    students: { create: { firstName: 'Same name', birthYear: 2018 } },
  }, include: { students: true } });
  familyId = family.id;
  const program = await prisma.program.create({ data: {
    slug: prefix, nameAr: prefix, nameEn: prefix, kitCode: 'TEST',
    ageMin: 4, ageMax: 14, format: 'online', color: '#6541b5', level: 1,
    taglineAr: '', taglineEn: '', descAr: '', descEn: '',
    buildsAr: [], buildsEn: [], termsAr: [], termsEn: [],
  } });
  programId = program.id;
  const course = await prisma.courseRun.create({ data: {
    programId, startDate: new Date(), endDate: new Date(), weekday: 0, time: '17:00', format: 'online',
  } });
  enrollmentId = (await prisma.enrollment.create({ data: {
    studentId: family.students[0].id, courseRunId: course.id, status: 'active',
  } })).id;
  childId = (await prisma.lrnChild.create({ data: {
    familyId, name: 'Same name', band: 'graduates', pin: 'test-only',
  } })).id;
  subjectId = (await prisma.lrnSubject.create({ data: {
    slug: prefix, nameAr: prefix, nameEn: prefix, icon: 'T', color: '#6541b5',
  } })).id;
  for (const position of [-10001, -10000]) {
    const unit = await prisma.lrnUnit.create({ data: {
      subjectId, band: 'graduates', titleAr: prefix, titleEn: prefix, position, status: 'published',
      lessons: { create: {
        titleAr: prefix, titleEn: prefix, status: 'published', position: 0, durationMinutes: 5,
      } },
    }, include: { lessons: true } });
    if (position === -10001) firstId = unit.lessons[0].id;
    else laterId = unit.lessons[0].id;
  }
});
beforeEach(async () => {
  jar.clear();
  jar.set('ye_family', familyToken(familyId));
  jar.set('ye_kid', kidToken(familyId, childId));
  await prisma.lrnCompletion.deleteMany({ where: { childId } });
  await prisma.lrnFirstCompletion.deleteMany({ where: { childId } });
  await prisma.lrnChild.update({ where: { id: childId }, data: { dailyLimitMinutes: null } });
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'active' } });
});
afterAll(async () => {
  if (subjectId) await prisma.lrnSubject.delete({ where: { id: subjectId } });
  if (familyId) await prisma.family.delete({ where: { id: familyId } });
  if (programId) await prisma.program.delete({ where: { id: programId } });
});

it('distinguishes family expiry, missing selection, and missing enrollment', async () => {
  jar.delete('ye_family');
  expect(await (await home()).json()).toEqual({ error: 'unauthorized' });
  jar.set('ye_family', familyToken(familyId));
  jar.delete('ye_kid');
  expect(await (await home()).json()).toEqual({ error: 'no_kid_selected' });
  jar.set('ye_kid', kidToken(familyId, childId));
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: 'paused' } });
  const response = await home();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'no_active_enrollment' });
});

it('does not treat an attempt as a prerequisite completion', async () => {
  await prisma.lrnCompletion.create({ data: {
    childId, lessonId: firstId, score: 0,
  } });
  const data = await (await home()).json();
  expect(data.continueLesson.lessonId).toBe(firstId);
  expect(data.subjects.find((s: { id: number }) => s.id === subjectId).progressPercent).toBe(0);
  expect((await requireLessonAccess(firstId)).ok).toBe(true);
  expect((await requireLessonAccess(laterId)).ok).toBe(false);
});

it('advances Continue after durable completion and agrees with lesson access', async () => {
  await prisma.lrnFirstCompletion.create({ data: { childId, lessonId: firstId } });
  const data = await (await home()).json();
  expect(data.continueLesson.lessonId).toBe(laterId);
  expect((await requireLessonAccess(data.continueLesson.lessonId)).ok).toBe(true);
  expect(data.subjects.find((s: { id: number }) => s.id === subjectId).progressPercent).toBe(50);
});

it('does not recommend a lesson beyond the server-owned daily allowance', async () => {
  await prisma.lrnChild.update({ where: { id: childId }, data: { dailyLimitMinutes: 0 } });
  const data = await (await home()).json();
  expect(data.continueLesson).toBeNull();
  expect(data.dailyLimitReached).toBe(true);
  expect((await requireLessonAccess(firstId)).ok).toBe(false);
});
