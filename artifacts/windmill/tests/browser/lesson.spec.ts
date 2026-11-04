import { test as base, expect, type Page } from '@playwright/test';
import { windmillLesson as lesson } from '../../src/data/lessons/windmill';
import { UI } from '../../src/i18n/ui';

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

for (const lang of ['en', 'ar'] as const) {
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
