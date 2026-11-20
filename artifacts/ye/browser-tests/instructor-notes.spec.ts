import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { testDbUrl } from '../src/tests/test-db';

const db = new PrismaClient({ datasourceUrl: testDbUrl() });
const prefix = `notes-${randomUUID()}`;
const origin = 'http://127.0.0.1:3107';
let programId: number, courseRunId: number, sessionId: number;
let instructorAId: number, instructorBId: number;

function token(subject: string, instructor = false) {
  const payload = `${subject}.${Date.now() + 3_600_000}`;
  const signature = createHmac('sha256', 'browser-regression-only-secret')
    .update(instructor ? `instructor:${payload}` : payload).digest('hex');
  return `${payload}.${signature}`;
}

async function signIn(context: BrowserContext, role: 'admin' | 'instructor', instructorId?: number) {
  const subject = role === 'admin' ? 'admin' : `${instructorId}.1`;
  await context.addCookies([{
    name: role === 'admin' ? 'ye_admin' : 'ye_instructor',
    value: token(subject, role === 'instructor'),
    url: origin,
  }]);
}

async function openNotes(page: Page) {
  await page.goto('/en/instructor?view=notes');
  await expect(page.getByTestId(`input-note-${sessionId}`)).toBeVisible();
}

test.beforeAll(async () => {
  const program = await db.program.create({ data: {
    slug: prefix, nameAr: prefix, nameEn: prefix, ageMin: 4, ageMax: 14,
    kitCode: 'TEST', format: 'online', color: '#6541b5', level: 1,
    taglineAr: '', taglineEn: '', descAr: '', descEn: '',
    buildsAr: [], buildsEn: [], termsAr: [], termsEn: [],
  } });
  programId = program.id;
  const course = await db.courseRun.create({ data: {
    programId, titleAr: prefix, titleEn: prefix,
    startDate: new Date(), endDate: new Date(Date.now() + 30 * 86_400_000),
    weekday: 0, time: '17:00', format: 'online', capacity: 12, seatsLeft: 12,
    sessions: { create: { date: new Date(Date.now() + 86_400_000) } },
  }, include: { sessions: true } });
  courseRunId = course.id;
  sessionId = course.sessions[0].id;
  instructorAId = (await db.instructor.create({ data: {
    name: `${prefix} A`, email: `${prefix}-a@example.invalid`, passwordHash: 'test-only',
    assignments: { create: { courseRunId } },
  } })).id;
  instructorBId = (await db.instructor.create({ data: {
    name: `${prefix} B`, email: `${prefix}-b@example.invalid`, passwordHash: 'test-only',
    assignments: { create: { courseRunId } },
  } })).id;
});

test.afterAll(async () => {
  if (instructorAId) await db.instructor.deleteMany({ where: { id: { in: [instructorAId, instructorBId].filter(Boolean) } } });
  if (programId) await db.program.deleteMany({ where: { id: programId } });
  await db.$disconnect();
});

test('private preparation notes preserve drafts and resolve concurrent saves', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const otherContext = await browser.newContext();
  const adminContext = await browser.newContext();
  try {
    await signIn(contextA, 'instructor', instructorAId);
    await signIn(contextB, 'instructor', instructorAId);
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await openNotes(pageA);
    await openNotes(pageB);
    const inputA = pageA.getByTestId(`input-note-${sessionId}`);
    const inputB = pageB.getByTestId(`input-note-${sessionId}`);
    const saveA = pageA.getByTestId(`button-save-note-${sessionId}`);
    const saveB = pageB.getByTestId(`button-save-note-${sessionId}`);

    await inputA.fill('Teacher A saved preparation');
    await saveA.click();
    await expect(pageA.getByTestId(`status-note-${sessionId}`)).toContainText('Saved');
    await expect(inputA).toHaveValue('Teacher A saved preparation');

    await inputB.fill('  Teacher B replacement  ');
    await saveB.click();
    await expect(pageB.getByTestId(`conflict-note-${sessionId}`)).toBeVisible();
    await expect(inputB).toHaveValue('  Teacher B replacement  ');
    await expect(pageB.getByTestId(`latest-note-${sessionId}`)).toHaveValue('Teacher A saved preparation');
    await expect(saveB).toBeDisabled();
    await pageB.screenshot({
      path: '../../generated-artifacts/browser-tests/instructor-note-conflict.png',
      fullPage: true,
    });

    await pageB.getByTestId('button-instructor-refresh').click();
    await expect(pageB.getByTestId('status-instructor-refresh')).toHaveAttribute('data-state', 'done');
    await expect(inputB).toHaveValue('  Teacher B replacement  ');
    await expect(pageB.getByTestId(`conflict-note-${sessionId}`)).toBeVisible();
    await expect(pageB.getByTestId(`latest-note-${sessionId}`)).toHaveValue('Teacher A saved preparation');

    await pageB.getByTestId(`button-keep-note-${sessionId}`).click();
    await expect(pageB.getByTestId(`conflict-note-${sessionId}`)).toHaveCount(0);
    await saveB.click();
    await expect(pageB.getByTestId(`status-note-${sessionId}`)).toContainText('Saved');
    await expect(inputB).toHaveValue('Teacher B replacement');
    await pageA.reload();
    await expect(inputA).toHaveValue('Teacher B replacement');

    // Hold the next POST open to prove editing remains dirty across an in-flight save.
    let releasePost!: () => void;
    let markHeld!: () => void;
    const held = new Promise<void>(resolve => { markHeld = resolve; });
    const gate = new Promise<void>(resolve => { releasePost = resolve; });
    await pageB.route('**/svc/instructor/notes', async route => {
      if (route.request().method() === 'POST') {
        markHeld();
        await gate;
      }
      await route.continue();
    });
    await inputB.fill('  Teacher B in-flight base  ');
    await saveB.click();
    await held;
    await expect(saveB).toBeDisabled();
    await inputB.fill('Teacher B edited while saving');
    releasePost();
    await expect(pageB.getByTestId(`status-note-${sessionId}`)).toHaveAttribute('data-state', 'dirty');
    await expect(inputB).toHaveValue('Teacher B edited while saving');
    await saveB.click();
    await expect(pageB.getByTestId(`status-note-${sessionId}`)).toContainText('Saved');
    await expect(inputB).toHaveValue('Teacher B edited while saving');
    await pageB.unroute('**/svc/instructor/notes');

    await inputA.fill('Teacher A local second draft');
    await saveA.click();
    await expect(pageA.getByTestId(`conflict-note-${sessionId}`)).toBeVisible();
    await expect(pageA.getByTestId(`latest-note-${sessionId}`)).toHaveValue('Teacher B edited while saving');
    pageA.once('dialog', dialog => dialog.dismiss());
    await pageA.getByTestId(`button-latest-note-${sessionId}`).click();
    await expect(inputA).toHaveValue('Teacher A local second draft');
    await expect(pageA.getByTestId(`conflict-note-${sessionId}`)).toBeVisible();
    pageA.once('dialog', dialog => dialog.accept());
    await pageA.getByTestId(`button-latest-note-${sessionId}`).click();
    await expect(inputA).toHaveValue('Teacher B edited while saving');
    await expect(pageA.getByTestId(`conflict-note-${sessionId}`)).toHaveCount(0);
    await expect(saveA).toBeDisabled();

    await signIn(otherContext, 'instructor', instructorBId);
    const otherPage = await otherContext.newPage();
    await openNotes(otherPage);
    const privateInput = otherPage.getByTestId(`input-note-${sessionId}`);
    await expect(privateInput).toHaveValue('');
    await expect(otherPage.locator('body')).not.toContainText(/Teacher A saved preparation|Teacher B replacement|Teacher B edited while saving/);

    await signIn(adminContext, 'admin');
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/admin?tab=instructors');
    await expect(adminPage.getByTestId('link-admin-instructor-panel')).toBeVisible();
    const [preview] = await Promise.all([
      adminContext.waitForEvent('page'),
      adminPage.getByTestId('link-admin-instructor-panel').click(),
    ]);
    await preview.goto('/en/instructor?view=notes');
    await expect(preview.getByTestId('banner-admin-preview')).toBeVisible();
    const previewInput = preview.getByTestId(`input-note-${sessionId}`);
    await expect(previewInput).toHaveAttribute('readonly', '');
    await expect(previewInput).toHaveValue('');
    await expect(preview.getByTestId(`button-save-note-${sessionId}`)).toHaveCount(0);
    await expect(preview.locator('body')).not.toContainText(/Teacher A saved preparation|Teacher B replacement|Teacher B edited while saving/);
  } finally {
    await Promise.all([contextA.close(), contextB.close(), otherContext.close(), adminContext.close()]);
  }
});
