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

test.beforeEach(async () => {
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

test.afterEach(async () => {
  if (roomId) await db.liveLabRoom.deleteMany({ where: { id: roomId } });
  if (instructorId) await db.instructor.deleteMany({ where: { id: instructorId } });
});

test.afterAll(async () => {
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

test('preserves a rejected full-class invitation and retries the same identity when a seat opens', async ({ page, context }) => {
  await db.liveLabGuest.createMany({
    data: Array.from({ length: 15 }, (_, i) => ({
      roomId, name: `Seated student ${i}`, email: `seated-${i}@example.invalid`, token: randomUUID(),
    })),
  });
  await context.addCookies([{
    name: 'ye_instructor', value: instructorToken(instructorId), url: 'http://127.0.0.1:3107',
  }]);

  const requests: { name: string; email: string; idempotencyKey: string }[] = [];
  let finalSeatId = '';
  await page.route('**/svc/live-lab/invitations', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      // Fill the last seat only after the loaded form submits, before the real
      // handler sees the request. Polling cannot disable the button prematurely.
      const finalSeat = await db.liveLabGuest.create({
        data: { roomId, name: 'Last seated student', email: 'last@example.invalid', token: randomUUID() },
      });
      finalSeatId = finalSeat.id;
    }
    await route.continue();
  });

  await page.goto('/instructor');
  await page.getByTestId('nav-instructor-live').click();
  await page.getByTestId(`card-live-${roomId}`).click();
  const name = page.getByTestId('input-guest-name');
  const email = page.getByTestId('input-guest-email');
  const add = page.getByTestId('button-guest-add');
  await name.fill('Waiting student');
  await email.fill('waiting@example.invalid');
  await expect(add).toBeEnabled();
  const rejected = page.waitForResponse(res =>
    res.url().endsWith('/svc/live-lab/invitations') && res.request().method() === 'POST');
  await add.click();
  const rejection = await rejected;
  expect(rejection.status()).toBe(409);
  expect(await rejection.json()).toMatchObject({ error: 'session_full' });
  await expect(add).toBeDisabled();
  await expect(page.getByTestId(`row-guest-${finalSeatId}`)).toBeVisible();
  await expect(name).toHaveValue('Waiting student');
  await expect(email).toHaveValue('waiting@example.invalid');
  expect(requests).toHaveLength(1);
  const originalKey = requests[0].idempotencyKey;
  expect(originalKey).toBeTruthy();
  expect(await db.liveLabGuest.count({ where: { roomId, idempotencyKey: originalKey } })).toBe(0);
  expect(await db.liveLabGuest.count({ where: { roomId, revoked: false } })).toBe(16);

  // The rejected details may be intentionally corrected before trying again.
  await name.fill('Corrected student');

  // Free a seat through the actual instructor action without remounting the form.
  await page.getByTestId(`button-guest-revoke-${finalSeatId}`).click();
  await expect(add).toBeEnabled();
  await expect(name).toHaveValue('Corrected student');
  await expect(email).toHaveValue('waiting@example.invalid');
  const accepted = page.waitForResponse(res =>
    res.url().endsWith('/svc/live-lab/invitations') && res.request().method() === 'POST');
  await add.click();
  expect((await accepted).status()).toBe(200);
  await expect(name).toHaveValue('');
  await expect(email).toHaveValue('');
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({
    name: 'Corrected student',
    email: 'waiting@example.invalid',
  });
  expect(requests[1].idempotencyKey).not.toBe(originalKey);
  const rejectedDetails = await db.liveLabGuest.findMany({ where: { roomId, name: 'Waiting student' } });
  expect(rejectedDetails).toHaveLength(0);
  const invited = await db.liveLabGuest.findMany({ where: { roomId, email: 'waiting@example.invalid' } });
  expect(invited).toHaveLength(1);
  expect(invited[0]).toMatchObject({
    name: 'Corrected student',
    email: 'waiting@example.invalid',
    idempotencyKey: requests[1].idempotencyKey,
    revoked: false,
  });
  await expect(page.getByTestId(`row-guest-${invited[0].id}`)).toBeVisible();
  expect(await db.liveLabGuest.count({ where: { roomId, revoked: false } })).toBe(16);
  expect(await db.liveLabGuest.count({ where: { roomId } })).toBe(17);
});
