import { describe, expect, it } from 'vitest';
import { childAge, gearReply, isRecommendation, recommendationSources, responseLocale } from '@/lib/nujaym';
import type { KnowledgeSource } from '@/lib/chat-knowledge';

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
    const fixture = (id: string, ageMin: number, ageMax: number): KnowledgeSource => ({
      id, ageMin, ageMax, type:'program', title:id, titleAr:id, titleEn:id, url:'/programs', text:'robot robotics',
    });
    const selected = recommendationSources('ولدي عمره ٨ ويحب الروبوتات', [], [
      fixture('program:1', 9, 12), fixture('program:2', 6, 10), fixture('program:3', 13, 18),
    ]);
    expect(selected.map(s=>s.id)).toEqual(['program:2']);
    expect(recommendationSources('Which programme?', [], [fixture('program:2',6,10)])).toEqual([]);
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
