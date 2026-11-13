import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { testDbUrl } from '../src/tests/test-db';

const db = new PrismaClient({ datasourceUrl: testDbUrl() });
const prefix = `panels-${randomUUID()}`;
const origin = 'http://127.0.0.1:3107';
let familyId: number, programId: number, teacherId: number, sessionId: number;
let courseId: number, fullCourseId: number, bookingId: number, unassignedId: number;
let students: number[] = [], children: number[] = [];
function token(subject: string, teacher = false) {
  const payload = `${subject}.${Date.now() + 3_600_000}`;
  const sig = createHmac('sha256', 'browser-regression-only-secret')
    .update(teacher ? `instructor:${payload}` : payload).digest('hex');
  return `${payload}.${sig}`;
}
async function auth(context: BrowserContext, role: 'admin' | 'instructor' | 'family') {
  await context.addCookies([{
    name: role === 'admin' ? 'ye_admin' : role === 'instructor' ? 'ye_instructor' : 'ye_family',
    value: token(role === 'admin' ? 'admin' : role === 'instructor' ? `${teacherId}.1` : `family.${familyId}`, role === 'instructor'),
    url: origin,
  }]);
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function overflowReport(page: Page) {
  return page.evaluate(() => {
    const offenders = [...document.querySelectorAll<HTMLElement>('*')].flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || (r.left >= -1 && r.right <= innerWidth + 1)) return [];
      const s = getComputedStyle(el);
      const ancestors = [el.parentElement, el.parentElement?.parentElement].filter((a): a is HTMLElement => Boolean(a))
        .map((a) => ({ tag: a.tagName, id: a.id, className: String(a.className).slice(0, 100) }));
      return [{
        tag: el.tagName, id: el.id, testId: el.dataset.testid, className: String(el.className).slice(0, 140),
        rect: { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) },
        overflowPx: Math.round(Math.max(0, -r.left, r.right - innerWidth)),
        style: { display: s.display, position: s.position, flexShrink: s.flexShrink, minWidth: s.minWidth,
          whiteSpace: s.whiteSpace, overflowX: s.overflowX, direction: s.direction },
        ancestors,
      }];
    });
    return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      docScrollLeft: document.documentElement.scrollLeft, bodyScrollWidth: document.body.scrollWidth,
      offenders: offenders.sort((a, b) => b.overflowPx - a.overflowPx).slice(0, 40) };
  });
}
test.beforeAll(async () => {
  const family = await db.family.create({ data: {
    phone: prefix, parentName: 'Panel test parent',
    students: { create: [{ firstName: 'Same name', birthYear: 2018 }, { firstName: 'Same name', birthYear: 2020 }] },
  }, include: { students: true } });
  familyId = family.id;
  students = family.students.map(s => s.id);
  programId = (await db.program.create({ data: {
    slug: prefix, nameAr: prefix, nameEn: prefix, ageMin: 4, ageMax: 14,
    kitCode: 'TEST', format: 'online', color: '#6541b5', level: 1,
    taglineAr: '', taglineEn: '', descAr: '', descEn: '',
    buildsAr: [], buildsEn: [], termsAr: [], termsEn: [],
  } })).id;
  const course = await db.courseRun.create({ data: {
    programId, titleAr: `${prefix}-available`, titleEn: `${prefix}-available`,
    startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000),
    weekday: 0, time: '17:00', format: 'online', capacity: 12, seatsLeft: 11,
    sessions: { create: { date: new Date(Date.now() + 86400000) } },
  }, include: { sessions: true } });
  courseId = course.id;
  sessionId = course.sessions[0].id;
  fullCourseId = (await db.courseRun.create({ data: {
    programId, titleAr: `${prefix}-full`, titleEn: `${prefix}-full`,
    startDate: new Date(), endDate: new Date(), weekday: 0, time: '18:00',
    format: 'online', capacity: 1, seatsLeft: 0, active: false,
  } })).id;
  await db.enrollment.create({ data: { studentId: students[0], courseRunId: courseId, status: 'active' } });
  teacherId = (await db.instructor.create({ data: {
    name: 'Panel test teacher', email: `${prefix}@example.invalid`, passwordHash: 'not-a-login-hash',
    assignments: { create: { courseRunId: courseId } },
  } })).id;
  for (const band of ['explorers', 'graduates'] as const) {
    children.push((await db.lrnChild.create({ data: { familyId, name: 'Same name', band, pin: '1234' } })).id);
  }
  const slot = await db.scheduleSlot.create({ data: { programId, weekday: 0, time: '17:00', format: 'online' } });
  for (const assignedTo of ['Panel owner', '']) {
    const booking = await db.booking.create({ data: {
      programId, slotId: slot.id, parentName: prefix, phone: prefix,
      childFirstName: assignedTo ? 'Assigned child' : 'Unassigned child',
      childBirthYear: 2018, neighborhood: 'riyadh', assignedTo,
    } });
    if (assignedTo) bookingId = booking.id; else unassignedId = booking.id;
  }
});
test.afterAll(async () => {
  if (teacherId) await db.instructor.delete({ where: { id: teacherId } });
  if (programId) {
    await db.booking.deleteMany({ where: { programId } });
    await db.program.delete({ where: { id: programId } });
  }
  if (familyId) await db.family.delete({ where: { id: familyId } });
  await db.$disconnect();
});

test('admin filters, section history, all phone destinations and failed loads', async ({ page, context }) => {
  await auth(context, 'admin');
  await page.goto('/admin?tab=not-a-section');
  await expect(page.getByTestId('input-bookings-search')).toBeVisible();
  await page.getByTestId('input-bookings-search').fill(prefix);
  await expect(page.getByTestId('text-bookings-count')).toContainText('2 من');
  await page.getByTestId('select-bookings-owner').selectOption('unassigned');
  await expect(page.getByTestId(`card-booking-${unassignedId}`)).toBeVisible();
  await expect(page.getByTestId(`card-booking-${bookingId}`)).toHaveCount(0);
  await expect(page.getByTestId('link-bookings-csv')).toHaveAttribute('href', '/svc/admin/bookings?format=csv');
  await page.getByTestId('nav-admin-runs').click();
  await page.getByTestId('input-runs-search').fill(prefix);
  await page.getByTestId('select-runs-seats').selectOption('full');
  await expect(page.getByTestId(`row-run-${fullCourseId}`)).toBeVisible();
  await expect(page.getByTestId(`row-run-${courseId}`)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('select-runs-seats')).toHaveValue('full');
  await page.goBack();
  await expect(page.getByTestId('select-bookings-owner')).toHaveValue('unassigned');
  await page.getByTestId('input-bookings-search').fill('no-match-at-all');
  await expect(page.getByTestId('empty-bookings-filtered')).toBeVisible();
  await page.getByTestId('button-bookings-clear-empty').click();
  await expect(page.getByTestId('input-bookings-search')).toHaveValue('');
  await page.screenshot({ path: '../../generated-artifacts/panels-evidence/admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('button-admin-menu').click();
  await expect(page.getByTestId('panel-admin-drawer').locator('button[data-testid^="drawer-admin-"]')).toHaveCount(14);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('panel-admin-drawer')).toHaveCount(0);
  await expect(page.getByTestId('button-admin-menu')).toBeFocused();
  expect(await page.getByTestId('button-admin-menu').evaluate(el => el.matches(':focus-visible'))).toBe(true);
  await page.getByTestId('button-admin-menu').click();
  await page.getByTestId('drawer-admin-runs').click();
  await expect(page.getByTestId('input-runs-search')).toBeVisible();
  await page.screenshot({ path: '../../generated-artifacts/panels-evidence/admin-phone-runs.png' });
  const adminPhone = await overflowReport(page);
  if (adminPhone.scrollWidth > adminPhone.viewport + 1) console.log('ADMIN_PHONE_OVERFLOW', JSON.stringify(adminPhone));
  await page.getByTestId('input-runs-search').fill('no-match-at-all');
  await expect(page.getByTestId('empty-runs-filtered')).toBeVisible();
  await page.getByTestId('button-runs-clear-empty').click();
  await page.route('**/svc/admin/bookings', r => r.fulfill({ status: 503, json: { error: 'test_failure' } }));
  await page.goto('/admin');
  await expect(page.getByTestId('status-bookings-error')).toBeVisible();
  await expect(page.getByTestId('empty-bookings')).toHaveCount(0);
  expect(adminPhone.scrollWidth <= adminPhone.viewport + 1).toBe(true);
});

test('instructor class handoff, draft-safe refresh, failed save and attendance', async ({ page, context }) => {
  await auth(context, 'instructor');
  expect((await context.request.get('/svc/admin/bookings')).status()).toBe(401);
  await page.goto('/en/instructor');
  await page.getByTestId(`button-run-roster-${courseId}`).click();
  await expect(page.getByTestId('select-roster-run')).toHaveValue(String(courseId));
  await page.reload();
  await expect(page.getByTestId('select-roster-run')).toHaveValue(String(courseId));
  await page.locator(`#attendance-session-${courseId}`).selectOption(String(sessionId));
  const row = page.getByTestId(`attendance-student-${students[0]}`);
  await expect(row).toBeVisible();
  await page.getByTestId('input-roster-search').fill('Same name');
  await expect(row).toBeVisible();
  await page.getByTestId('input-roster-search').fill('no-student-match');
  await expect(row).toHaveCount(0);
  await page.getByTestId('input-roster-search').fill('');
  await page.locator(`#attendance-session-${courseId}`).selectOption(String(sessionId));
  await expect(row).toBeVisible();
  await page.route('**/svc/instructor/attendance', async r => {
    if (r.request().method() === 'POST') await r.fulfill({ status: 503, json: { error: 'test_failure' } });
    else await r.continue();
  });
  await row.getByRole('button', { name: 'Same name: Present', exact: true }).click();
  await expect(page.getByTestId(`attendance-editor-${courseId}`).getByRole('alert')).toBeVisible();
  await page.unroute('**/svc/instructor/attendance');
  await page.getByTestId('nav-instructor-notes').click();
  const input = page.getByTestId(`input-note-${sessionId}`);
  await input.fill('Keep this unsaved classroom preparation');
  await page.route('**/svc/instructor/dashboard', r => r.fulfill({ status: 503, json: { error: 'test_failure' } }));
  await page.getByTestId('button-instructor-refresh').click();
  await expect(page.getByTestId('status-instructor-refresh')).toHaveAttribute('data-state', 'failed');
  await expect(input).toHaveValue('Keep this unsaved classroom preparation');
  await page.unroute('**/svc/instructor/dashboard');
  await page.getByTestId('button-instructor-refresh').click();
  await expect(page.getByTestId('status-instructor-refresh')).toHaveAttribute('data-state', 'done');
  await expect(input).toHaveValue('Keep this unsaved classroom preparation');
  await page.route('**/svc/instructor/notes', r => r.fulfill({ status: 503, json: { error: 'test_failure' } }));
  await page.getByTestId(`button-save-note-${sessionId}`).click();
  await expect(page.getByTestId(`status-note-${sessionId}`)).toContainText(/fail|could not/i);
  await expect(input).toHaveValue('Keep this unsaved classroom preparation');
  await page.unroute('**/svc/instructor/notes');
  await page.getByTestId(`button-save-note-${sessionId}`).click();
  await expect(page.getByTestId(`status-note-${sessionId}`)).toContainText('Saved');
  await page.screenshot({ path: '../../generated-artifacts/panels-evidence/instructor-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await fits(page);
  await page.screenshot({ path: '../../generated-artifacts/panels-evidence/instructor-tablet.png', fullPage: true });
});

for (const base of ['', '/en']) {
  test(`family child context and explicit same-name PIN chooser ${base || 'ar'}`, async ({ page, context }) => {
    await auth(context, 'family');
    // An existing kid session must not auto-forward the family handoff.
    await context.addCookies([{ name: 'ye_kid', value: token(`kid.${familyId}.${children[0]}`), url: origin }]);
    await page.goto(`${base}/portal?child=${students[0]}`);
    await page.getByTestId('link-portal-section-payments').click();
    await expect(page.getByTestId(`link-portal-child-${students[1]}`)).toContainText('2020');
    await page.getByTestId(`link-portal-child-${students[1]}`).click();
    await expect(page).toHaveURL(new RegExp(`child=${students[1]}#ptl-payments`));
    await expect(page.getByTestId(`link-portal-child-${students[1]}`)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('link-portal-section-attendance')).toHaveAttribute('href', `${base}/portal?child=${students[1]}#ptl-attendance`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `../../generated-artifacts/panels-evidence/portal-phone-${base || 'ar'}.png` });
    const portalPhone = await overflowReport(page);
    if (portalPhone.scrollWidth > portalPhone.viewport + 1) console.log('PORTAL_PHONE_OVERFLOW', JSON.stringify(portalPhone));
    await page.getByTestId('link-portal-learning-chooser').click();
    await expect(page).toHaveURL(`${origin}${base}/learn`);
    for (const id of children) await expect(page.getByTestId(`card-learn-profile-${id}`)).toBeVisible();
    await page.screenshot({ path: `../../generated-artifacts/panels-evidence/chooser-phone-${base || 'ar'}.png` });
    await page.getByTestId(`button-learn-start-${children[1]}`).click();
    await page.getByTestId(`input-learn-pin-${children[1]}`).fill('0000');
    await page.getByTestId(`button-learn-enter-${children[1]}`).click();
    await expect(page.getByTestId(`status-learn-pin-${children[1]}`)).toBeVisible();
    await expect(page.getByTestId(`status-learn-pin-${children[1]}`)).toContainText(/incorrect|غير صحيح/i);
    await expect(page).toHaveURL(`${origin}${base}/learn`);
    await page.getByTestId(`input-learn-pin-${children[1]}`).fill('1234');
    await page.getByTestId(`button-learn-enter-${children[1]}`).click();
    await expect(page).toHaveURL(`${origin}${base}/learn/${children[1]}`);
    await page.goto(`${base}/learn/${children[1]}/lessons/2147483000`);
    const missingLesson = page.locator('.kid-content[role="alert"]');
    await expect(missingLesson).toContainText(/not available|غير متاح/i);
    await expect(page.getByRole('button', { name: /try again|إعادة المحاولة/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /back to learning|العودة إلى التعلّم/i }))
      .toHaveAttribute('href', `${base}/learn/${children[1]}`);
    await page.getByTestId('button-learner-parent').click();
    await expect(page.getByTestId('dialog-parent-gate')).toBeVisible();
    await page.getByTestId('button-parent-gate-cancel').click();
    await expect(page.getByTestId('dialog-parent-gate')).toHaveCount(0);
    await expect(page).toHaveURL(`${origin}${base}/learn/${children[1]}/lessons/2147483000`);
    await page.getByTestId('button-learner-parent').click();
    await page.getByTestId('button-parent-gate-confirm').click();
    await expect(page).toHaveURL(`${origin}${base}/learn`);
    await fits(page);
    expect(portalPhone.scrollWidth <= portalPhone.viewport + 1).toBe(true);
  });
}

test('learner recovery separates expired sessions, enrollment and temporary failures', async ({ page, context }) => {
  await auth(context, 'family');
  await context.addCookies([{ name: 'ye_kid', value: token(`kid.${familyId}.${children[0]}`), url: origin }]);
  for (const [status, error, state] of [
    [401, 'unauthorized', 'signin'], [401, 'no_kid_selected', 'chooser'],
    [403, 'no_active_enrollment', 'enrollment'], [503, 'unavailable', 'transient'],
  ] as const) {
    await page.route('**/svc/learn/home', r => r.fulfill({ status, json: { error } }));
    await page.goto(`/en/learn/${children[0]}`);
    if (state === 'signin') await expect(page).toHaveURL(/\/en\/account\?next=/);
    else if (state === 'chooser') {
      await expect(page).toHaveURL(/\/en\/learn\?reason=session/);
      await expect(page.getByTestId('status-learn-reason-session')).toBeVisible();
    } else {
      await expect(page.getByTestId(`status-learner-${state}`).first()).toBeVisible();
      await expect(page.getByTestId('button-learner-retry')).toHaveCount(state === 'transient' ? 1 : 0);
    }
    await page.unroute('**/svc/learn/home');
  }
});
