import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ProgramPricing } from '@/app/(ar)/programs/[slug]/ProgramPricing';
import { loadProgramPricing, type ProgramPricingRun } from '@/lib/program-pricing';
import { arabicDigits } from '@/lib/constants';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { courseRun: { findMany } } }));

const run = (id: number, monthlyPriceSar: number): ProgramPricingRun => ({
  id, monthlyPriceSar, titleAr: `دورة ${id}`, titleEn: `Run ${id}`,
  startDate: new Date('2026-12-01T00:00:00Z'),
  weekday: 2, time: '17:00', format: 'online', location: null,
});
const render = (runs: ProgramPricingRun[] | null, lang: 'ar' | 'en') =>
  renderToStaticMarkup(createElement(ProgramPricing, { runs, lang }));

beforeEach(() => vi.clearAllMocks());

describe('program tuition uses enrollment course-run prices', () => {
  it('queries only this program’s active, unexpired runs with seats', async () => {
    const now = new Date('2026-11-01T00:00:00Z');
    findMany.mockResolvedValue([run(1, 725)]);
    expect(await loadProgramPricing(42, now)).toEqual([run(1, 725)]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { programId: 42, active: true, endDate: { gte: now }, seatsLeft: { gt: 0 } },
      select: expect.objectContaining({ monthlyPriceSar: true }),
    }));
  });

  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: displays each selected available run’s exact monthly base price`, async () => {
      const runs = [run(11, 725), run(12, 1425.5)];
      findMany.mockResolvedValue(runs);
      const html = render(await loadProgramPricing(42), lang);
      for (const selectedRun of runs) {
        const block = html.split(`data-course-run-id="${selectedRun.id}"`)[1].split('data-course-run-id=')[0];
        expect(block).toContain(lang === 'ar' ? arabicDigits(selectedRun.monthlyPriceSar) : String(selectedRun.monthlyPriceSar));
      }
      expect(html).toContain(lang === 'ar' ? 'طفل / شهر' : 'child / month');
      expect(html).not.toMatch(/1380|٣٣٠|٣٨٠/);
    });

    it(`${lang}: preserves a zero fee and same-price runs`, () => {
      const html = render([run(1, 0), run(2, 0)], lang);
      expect(html.match(/data-course-run-id=/g)).toHaveLength(2);
      expect(html).toContain(lang === 'ar' ? '٠ <small>' : '0 <small>');
    });

    it(`${lang}: no runs shows availability guidance, not a fabricated price`, () => {
      const html = render([], lang);
      expect(html).toContain(lang === 'ar' ? 'لا توجد دورات' : 'No course runs');
      expect(html).not.toContain('class="amt"');
    });
  }

  it('query failure is contact guidance, not a claim that no runs exist', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    findMany.mockRejectedValueOnce(new Error('offline'));
    const runs = await loadProgramPricing(42);
    expect(runs).toBeNull();
    expect(render(runs, 'en')).toContain('Contact us for program pricing');
    log.mockRestore();
  });

  for (const page of ['(ar)/programs/[slug]', 'en/programs/[slug]']) {
    it(`${page} loads current prices and passes them to the detail`, () => {
      const src = readFileSync(new URL(`../app/${page}/page.tsx`, import.meta.url), 'utf8');
      expect(src).toContain('loadProgramPricing(program.id)');
      expect(src).toContain('pricingRuns={pricingRuns}');
      expect(src).toContain('revalidate = 0');
    });
  }
});
