import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { POST } from '@/app/(ar)/svc/admin/curriculum/lessons/[id]/exercises/route';

vi.mock('@/lib/auth', () => ({ isAdminRequest: vi.fn(async () => true) }));

const exercise = {
  promptAr: 'اختر الأحمر', promptEn: 'Choose red',
  options: ['أحمر'], optionsEn: ['Red'], correctAnswer: 'أحمر',
};
let subjectId: number;
let lessonId: number;

beforeAll(async () => {
  const subject = await prisma.lrnSubject.create({
    data: {
      nameAr: 'اختبار', nameEn: 'Import test', slug: `import-${crypto.randomUUID()}`,
      icon: 'test', color: '#000000',
      units: { create: {
        band: 'explorers', titleAr: 'وحدة', titleEn: 'Unit',
        lessons: { create: {
          titleAr: 'درس', titleEn: 'Lesson',
          exercises: { create: exercise },
        } },
      } },
    },
    include: { units: { include: { lessons: true } } },
  });
  subjectId = subject.id;
  lessonId = subject.units[0].lessons[0].id;
});

afterAll(async () => {
  if (subjectId) await prisma.lrnSubject.delete({ where: { id: subjectId } });
});

function send(body: unknown) {
  return POST(new NextRequest('http://test.local/svc/admin/curriculum/lessons/1/exercises', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: String(lessonId) }) });
}

const saved = () => prisma.lrnExercise.findMany({ where: { lessonId }, orderBy: { id: 'asc' } });

describe.each([true, false])('exercise imports with replace=%s', (replace) => {
  it.each([null, 'text', 42, true, false, []])('rejects malformed entry %j without writing', async (entry) => {
    const before = await saved();
    const response = await send({ replace, exercises: [exercise, entry, exercise] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid_exercises', imported: 0, skipped: 1,
      errors: ['Row 2: exercise must be a non-null object'],
    });
    expect(await saved()).toEqual(before);
  });
});

it.each([null, 'text', 42, [], {}])('rejects malformed body %j without writing', async (body) => {
  const before = await saved();
  const response = await send(body);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'exercises array required' });
  expect(await saved()).toEqual(before);
});

describe.each(['promptAr', 'promptEn', 'correctAnswer'])('invalid %s field', (field) => {
  it.each([null, [], {}, 42, true, '', '   '])('rejects %j without replacing saved exercises', async (value) => {
    const before = await saved();
    const response = await send({
      replace: true, exercises: [exercise, { ...exercise, [field]: value }],
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid_exercises', imported: 0, skipped: 1,
      errors: ['Row 2: promptAr, promptEn, correctAnswer must be non-empty strings'],
    });
    expect(await saved()).toEqual(before);
  });
});

it('still imports valid exercises', async () => {
  const before = await saved();
  const response = await send({ replace: true, exercises: [exercise, exercise] });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ imported: 2, skipped: 0, errors: [] });
  expect(await saved()).toHaveLength(2);
  expect((await saved()).some(row => before.some(old => old.id === row.id))).toBe(false);
});

it('rolls back replacement deletion when insertion fails in PostgreSQL', async () => {
  const before = await saved();
  expect(before.length).toBeGreaterThan(0);

  // Passes request validation, but PostgreSQL text cannot store a null byte.
  await expect(send({
    replace: true,
    exercises: [exercise, { ...exercise, promptEn: 'Invalid\u0000text' }],
  })).rejects.toThrow();

  expect(await saved()).toEqual(before);
});

it('keeps existing exercises when appending', async () => {
  const before = await saved();
  const response = await send({ exercises: [exercise] });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ imported: 1, skipped: 0, errors: [] });
  const after = await saved();
  expect(after).toHaveLength(before.length + 1);
  expect(after).toEqual(expect.arrayContaining(before));
});

it('allows an empty replacement to clear exercises', async () => {
  const response = await send({ replace: true, exercises: [] });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ imported: 0, skipped: 0, errors: [] });
  expect(await saved()).toEqual([]);
});
