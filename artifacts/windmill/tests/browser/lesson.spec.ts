import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { windmillLesson as lesson } from '../../src/data/lessons/windmill';
import { UI } from '../../src/i18n/ui';
import { createProgress } from '../../src/lib/lesson-engine';

// Every test gets a new anonymous context. No auth state, database or provider.
const test = base.extend<{ localOnly: void }>({
  localOnly: [async ({ context }, use) => {
    const forbidden: string[] = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      // The existing optional webfont is intentionally replaced with empty local CSS.
      if (url.hostname === 'fonts.googleapis.com') {
        await route.fulfill({ contentType: 'text/css', body: '' });
      } else if (url.origin === 'http://127.0.0.1:4178' &&
        url.pathname.startsWith('/windmill/') && route.request().method() === 'GET') {
        await route.continue();
      } else {
        forbidden.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort('blockedbyclient');
      }
    });
    await use();
    expect(forbidden, 'No backend/provider or external requests allowed').toEqual([]);
  }, { auto: true }],
});

const count = (page: Page, n: number) =>
  expect(page.getByTestId('progress')).toHaveAttribute('aria-valuenow', String(n));
async function open(page: Page, lang: 'en' | 'ar' = 'en') {
  await page.goto('./');
  if (await page.locator('html').getAttribute('lang') !== lang) await page.getByTestId('language').click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
}
async function place(page: Page, number: number, touch = false) {
  const part = page.getByTestId(`part-set-${number}`);
  const target = page.getByTestId('placement-target');
  if (touch) { await part.tap(); await target.tap(); }
  else { await part.click(); await target.click(); }
  await count(page, number);
}
async function saved(page: Page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
}

const progressKey = `funademy.lab.progress.${lesson.id}.v${lesson.version}`;
const languageKey = 'funademy.lab.language';

for (const lang of ['ar', 'en'] as const) {
  for (const failure of ['access', 'write'] as const) {
    test(`storage notice: blocked ${failure} in ${lang} keeps building usable without saving`, async ({ page, context, hasTouch }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(({ failure }) => {
        if (failure === 'access') {
          Object.defineProperty(window, 'localStorage', {
            get() { throw new DOMException('Storage access denied', 'SecurityError'); },
          });
        } else {
          // Reads work, but writes fail (e.g. quota exhaustion/private browsing).
          Storage.prototype.setItem = function () {
            throw new DOMException('Storage is full', 'QuotaExceededError');
          };
        }
      }, { failure });
      await open(page, lang);
      const notice = page.getByTestId('storage-notice');
      await expect(notice).toBeVisible();
      await expect(notice).toHaveAttribute('role', 'alert');
      await expect(notice).toHaveText(UI[lang].storageFail);
      await expect(notice.getByRole('button')).toHaveCount(0);
      await count(page, 0);
      await place(page, 1, hasTouch);
      await expect(page.getByTestId('step-title')).toHaveText(lesson.steps[1].title[lang]);
      await expect(notice).toBeVisible();
      await page.getByTestId('language').click();
      await expect(notice).toHaveText(UI[lang === 'ar' ? 'en' : 'ar'].storageFail);
      await count(page, 1);
      if (failure === 'write') expect(await saved(page)).toEqual({});
      await page.reload();
      await count(page, 0);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText(UI.ar.storageFail);
      await place(page, 1, hasTouch);
      expect(errors).toEqual([]);
    });
  }

  for (const invalid of ['malformed JSON', 'stale version'] as const) {
    test(`storage notice: ${invalid} in ${lang} is discarded and fresh progress persists`, async ({ page, context, hasTouch }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const raw = invalid === 'malformed JSON' ? '{"placed":[' : JSON.stringify({
        ...createProgress(lesson, lang === 'ar' ? 'en' : 'ar'),
        // A structurally valid completed save, with only its version obsolete.
        version: lesson.version - 1,
        placed: lesson.steps.map(step => step.id),
        hintsUsed: 7,
        tested: true,
      });
      await context.addInitScript(({ progressKey, languageKey, raw, lang }) => {
        // Seed once, not on reload: later assertions must inspect the app's writes.
        if (sessionStorage.getItem('storage-regression-seeded')) return;
        localStorage.setItem(progressKey, raw);
        localStorage.setItem(languageKey, lang);
        sessionStorage.setItem('storage-regression-seeded', 'yes');
      }, { progressKey, languageKey, raw, lang });
      await page.goto('./');
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      const notice = page.getByTestId('storage-notice');
      await expect(notice).toBeVisible();
      await expect(notice).toHaveAttribute('role', 'alert');
      await expect(notice).toContainText(UI[lang].storageDiscarded);
      await count(page, 0);
      await expect(page.getByTestId('hints-used')).toHaveText(UI[lang].hintsUsed(0));
      await expect(page.getByTestId('status-tested')).toHaveCount(0);
      await expect(page.getByTestId('step-title')).toHaveText(lesson.steps[0].title[lang]);
      await expect.poll(async () => JSON.parse((await saved(page))[progressKey])).toEqual(createProgress(lesson, lang));
      // Dismissal is available only for discarded data and must not affect progress.
      await notice.getByRole('button', { name: UI[lang].close, exact: true }).click();
      await expect(notice).toHaveCount(0);
      await place(page, 1, hasTouch);
      const expected = { ...createProgress(lesson, lang), placed: [lesson.steps[0].id] };
      await expect.poll(async () => JSON.parse((await saved(page))[progressKey])).toEqual(expected);
      await page.reload();
      await count(page, 1);
      await expect(notice).toHaveCount(0);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByTestId('step-title')).toHaveText(lesson.steps[1].title[lang]);
      await expect(page.getByTestId('status-tested')).toHaveCount(0);
      await place(page, 2, hasTouch);
      expect(errors).toEqual([]);
    });
  }
}

// Assert real keyboard traversal, including both boundary wraps. Do not focus
// elements inside the modal: that would hide broken initial focus or tab order.
async function trappedTabOrder(page: Page, controls: Locator[], initial = 0) {
  await expect(controls[initial]).toBeFocused();
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let step = 1; step <= controls.length * 2; step++) {
      await page.keyboard.press(key);
      const offset = key === 'Tab' ? step : -step;
      const index = ((initial + offset) % controls.length + controls.length) % controls.length;
      await expect(controls[index]).toBeFocused();
    }
  }
}

for (const lang of ['en', 'ar'] as const) {
  test(`reset and reference dialog keyboard focus in ${lang}`, async ({ page }) => {
    await open(page, lang);
    await place(page, 1);
    const original = await saved(page);
    for (const kind of ['reset', 'reference'] as const) {
      const opener = page.getByTestId(kind);
      const dialog = page.getByTestId(`dialog-${kind}`);
      const close = page.getByTestId(`dialog-${kind}-close`);
      await opener.focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveAccessibleName(kind === 'reset' ? UI[lang].resetTitle : UI[lang].referenceTitle);
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(close).toHaveAccessibleName(UI[lang].close);
      const controls = kind === 'reset'
        ? [close, page.getByTestId('reset-cancel'), page.getByTestId('reset-confirm')]
        : [close];
      await trappedTabOrder(page, controls, kind === 'reset' ? 1 : 0);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await count(page, 1);
      expect(await saved(page)).toEqual(original);

      // Reopening also catches stale listeners and lost restoration targets.
      await page.keyboard.press('Space');
      await expect(controls[kind === 'reset' ? 1 : 0]).toBeFocused();
      await page.keyboard.press('Enter'); // Safe cancel or reference close.
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(await saved(page)).toEqual(original);
    }
  });

  test(`completion dialog keyboard focus, reflection and replay in ${lang}`, async ({ page }) => {
    await open(page, lang);
    for (let n = 1; n <= 14; n++) await place(page, n);
    const opener = page.getByTestId('run-motor');
    const dialog = page.getByTestId('dialog-complete');
    const close = page.getByTestId('dialog-complete-close');
    const choices = UI[lang].answers.map((_, i) => page.getByTestId(`reflection-option-${i + 1}`));
    const replay = page.getByTestId('replay');
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveAccessibleName(UI[lang].doneTitle);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await trappedTabOrder(page, [
      close, ...choices, dialog.getByRole('button', { name: UI[lang].close, exact: true }).last(), replay,
    ]);
    const completed = await saved(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await saved(page)).toEqual(completed);

    await page.keyboard.press('Space'); // Stop, then start to reopen completion.
    await expect(opener).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');
    await expect(close).toBeFocused();
    await expect(page.getByTestId('reflection-feedback')).toBeEmpty();
    for (let i = 0; i < choices.length; i++) {
      await page.keyboard.press('Tab');
      await expect(choices[i]).toBeFocused();
      await expect(choices[i]).toContainText(UI[lang].answers[i]);
      await page.keyboard.press(i % 2 === 0 ? 'Space' : 'Enter');
      for (let j = 0; j < choices.length; j++) {
        await expect(choices[j]).toHaveAttribute('aria-pressed', String(i === j));
      }
      await expect(page.getByTestId('reflection-feedback')).toHaveText(i === 0 ? UI[lang].correct : UI[lang].tryAgain);
      await expect(choices[i]).toBeFocused();
    }
    await page.keyboard.press('Tab'); // Footer close.
    await page.keyboard.press('Tab');
    await expect(replay).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(opener).toHaveAttribute('aria-pressed', 'true');
    await count(page, 14);
    await expect(page.getByTestId('status-tested')).toBeVisible();
    expect(await saved(page)).toEqual(completed);
  });

  test(`all 14 stages in ${lang}, motor and visible gear ratios`, async ({ page, isMobile, hasTouch }) => {
    await open(page, lang);
    await count(page, 0);
    await page.getByTestId('run-motor').click();
    await expect(page.getByTestId('run-motor')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('status-tested')).toHaveCount(0);
    for (let n = 1; n <= 14; n++) {
      await expect(page.getByTestId('step-title')).toHaveText(lesson.steps[n - 1].title[lang]);
      await expect(page.getByTestId('placement-target')).toHaveAccessibleName(UI[lang].placeHere(lesson.steps[n - 1].title[lang]));
      await place(page, n, hasTouch);
      await expect(page.getByTestId(`part-set-${n}`)).toBeDisabled();
      await expect(page.getByTestId(`stage-${n}`)).toHaveClass('done');
      await expect(page.getByTestId('build-mat').getByTestId(`model-layer-${lesson.steps[n - 1].svgLayer.id}`)).toBeVisible();
    }
    await expect(page.getByTestId('placement-target')).toHaveCount(0);
    if (hasTouch || isMobile) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await expect(page.getByTestId('gear-ratio')).toContainText('12:36');
    await page.getByTestId('run-motor').click();
    await expect(page.getByTestId('status-tested')).toBeVisible();
    // Read actual rendered SVG angles atomically, not the pure engine's output.
    const angles = () => page.getByTestId('build-mat').evaluate(mat => {
      const angle = (layer: string, index = 0) => {
        const el = mat.querySelectorAll(`[data-testid="model-layer-${layer}"] g[transform^="rotate("]`)[index];
        if (!el) throw new Error(`Missing rotating ${layer}`);
        return Number(el.getAttribute('transform')!.match(/rotate\(([-\d.e+]+)/)![1]);
      };
      return { driver: angle('motor', 1), driven: angle('gears'), axle: angle('upper'), rotor: angle('blades') };
    });
    const before = await angles();
    await expect.poll(async () => (await angles()).driver).toBeGreaterThan(before.driver + 10);
    const after = await angles();
    const delta = (key: keyof typeof before) => after[key] - before[key];
    expect(delta('driver')).toBeGreaterThan(0);
    expect(delta('driven')).toBeLessThan(0);
    expect(delta('driver') / delta('driven')).toBeCloseTo(-3, 3);
    expect(delta('axle')).toBeCloseTo(delta('driven'), 3);
    expect(delta('rotor')).toBeCloseTo(delta('driven'), 3);
    await expect(page.getByTestId('dialog-complete')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('run-motor').click();
    const stopped = await angles();
    await page.waitForTimeout(100); // Explicitly verify that stopped transforms stay fixed.
    expect(await angles()).toEqual(stopped);
    await page.reload();
    await count(page, 14);
    await expect(page.getByTestId('status-tested')).toBeVisible();
    await expect(page.getByTestId('run-motor')).toHaveAttribute('aria-pressed', 'false');
  });
}

test('keyboard placement rejects wrong sets and restores language/progress', async ({ page }) => {
  await open(page);
  await page.getByTestId('part-set-2').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('placement-target').focus();
  await page.keyboard.press('Space');
  await count(page, 0);
  await expect(page.getByTestId('feedback')).toHaveText(UI.en.wrongSet);
  await page.getByTestId('part-set-1').focus();
  await page.keyboard.press('Space');
  await page.getByTestId('placement-target').focus();
  await page.keyboard.press('Enter');
  await count(page, 1);
  await page.getByTestId('language').click();
  await page.reload();
  await count(page, 1);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('step-title')).toHaveText(lesson.steps[1].title.ar);
  await page.getByTestId('language').click();
  await page.reload();
  await count(page, 1);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('real pointer drag places only on the target', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'Touch uses tap placement, covered by both full builds.');
  await open(page);
  const part = page.getByTestId('part-set-1');
  const target = page.getByTestId('placement-target');
  await part.scrollIntoViewIfNeeded();
  const source = (await part.boundingBox())!;
  const dest = (await target.boundingBox())!;
  const drag = async (x: number, y: number) => {
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 12 });
    await page.mouse.up();
  };
  await drag(dest.x - 20, dest.y - 20);
  await count(page, 0);
  await expect(page.getByTestId('feedback')).toHaveText(UI.en.wrongTarget);
  await drag(dest.x + dest.width / 2, dest.y + dest.height / 2);
  await count(page, 1);
});

test('demo never overwrites student progress or tested state', async ({ page }) => {
  await open(page);
  await place(page, 1);
  await page.getByTestId('hint').click();
  const original = await saved(page);
  await page.getByTestId('demo').click();
  await count(page, 0);
  await page.getByTestId('demo-next').click();
  await count(page, 1);
  await page.getByTestId('demo-prev').click();
  await count(page, 0);
  await page.getByTestId('demo-complete').click();
  await count(page, 14);
  await page.getByTestId('run-motor').click();
  await expect(page.getByTestId('run-motor')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('reset')).toBeDisabled();
  expect(await saved(page)).toEqual(original);
  await page.getByTestId('demo').click();
  await count(page, 1);
  await expect(page.getByTestId('status-tested')).toHaveCount(0);
  expect(await saved(page)).toEqual(original);
  await page.getByTestId('demo').click();
  await page.getByTestId('demo-complete').click();
  await page.reload();
  await count(page, 1);
  await expect(page.getByTestId('demo')).toHaveAttribute('aria-pressed', 'false');
  expect(await saved(page)).toEqual(original);
});

test('reset requires confirmation and persists only after confirmation', async ({ page }) => {
  await open(page, 'ar');
  await place(page, 1);
  await page.getByTestId('hint').click();
  const original = await saved(page);
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('dialog-reset')).toBeVisible();
  await page.getByTestId('reset-cancel').click();
  await count(page, 1);
  expect(await saved(page)).toEqual(original);
  await page.getByTestId('reset').click();
  await page.keyboard.press('Escape');
  await count(page, 1);
  await page.reload();
  expect(await saved(page)).toEqual(original);
  await page.getByTestId('reset').click();
  await page.getByTestId('reset-confirm').click();
  await expect(page.getByTestId('dialog-reset')).toHaveCount(0);
  await count(page, 0);
  await expect(page.getByTestId('hints-used')).toHaveText(UI.ar.hintsUsed(0));
  await page.reload();
  await count(page, 0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByTestId('part-set-1')).toBeEnabled();
});
