import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  programs: vi.fn(),
  runs: vi.fn(),
  slots: vi.fn(),
  faqs: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    program: { findMany: db.programs },
    courseRun: { findMany: db.runs },
    scheduleSlot: { findMany: db.slots },
    faqEntry: { findMany: db.faqs },
  },
}));

import { selectKnowledge } from '@/lib/chat-knowledge';
let buildLiveKnowledge: typeof import('@/lib/chat-knowledge').buildLiveKnowledge;
import { recommendationSources } from '@/lib/nujaym';

const storedProgram = (ageMin: number, ageMax: number) => ({
  id: 17,
  ageMin,
  ageMax,
  nameAr: 'برنامج البناء',
  nameEn: 'Creative Building',
  format: 'online',
  descAr: 'أنشطة بناء وهندسة',
  descEn: 'Building and engineering activities',
});

beforeEach(async () => {
  vi.resetModules();
  ({ buildLiveKnowledge } = await import('@/lib/chat-knowledge'));
  vi.resetAllMocks();
  db.programs.mockResolvedValue([]);
  db.runs.mockResolvedValue([]);
  db.slots.mockResolvedValue([]);
  db.faqs.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe('live chat knowledge retrieval', () => {
  it('refreshes the catalogue after the one-minute cache expires', async () => {
    db.programs.mockResolvedValueOnce([storedProgram(6, 8)]).mockResolvedValueOnce([storedProgram(9, 12)]);

    const firstSnapshot = await buildLiveKnowledge();
    expect(recommendationSources('My 8-year-old likes building.', [], firstSnapshot)
      .map(({ id, ageMin, ageMax }) => ({ id, ageMin, ageMax })))
      .toEqual([{ id: 'program:17', ageMin: 6, ageMax: 8 }]);

    expect(await buildLiveKnowledge()).toBe(firstSnapshot);
    expect(db.programs).toHaveBeenCalledTimes(1);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    const changedSnapshot = await buildLiveKnowledge();
    expect(selectKnowledge('Creative Building', changedSnapshot)
      .map(({ id, ageMin, ageMax }) => ({ id, ageMin, ageMax })))
      .toEqual([{ id: 'program:17', ageMin: 9, ageMax: 12 }]);
    expect(recommendationSources('My 8-year-old likes building.', [], changedSnapshot)).toEqual([]);
    expect(recommendationSources('My 10-year-old likes building.', [], changedSnapshot)
      .map(source => source.id)).toEqual(['program:17']);
    expect(db.programs).toHaveBeenCalledTimes(2);
  });
  it('shares a concurrent cache miss and retries failures instead of caching them', async () => {
    db.programs.mockRejectedValueOnce(new Error('offline'));
    await expect(buildLiveKnowledge()).rejects.toThrow('offline');
    const [first, second] = await Promise.all([buildLiveKnowledge(), buildLiveKnowledge()]);
    expect(first).toBe(second);
    expect(db.programs).toHaveBeenCalledTimes(2);
  });
});
