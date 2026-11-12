import { describe, expect, it } from 'vitest';
import { childAge, gearReply, isRecommendation, recommendationSources, responseLocale } from '@/lib/nujaym';
import type { KnowledgeSource } from '@/lib/chat-knowledge';

const program = (id: string, ageMin: number, ageMax: number, text = 'creative building'): KnowledgeSource => ({
  id, ageMin, ageMax, type: 'program', title: id, titleAr: id, titleEn: id, url: '/programs', text,
});

describe('Nujaym conversation rules', () => {
  it('uses message language, including English inside Arabic sessions', () => {
    expect(responseLocale('How do I book?', 'ar')).toBe('en');
    expect(responseLocale('كيف أحجز؟', 'en')).toBe('ar');
    expect(responseLocale('8', 'en')).toBe('en');
  });
  it('extracts Arabic/English ages and preserves conversational context', () => {
    expect(childAge('ولدي عمره ٨ ويحب الروبوتات، وش يناسبه؟', [])).toBe(8);
    expect(childAge('My 8-year-old likes robots', [])).toBe(8);
    expect(childAge('How do I book?', [{role:'user',content:'My son is 8'}])).toBe(8);
    expect(childAge('عمرها ٦', [{role:'user',content:'عمره ٨'}])).toBe(6);
    expect(isRecommendation('وش يناسب طفلي؟', [])).toBe(true);
  });
  it('never includes a programme outside published ages in recommendations', () => {
    const selected = recommendationSources('ولدي عمره ٨ ويحب الروبوتات', [], [
      program('program:1', 9, 12, 'robot robotics'),
      program('program:2', 6, 10, 'robot robotics'),
      program('program:3', 13, 18, 'robot robotics'),
    ]);
    expect(selected.map(source => source.id)).toEqual(['program:2']);
    expect(recommendationSources('Which programme?', [], [program('program:2', 6, 10)])).toEqual([]);
  });
  it.each([
    ['Arabic-Indic digits', 'ولدي عمره ٨ ويحب البناء', 8],
    ['Persian digits', 'پسرم age ۸ likes building', 8],
  ])('extracts ages written with %s', (_label, text, expectedAge) => {
    expect(childAge(text, [])).toBe(expectedAge);
  });
  it('uses the latest stored child context and excludes sibling-age robotics tracks', () => {
    const storedMessages = [
      { role: 'user', content: 'My son is 12 and loves robotics.' },
      { role: 'assistant', content: 'What does your daughter enjoy?' },
      { role: 'user', content: 'My daughter is 8 and likes building.' },
      { role: 'assistant', content: 'Would she like robotics too?' },
    ];
    const catalogue = [
      program('program:robotics', 9, 12, 'robot robotics engineering'),
      program('program:building', 6, 8, 'creative building engineering'),
    ];

    expect(childAge('She loves robotics—what programme suits her?', storedMessages)).toBe(8);
    expect(recommendationSources('She loves robotics—what programme suits her?', storedMessages, catalogue)
      .map(source => source.id)).toEqual(['program:building']);
  });
  it('returns no recommendation when no published programme fits the stored age', () => {
    const catalogue = [
      program('program:younger', 4, 7),
      program('program:older', 9, 12, 'robot robotics'),
      { ...program('program:missing-range', 1, 18), ageMin: undefined, ageMax: undefined },
      { ...program('run:1', 8, 8), type: 'run' as const },
    ];

    expect(recommendationSources('My 8-year-old likes robots. What fits?', [], catalogue)).toEqual([]);
  });
  it('never recommends a robotics programme outside its published age range', () => {
    const selected = recommendationSources('My 8-year-old likes robotics', [], [
      program('program:robotics', 9, 12, 'robot robotics'),
      program('program:building', 6, 10, 'creative building'),
    ]);
    expect(selected.map(source => source.id)).toEqual(['program:building']);
  });
  it('gives hints, celebrates once, and accepts free-text direction explanations', () => {
    const start = gearReply('تحدّي تروس', [], 'ar')!;
    const history = [{role:'assistant',content:start.text}];
    expect(gearReply('نفس الاتجاه',history,'ar')?.celebrate).toBe(false);
    const win = gearReply('يدور عكس اتجاه الأول لأن الأسنان تدفعه',history,'ar')!;
    expect(win.celebrate).toBe(true);
    expect(gearReply('عكس', [{role:'assistant',content:win.text}], 'ar')).toBeNull();
    expect(gearReply('كيف أحجز؟',history,'ar')).toBeNull();
    expect(gearReply('not opposite',history,'en')?.celebrate).toBe(false);
    expect(gearReply('counterclockwise',history,'en')?.celebrate).toBe(true);
  });
});
