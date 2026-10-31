import { test, expect, type Page, type Locator } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { testDbUrl } from '../src/tests/test-db';

const db = new PrismaClient({ datasourceUrl: testDbUrl() });
const run = `browser-${randomUUID()}`;
const original = 'https://youtu.be/dQw4w9WgXcQ';
const alternate = 'https://vimeo.com/76979871';
let subjectId: number, familyId: number, childId: number, lessonId: number, programId: number;

// Test-only signed sessions exercise the real guards, not intercepted API responses.
function token(subject: string) {
  const payload = `${subject}.${Date.now() + 3_600_000}`;
  return `${payload}.${createHmac('sha256', 'browser-regression-only-secret').update(payload).digest('hex')}`;
}
function field(modal: Locator, label: string) {
  return modal.locator('label').filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::*[1]');
}
async function save(page: Page) {
  const response = page.waitForResponse(r => r.url().endsWith(`/curriculum/lessons/${lessonId}`) && r.request().method() === 'PATCH');
  await page.locator('.learn-modal').getByRole('button', { name: 'حفظ', exact: true }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(page.locator('.learn-modal')).toHaveCount(0);
}

test.beforeAll(async () => {
  const family = await db.family.create({
    data: { phone: run, parentName: 'Browser regression', students: { create: { firstName: 'Test', birthYear: 2018 } } },
    include: { students: true },
  });
  familyId = family.id;
  const program = await db.program.create({ data: {
    slug: run, nameAr: run, nameEn: run, ageMin: 6, ageMax: 10,
    kitCode: 'KIT-01', format: 'online', color: '#1C54CB', level: 1,
    taglineEn: 'Test', taglineAr: 'اختبار', descEn: 'Test', descAr: 'اختبار',
    buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
  } });
  programId = program.id;
  const course = await db.courseRun.create({ data: {
    programId, startDate: new Date(), endDate: new Date(Date.now() + 86_400_000 * 30),
    weekday: 0, time: '17:00', format: 'online',
  } });
  await db.enrollment.create({ data: { studentId: family.students[0].id, courseRunId: course.id, status: 'active' } });
  childId = (await db.lrnChild.create({ data: { familyId, name: run, band: 'explorers', pin: 'unused-test-session' } })).id;
  subjectId = (await db.lrnSubject.create({ data: { slug: run, nameAr: run, nameEn: run, icon: 'T', color: '#1C54CB' } })).id;
  const unit = await db.lrnUnit.create({ data: { subjectId, band: 'explorers', titleAr: run, titleEn: run, status: 'published', position: 0 } });
  lessonId = (await db.lrnLesson.create({ data: {
    unitId: unit.id, titleAr: 'درس اختبار', titleEn: 'Browser lesson',
    descAr: 'وصف', descEn: 'Description', status: 'published', position: 0,
    videoUrl: original, videoType: 'youtube',
  } })).id;
});

test.afterAll(async () => {
  // Only remove fixtures owned by this run; never truncate shared tables.
  if (subjectId) await db.lrnSubject.delete({ where: { id: subjectId } });
  if (familyId) await db.family.delete({ where: { id: familyId } });
  if (programId) {
    await db.courseRun.deleteMany({ where: { programId } });
    await db.program.delete({ where: { id: programId } });
  }
  await db.$disconnect();
});

test('language metadata, independent players, clearing, and exercise readiness persist', async ({ page, context }) => {
  expect((await context.request.get(`/svc/admin/curriculum/subjects`)).status()).toBe(401);
  expect((await context.request.get(`/svc/learn/lessons/${lessonId}`)).status()).toBe(401);
  await context.addCookies([
    { name: 'ye_admin', value: token('admin'), url: 'http://127.0.0.1:3107' },
    { name: 'ye_family', value: token(`family.${familyId}`), url: 'http://127.0.0.1:3107' },
    { name: 'ye_kid', value: token(`kid.${familyId}.${childId}`), url: 'http://127.0.0.1:3107' },
  ]);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'المناهج', exact: true }).click();
  await page.locator('.curr-subject-header').filter({ hasText: run }).click();
  const row = page.locator('.curr-lesson-row').filter({ hasText: 'درس اختبار' });
  const modal = page.locator('.learn-modal');
  await row.getByRole('button', { name: 'تعديل', exact: true }).click();
  await field(modal, 'لغة الفيديو الأصلي').selectOption('ar');
  await field(modal, 'فيديو إنجليزي بديل \\(اختياري\\)').fill(alternate);
  await field(modal, 'نوع الفيديو الإنجليزي').selectOption('vimeo');
  await save(page);
  await expect(row).toContainText('إنجليزي حسب المؤلف (التشغيل غير مفحوص)');
  // Full reload proves this is persisted server state, not just modal state.
  await page.reload();
  await page.getByRole('button', { name: 'المناهج', exact: true }).click();
  await page.locator('.curr-subject-header').filter({ hasText: run }).click();
  await row.getByRole('button', { name: 'تعديل', exact: true }).click();
  await expect(field(modal, 'لغة الفيديو الأصلي')).toHaveValue('ar');
  await expect(field(modal, 'فيديو إنجليزي بديل \\(اختياري\\)')).toHaveValue(alternate);
  await expect(field(modal, 'نوع الفيديو الإنجليزي')).toHaveValue('vimeo');
  await expect(field(modal, 'نوع الفيديو')).toHaveValue('youtube');
  await modal.getByRole('button', { name: 'إلغاء' }).click();

  const learner = await context.newPage();
  // Do not depend on third-party player availability: verify the actual rendered
  // player type and URL while leaving all first-party requests untouched.
  await learner.route(/https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//, route => route.fulfill({ body: '<html>Test player</html>', contentType: 'text/html' }));
  await learner.goto(`/en/learn/${childId}/lessons/${lessonId}`);
  await expect(learner.locator('.kid-video-wrap iframe')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871');
  await learner.goto(`/learn/${childId}/lessons/${lessonId}`);
  await expect(learner.locator('.kid-video-wrap iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');

  await row.getByRole('button', { name: 'تعديل', exact: true }).click();
  await field(modal, 'فيديو إنجليزي بديل \\(اختياري\\)').fill('');
  await save(page);
  await expect(row).toContainText('عربي فقط');
  await row.getByRole('button', { name: 'تعديل', exact: true }).click();
  await expect(field(modal, 'فيديو إنجليزي بديل \\(اختياري\\)')).toHaveValue('');
  await expect(field(modal, 'لغة الفيديو الأصلي')).toHaveValue('ar');
  await modal.getByRole('button', { name: 'إلغاء' }).click();
  await learner.goto(`/en/learn/${childId}/lessons/${lessonId}`);
  await expect(learner.getByText('original video is Arabic-only', { exact: false })).toBeVisible();
  await expect(learner.locator('.kid-video-wrap iframe, .kid-video-wrap video')).toHaveCount(0);
  await learner.goto(`/learn/${childId}/lessons/${lessonId}`);
  await expect(learner.locator('.kid-video-wrap iframe')).toHaveAttribute('src', /youtube-nocookie/);

  await expect(row).toContainText('النص الإنجليزي: جاهز');
  await row.getByTitle('تمارين').click();
  await modal.getByPlaceholder('الصق JSON هنا...').fill(JSON.stringify([{
    type: 'multiple_choice', promptAr: 'اختر', promptEn: 'Choose',
    options: ['أ', 'ب'], optionsEn: [], correctAnswer: 'أ',
  }]));
  const imported = page.waitForResponse(r => r.url().endsWith(`/lessons/${lessonId}/exercises`) && r.request().method() === 'POST');
  await modal.getByRole('button', { name: 'استيراد', exact: true }).click();
  const importResponse = await imported;
  expect(importResponse.ok()).toBeTruthy();
  expect(await importResponse.json()).toMatchObject({ imported: 1, skipped: 0 });
  await expect(modal.getByText('اختر', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'إغلاق' }).click();
  await expect(row).toContainText('النص الإنجليزي: ناقص');
  await row.getByTitle('تمارين').click();
  const deleted = page.waitForResponse(r => r.url().includes('/curriculum/exercises/') && r.request().method() === 'DELETE');
  await modal.getByRole('button', { name: '🗑', exact: true }).click();
  expect((await deleted).ok()).toBeTruthy();
  await expect(modal.getByText('لا توجد تمارين', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'إغلاق' }).click();
  await expect(row).toContainText('النص الإنجليزي: جاهز');
  await learner.close();
});

for (const failure of ['rejected replacement', 'malformed JSON'] as const) {
  test(`${failure} preserves saved exercises and readiness after reopening`, async ({ page, context }) => {
    // A separate lesson per case avoids depending on the successful-import test.
    const source = await db.lrnLesson.findUniqueOrThrow({ where: { id: lessonId } });
    const lesson = await db.lrnLesson.create({ data: {
      unitId: source.unitId, titleAr: `اختبار ${failure}`, titleEn: failure,
      descAr: 'وصف', descEn: 'Description', status: 'published', position: 1,
    } });
    const endpoint = `/svc/admin/curriculum/lessons/${lesson.id}/exercises`;
    await context.addCookies([
      { name: 'ye_admin', value: token('admin'), url: 'http://127.0.0.1:3107' },
    ]);
    const exercises = [
      { type: 'multiple_choice', promptAr: 'اختر اللون', promptEn: 'Choose a color',
        options: ['أحمر', 'أزرق'], optionsEn: ['Red', 'Blue'], correctAnswer: 'أحمر' },
      { type: 'multiple_choice', promptAr: 'اختر الشكل', promptEn: 'Choose a shape',
        options: ['دائرة', 'مربع'], optionsEn: [], correctAnswer: 'دائرة' },
    ];
    const seeded = await context.request.post(endpoint, { data: { exercises, replace: true } });
    expect(seeded.ok()).toBeTruthy();
    expect(await seeded.json()).toMatchObject({ imported: 2, skipped: 0 });
    const readSaved = async () => {
      const response = await context.request.get(endpoint);
      expect(response.ok()).toBeTruthy();
      return response.json();
    };
    const saved = await readSaved();
    expect(saved).toHaveLength(2);

    await page.goto('/admin');
    const openCurriculum = async () => {
      await page.getByRole('button', { name: 'المناهج', exact: true }).click();
      await page.locator('.curr-subject-header').filter({ hasText: run }).click();
    };
    await openCurriculum();
    const row = page.locator('.curr-lesson-row').filter({ hasText: lesson.titleAr });
    const modal = page.locator('.learn-modal');
    const expectExercises = async () => {
      await expect(modal.getByRole('button', { name: '🗑', exact: true })).toHaveCount(2);
      for (const exercise of exercises) {
        await expect(modal.getByText(exercise.promptAr, { exact: true })).toBeVisible();
        await expect(modal.getByText(exercise.correctAnswer, { exact: true })).toBeVisible();
      }
    };
    // Missing option translations deliberately make deletion detectable: an empty
    // exercise list would incorrectly switch the row's English text to ready.
    await expect(row).toContainText('النص الإنجليزي: ناقص');
    await row.getByTitle('تمارين').click();
    await expectExercises();
    await modal.getByRole('checkbox', { name: 'استبدال التمارين الحالية' }).check();
    const input = failure === 'malformed JSON' ? '[{"promptAr":'
      : JSON.stringify([
        { ...exercises[0], promptAr: 'بديل يجب ألا يحفظ' },
        { ...exercises[1], optionsEn: ['Circle'] },
      ]);
    await modal.getByPlaceholder('الصق JSON هنا...').fill(input);
    const posts: string[] = [];
    page.on('request', request => {
      if (request.url().endsWith(endpoint) && request.method() === 'POST') posts.push(request.url());
    });
    const rejected = failure === 'rejected replacement'
      ? page.waitForResponse(r => r.url().endsWith(endpoint) && r.request().method() === 'POST')
      : undefined;
    await modal.getByRole('button', { name: 'استيراد', exact: true }).click();
    if (rejected) {
      const response = await rejected;
      expect(response.request().postDataJSON()).toEqual({ exercises: JSON.parse(input), replace: true });
      expect(response.status()).toBe(400);
      expect(await response.json()).toMatchObject({ error: 'invalid_exercises', imported: 0, skipped: 1 });
    }
    await expect(page.getByText(
      failure === 'malformed JSON' ? 'JSON غير صحيح' : 'حدث خطأ في الاستيراد',
      { exact: true },
    )).toBeVisible();
    await expectExercises();
    await expect(modal.getByPlaceholder('الصق JSON هنا...')).toHaveValue(input);
    expect(await readSaved()).toEqual(saved);
    await modal.getByRole('button', { name: 'إغلاق' }).click();
    await expect(modal).toHaveCount(0);
    await expect(row).toContainText('النص الإنجليزي: ناقص');
    await row.getByTitle('تمارين').click();
    await expectExercises();
    await modal.getByRole('button', { name: 'إغلاق' }).click();
    // Reload also rules out a preserved client cache hiding deleted DB rows.
    await page.reload();
    await openCurriculum();
    await expect(row).toContainText('النص الإنجليزي: ناقص');
    await row.getByTitle('تمارين').click();
    await expectExercises();
    expect(await readSaved()).toEqual(saved);
    expect(posts).toHaveLength(failure === 'malformed JSON' ? 0 : 1);
  });
}

for (const language of ['en', 'bilingual'] as const) {
  test(`MP4 alternate and ${language} original survive reopening and clearing`, async ({ page, context }) => {
    const mp4Alternate = 'https://media.example.test/english-alternate.mp4';
    await context.addCookies([
      { name: 'ye_admin', value: token('admin'), url: 'http://127.0.0.1:3107' },
      { name: 'ye_family', value: token(`family.${familyId}`), url: 'http://127.0.0.1:3107' },
      { name: 'ye_kid', value: token(`kid.${familyId}.${childId}`), url: 'http://127.0.0.1:3107' },
    ]);
    const row = page.locator('.curr-lesson-row').filter({ hasText: 'درس اختبار' });
    const modal = page.locator('.learn-modal');
    const openEditor = async () => {
      await page.goto('/admin');
      await page.getByRole('button', { name: 'المناهج', exact: true }).click();
      await page.locator('.curr-subject-header').filter({ hasText: run }).click();
      await row.getByRole('button', { name: 'تعديل', exact: true }).click();
    };
    await openEditor();
    await field(modal, 'لغة الفيديو الأصلي').selectOption(language);
    await field(modal, 'رابط الفيديو الأصلي').fill(original);
    await field(modal, 'نوع الفيديو').selectOption('youtube');
    await field(modal, 'فيديو إنجليزي بديل \\(اختياري\\)').fill(mp4Alternate);
    await field(modal, 'نوع الفيديو الإنجليزي').selectOption('mp4');
    await save(page);
    await expect(row).toContainText('إنجليزي حسب المؤلف (التشغيل غير مفحوص)');

    // Reload the admin page before reopening: assertions must read saved metadata.
    await openEditor();
    await expect(field(modal, 'لغة الفيديو الأصلي')).toHaveValue(language);
    await expect(field(modal, 'رابط الفيديو الأصلي')).toHaveValue(original);
    await expect(field(modal, 'نوع الفيديو')).toHaveValue('youtube');
    await expect(field(modal, 'فيديو إنجليزي بديل \\(اختياري\\)')).toHaveValue(mp4Alternate);
    await expect(field(modal, 'نوع الفيديو الإنجليزي')).toHaveValue('mp4');
    await modal.getByRole('button', { name: 'إلغاء' }).click();

    const learner = await context.newPage();
    // Only external media is stubbed; this tests selection, not MP4 decoding.
    await learner.route(mp4Alternate, route => route.fulfill({ status: 200, contentType: 'video/mp4', body: '' }));
    await learner.route('https://www.youtube-nocookie.com/**', route => route.fulfill({
      body: '<html>Test player</html>', contentType: 'text/html',
    }));
    const englishPath = `/en/learn/${childId}/lessons/${lessonId}`;
    const arabicPath = `/learn/${childId}/lessons/${lessonId}`;
    const expectOriginal = async () => {
      await expect(learner.locator('.kid-video-wrap iframe')).toHaveAttribute(
        'src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
      );
      await expect(learner.locator('.kid-video-wrap video')).toHaveCount(0);
      await expect(learner.getByText('original video is Arabic-only', { exact: false })).toHaveCount(0);
    };
    await learner.goto(englishPath);
    await expect(learner.locator('.kid-video-wrap video')).toBeVisible();
    await expect(learner.locator('.kid-video-wrap video')).toHaveAttribute('src', mp4Alternate);
    await expect(learner.locator('.kid-video-wrap video')).toHaveAttribute('controls', '');
    await expect(learner.locator('.kid-video-wrap iframe')).toHaveCount(0);
    await learner.goto(arabicPath);
    await expectOriginal();

    await row.getByRole('button', { name: 'تعديل', exact: true }).click();
    await field(modal, 'فيديو إنجليزي بديل \\(اختياري\\)').fill('');
    await save(page);
    await expect(row).toContainText('إنجليزي حسب المؤلف (التشغيل غير مفحوص)');
    await openEditor();
    await expect(field(modal, 'فيديو إنجليزي بديل \\(اختياري\\)')).toHaveValue('');
    await expect(field(modal, 'لغة الفيديو الأصلي')).toHaveValue(language);
    await expect(field(modal, 'رابط الفيديو الأصلي')).toHaveValue(original);
    await expect(field(modal, 'نوع الفيديو')).toHaveValue('youtube');
    await modal.getByRole('button', { name: 'إلغاء' }).click();

    await learner.goto(englishPath);
    await expectOriginal();
    await learner.reload();
    await expectOriginal();
    await learner.goto(arabicPath);
    await expectOriginal();
    await learner.close();
  });
}
