import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { testDbUrl } from '../src/tests/test-db';

const db = new PrismaClient({ datasourceUrl: testDbUrl() });
const run = `live-retry-${randomUUID()}`;
let instructorId: number;
let roomId: string;

function instructorToken(id: number) {
  const payload = `${id}.1.${Date.now() + 3_600_000}`;
  const signature = createHmac('sha256', 'browser-regression-only-secret')
    .update(`instructor:${payload}`)
    .digest('hex');
  return `${payload}.${signature}`;
}

test.beforeAll(async () => {
  const instructor = await db.instructor.create({
    data: { name: run, email: `${run}@example.invalid`, passwordHash: 'unused' },
  });
  instructorId = instructor.id;
  const room = await db.liveLabRoom.create({
    data: {
      instructorId,
      title: run,
      startsAt: new Date(Date.now() + 3_600_000),
      durationMin: 60,
    },
  });
  roomId = room.id;
});

test.afterAll(async () => {
  if (roomId) await db.liveLabRoom.deleteMany({ where: { id: roomId } });
  if (instructorId) await db.instructor.deleteMany({ where: { id: instructorId } });
  await db.$disconnect();
});

test('retries a committed invitation with its original key, then gives a sibling a new seat', async ({ page, context }) => {
  await context.addCookies([{
    name: 'ye_instructor',
    value: instructorToken(instructorId),
    url: 'http://127.0.0.1:3107',
  }]);

  const requests: { name: string; email: string; idempotencyKey: string }[] = [];
  let firstServerStatus: number | null = null;
  await page.route('**/svc/live-lab/invitations', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      // Let the real handler commit the seat, then simulate losing its response.
      const committed = await route.fetch();
      firstServerStatus = committed.status();
      await committed.dispose();
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.goto('/instructor');
  await page.getByTestId('nav-instructor-live').click();
  await expect(page.getByTestId(`card-live-${roomId}`)).toBeVisible();
  await page.getByTestId(`card-live-${roomId}`).click();
  await page.getByTestId('input-guest-name').fill('Retry student');
  await page.getByTestId('input-guest-email').fill('guardian@example.invalid');

  await page.getByTestId('button-guest-add').click();
  await expect.poll(() => db.liveLabGuest.count({ where: { roomId } })).toBe(1);
  await expect(page.getByTestId('button-guest-add')).toBeEnabled();

  const original = await db.liveLabGuest.findFirstOrThrow({ where: { roomId } });
  expect(firstServerStatus).toBe(200);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ name: 'Retry student', email: 'guardian@example.invalid' });
  expect(requests[0].idempotencyKey).toBe(original.idempotencyKey);

  await page.getByTestId('button-guest-add').click();
  await expect(page.getByTestId('input-guest-name')).toHaveValue('');
  await expect.poll(() => db.liveLabGuest.count({ where: { roomId } })).toBe(1);
  expect((await db.liveLabGuest.findFirstOrThrow({ where: { roomId } })).id).toBe(original.id);

  await page.getByTestId('input-guest-name').fill('Sibling student');
  await page.getByTestId('input-guest-email').fill('guardian@example.invalid');
  await page.getByTestId('button-guest-add').click();
  await expect(page.getByTestId('input-guest-name')).toHaveValue('');

  expect(requests).toHaveLength(3);
  expect(requests[1].idempotencyKey).toBe(requests[0].idempotencyKey);
  expect(requests[2]).toMatchObject({ name: 'Sibling student', email: 'guardian@example.invalid' });
  expect(requests[2].idempotencyKey).not.toBe(requests[0].idempotencyKey);

  const guests = await db.liveLabGuest.findMany({ where: { roomId } });
  expect(guests).toHaveLength(2);
  expect(guests.map((guest) => guest.name).sort()).toEqual(['Retry student', 'Sibling student']);
  expect(new Set(guests.map((guest) => guest.idempotencyKey)).size).toBe(2);
});
