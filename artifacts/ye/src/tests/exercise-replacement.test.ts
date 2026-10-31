import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { POST } from '@/app/(ar)/svc/admin/curriculum/lessons/[id]/exercises/route';

vi.mock('@/lib/auth', () => ({ isAdminRequest: async () => true }));

// Uses the isolated ye_test database configured by global-setup/setup-env.
describe('exercise replacement atomicity', () => {
  let subjectId: number;
  let lessonId: number;
  const exercise = {
    type: 'multiple_choice',
    promptAr: 'اختر الإجابة',
    promptEn: 'Choose an answer',
    options: ['أ', 'ب'],
    optionsEn: ['A', 'B'],
    correctAnswer: 'أ',
  };

  beforeAll(async () => {
    const subject = await prisma.lrnSubject.create({
      data: {
        slug: `replacement-${crypto.randomUUID()}`,
        nameAr: 'اختبار', nameEn: 'Test', icon: 'test', color: '#000000',
        units: { create: {
          band: 'explorers', titleAr: 'وحدة', titleEn: 'Unit',
          lessons: { create: { titleAr: 'درس', titleEn: 'Lesson' } },
        } },
      },
      include: { units: { include: { lessons: true } } },
    });
    subjectId = subject.id;
    lessonId = subject.units[0].lessons[0].id;
  });

  beforeEach(async () => {
    await prisma.lrnExercise.deleteMany({ where: { lessonId } });
    await prisma.lrnExercise.createMany({
      data: [0, 1].map(position => ({
        ...exercise, type: 'multiple_choice' as const, lessonId, position,
        promptEn: `Original ${position}`,
      })),
    });
  });

  afterAll(async () => {
    if (subjectId) await prisma.lrnSubject.delete({ where: { id: subjectId } });
  });

  const rows = () => prisma.lrnExercise.findMany({
    where: { lessonId }, orderBy: { position: 'asc' },
  });
  const save = (exercises: unknown[], replace = true) => POST(
    new NextRequest('http://localhost/svc/admin/curriculum/lessons/1/exercises', {
      method: 'POST',
      body: JSON.stringify({ exercises, replace }),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id: String(lessonId) }) },
  );

  it('rolls back deletion when PostgreSQL rejects the replacement insert', async () => {
    const original = await rows();
    // NUL passes route validation but PostgreSQL rejects it in a text column.
    // No DB mocks: this exercises a real createMany failure and rollback.
    await expect(save([exercise, { ...exercise, promptEn: 'Invalid\u0000text' }]))
      .rejects.toThrow();
    expect(await rows()).toEqual(original);
  });

  it('replaces existing rows and preserves the import response', async () => {
    const original = await rows();
    const response = await save([exercise]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ imported: 1, skipped: 0, errors: [] });
    const saved = await rows();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ ...exercise, lessonId, position: 0 });
    expect(original.map(row => row.id)).not.toContain(saved[0].id);
  });

  it('still allows an explicit empty replacement', async () => {
    expect((await save([])).status).toBe(200);
    expect(await rows()).toEqual([]);
  });

  it('retains existing rows when appending', async () => {
    const original = await rows();
    expect((await save([exercise], false)).status).toBe(200);
    const saved = await rows();
    expect(saved).toHaveLength(3);
    expect(saved).toEqual(expect.arrayContaining(original));
  });
});
