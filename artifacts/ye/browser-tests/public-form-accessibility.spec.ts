import { test, expect, type Locator } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { testDbUrl } from '../src/tests/test-db';
import { bookDict } from '../src/app/(ar)/book/dict';
import { consultDict } from '../src/app/(ar)/consult/dict';
import { watanonaDict } from '../src/app/(ar)/watanona/dictionary';

// Only the disposable test database receives a program fixture. Browser API
// responses are mocked: no SMS, meetings, bookings, or contributions are sent.
const db = new PrismaClient({ datasourceUrl: testDbUrl() });
const slug = `a11y-${randomUUID()}`;
let programId: number | undefined;

test.beforeAll(async () => {
  const program = await db.program.create({ data: {
    slug, nameAr: slug, nameEn: slug, ageMin: 4, ageMax: 18,
    kitCode: 'TEST', format: 'online', color: '#1C54CB', level: 1,
    taglineAr: '', taglineEn: '', descAr: '', descEn: '',
    buildsAr: [], buildsEn: [], termsAr: [], termsEn: [],
    slots: { create: { weekday: 4, time: '22:49', format: 'online', capacity: 12, seatsLeft: 12 } },
  } });
  programId = program.id;
});
test.afterAll(async () => {
  if (programId !== undefined) await db.program.delete({ where: { id: programId } });
  await db.$disconnect();
});

async function invalid(control: Locator, errorId: string) {
  await expect(control).toHaveAttribute('aria-invalid', 'true');
  await expect(control).toHaveAttribute('aria-describedby', errorId);
}

for (const lang of ['ar', 'en'] as const) {
  const prefix = lang === 'ar' ? '' : '/en';
  test(`${lang}: trial age selection and validation/submission errors are accessible`, async ({ page }) => {
    const d = bookDict[lang];
    await page.route('**/svc/account/me', route => route.fulfill({ json: {
      id: 1, parentName: '', phone: '0500000000', students: [],
    } }));
    let submission = 0;
    await page.route('**/svc/bookings', route => route.fulfill({
      status: ++submission === 1 ? 500 : 409,
      json: { error: submission === 1 ? 'internal_error' : 'slot_full' },
    }));
    await page.goto(`${prefix}/book`);
    const flow = page.locator('.w-box').filter({ has: page.locator('.w-steps') });
    const alert = flow.getByRole('alert');
    await expect(alert).toBeEmpty();
    const ages = flow.getByRole('group', { name: lang === 'ar' ? 'كم عمر طفلك؟' : 'How old is your child?' });
    const all = ages.getByRole('button', { name: lang === 'ar' ? 'الكل' : 'All', exact: true });
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await ages.getByRole('button', { name: '8', exact: true }).click();
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    await expect(ages.locator('[aria-pressed="true"]')).toHaveCount(1);
    await all.click();
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await flow.getByRole('button', { name: d.continue, exact: true }).click();
    await expect(alert).toHaveText(d.valError);
    await flow.locator('.prog-card').filter({ hasText: slug }).click();
    await flow.getByRole('button', { name: d.continue, exact: true }).click();
    await flow.getByRole('button', { name: d.continue, exact: true }).click();
    await expect(alert).toHaveText(d.valError);
    await flow.locator('button.slot-item').filter({ hasText: '22:49' }).click();
    await flow.getByRole('button', { name: d.continue, exact: true }).click();
    await expect(flow.getByLabel(d.childName, { exact: true })).not.toHaveAttribute('aria-invalid');
    await flow.getByRole('button', { name: d.submit, exact: true }).click();
    await expect(alert).toHaveText(d.valError);
    for (const name of [d.parentName, d.childName, d.birthYear, d.email, d.contactConsent]) {
      await invalid(flow.getByLabel(name, { exact: true }), 'book-error');
    }
    await expect(flow.getByLabel(d.mobile, { exact: true })).not.toHaveAttribute('aria-invalid');
    await flow.getByLabel(d.parentName, { exact: true }).fill('Test parent');
    await flow.getByLabel(d.childName, { exact: true }).fill('Test child');
    await flow.getByLabel(d.birthYear, { exact: true }).selectOption(String(new Date().getFullYear() - 8));
    await flow.getByLabel(d.email, { exact: true }).fill('accessibility@example.test');
    await flow.getByLabel(d.contactConsent, { exact: true }).check();
    await expect(flow.locator('[aria-invalid="true"]')).toHaveCount(0);
    await flow.getByRole('button', { name: d.submit, exact: true }).click();
    await expect(alert).toHaveText(d.genericError);
    await flow.getByRole('button', { name: d.submit, exact: true }).click();
    await expect(alert).toHaveText(d.slotFullError);
    await expect(flow.locator('.slot-list')).toBeVisible();
    expect(submission).toBe(2);
  });

  test(`${lang}: consultation announces date/time state, invalid fields, and server errors`, async ({ page }) => {
    const d = consultDict[lang];
    const slots = ['2099-01-05T10:00:00.000Z', '2099-01-05T11:00:00.000Z', '2099-01-06T10:00:00.000Z'];
    await page.route('**/svc/appointments/availability', route => route.fulfill({
      json: { slots: slots.map(startsAt => ({ startsAt })) },
    }));
    let submission = 0;
    await page.route('**/svc/appointments', route => route.fulfill({
      status: [409, 502, 500][submission++], json: {},
    }));
    await page.goto(`${prefix}/consult`);
    const flow = page.locator('.w-box');
    const alert = flow.getByRole('alert');
    await expect(alert).toBeEmpty();
    const days = flow.getByRole('group', { name: d.pickDay, exact: true });
    await days.getByRole('button').first().click();
    await expect(days.locator('[aria-pressed="true"]')).toHaveCount(1);
    const times = flow.getByRole('group', { name: d.pickTime, exact: true });
    await times.getByRole('button').first().click();
    await expect(times.locator('[aria-pressed="true"]')).toHaveCount(1);
    await times.getByRole('button').last().click();
    await expect(times.getByRole('button').first()).toHaveAttribute('aria-pressed', 'false');
    await expect(times.getByRole('button').last()).toHaveAttribute('aria-pressed', 'true');
    await days.getByRole('button').last().click();
    await expect(days.getByRole('button').first()).toHaveAttribute('aria-pressed', 'false');
    await expect(days.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(times.locator('[aria-pressed="true"]')).toHaveCount(0);
    await times.getByRole('button').first().click();
    await flow.getByRole('button', { name: d.submit, exact: true }).click();
    await expect(alert).toHaveText(d.valError);
    await invalid(flow.getByLabel(d.parentName, { exact: true }), 'consult-error');
    await invalid(flow.getByLabel(d.mobile, { exact: true }), 'consult-error');
    await flow.getByLabel(d.parentName, { exact: true }).fill('Test parent');
    await flow.getByLabel(d.mobile, { exact: true }).fill('bad-number');
    await invalid(flow.getByLabel(d.mobile, { exact: true }), 'consult-error');
    await flow.getByLabel(d.mobile, { exact: true }).fill('0500000000');
    await expect(flow.locator('[aria-invalid="true"]')).toHaveCount(0);
    await flow.getByRole('button', { name: d.submit, exact: true }).click();
    await expect(alert).toHaveText(d.slotGone);
    await expect(times.locator('[aria-pressed="true"]')).toHaveCount(0);
    await times.getByRole('button').first().click();
    await flow.getByRole('button', { name: d.submit, exact: true }).click();
    await expect(alert).toHaveText(d.calendarError);
    await flow.getByRole('button', { name: d.submit, exact: true }).click();
    await expect(alert).toHaveText(d.genericError);
    expect(submission).toBe(3);
  });

  test(`${lang}: campaign controls are named and feedback uses persistent live regions`, async ({ page }) => {
    const d = watanonaDict[lang];
    await page.route('**/svc/account/me', route => route.fulfill({ json: {
      students: [{ id: 1, firstName: 'Test child', birthYear: 2018 }],
    } }));
    let submission = 0;
    await page.route('**/svc/bricks', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { wall: [] } });
      submission++;
      return route.fulfill({
        status: submission <= 3 ? 200 : submission === 4 ? 500 : 429,
        json: { count: 100 + submission, remainingToday: Math.max(0, 3 - submission), pendingReview: submission === 2 },
      });
    });
    await page.goto(`${prefix}/watanona`);
    const wall = page.locator('#wall');
    const status = wall.getByRole('status');
    const alert = wall.getByRole('alert');
    await expect(status).toHaveCount(1);
    await expect(alert).toBeEmpty();
    const colors = wall.getByRole('group', { name: d.brickColorLbl, exact: true });
    for (const name of lang === 'ar' ? ['أزرق', 'ذهبي', 'سماوي', 'رملي'] : ['Blue', 'Gold', 'Cyan', 'Sand']) {
      await expect(colors.getByRole('button', { name, exact: true })).toHaveCount(1);
    }
    await colors.getByRole('button').first().click();
    await expect(colors.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
    await expect(colors.locator('[aria-pressed="true"]')).toHaveCount(1);
    await wall.getByLabel(d.brickChildLbl, { exact: true }).selectOption('1');
    const place = wall.getByRole('button', { name: d.wallPlaceBtn, exact: true });
    // Remember the actual DOM nodes, not just selectors, to check persistence.
    await status.evaluate(el => el.setAttribute('data-original-region', 'true'));
    await alert.evaluate(el => el.setAttribute('data-original-region', 'true'));
    await place.click();
    await expect(status).toHaveText(d.wallRemaining(2));
    await wall.getByLabel(d.wallMsgLbl, { exact: true }).fill('A message for the wall');
    await wall.getByRole('checkbox').check();
    await place.click();
    await expect(status).toContainText(d.wallPendingNote);
    await expect(status).toContainText(d.wallRemaining(1));
    await place.click();
    await expect(status).toHaveText(d.wallRemaining(0));
    await expect(place).toBeDisabled();
    await expect(status).toHaveAttribute('data-original-region', 'true');
    await page.reload();
    await expect(wall.getByLabel(d.wallMsgLbl, { exact: true })).toBeVisible();
    await alert.evaluate(el => el.setAttribute('data-original-region', 'true'));
    await place.click();
    await expect(alert).toHaveText(d.wallError);
    await place.click();
    await expect(alert).toHaveText(d.wallLimitReached);
    await expect(alert).toHaveAttribute('data-original-region', 'true');
    expect(submission).toBe(5);
  });
}
