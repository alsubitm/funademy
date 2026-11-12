import type { KnowledgeSource } from './chat-knowledge';

type Message = { role: string; content: string };
export type NujaymLocale = 'ar' | 'en';

const normalize = (text: string) => text.toLowerCase()
  .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))
  .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776))
  .replace(/[\u064b-\u065f]/g, '');

export function responseLocale(text: string, fallback: string): NujaymLocale {
  return /[\u0600-\u06ff]/.test(text) ? 'ar' : /[a-z]/i.test(text) ? 'en' : fallback === 'en' ? 'en' : 'ar';
}

export function childAge(question: string, history: Message[]): number | null {
  for (const message of [{ role: 'user', content: question }, ...[...history].reverse()]) {
    if (message.role !== 'user') continue;
    const text = normalize(message.content);
    const match = text.match(/(?:عمر(?:ه|ها|ي)?|age(?:d)?|is)\s*[:=]?\s*(\d{1,2})\b|(\d{1,2})[\s-]*(?:سنوات|سنة|سنين|years? old|year.old|yo)/);
    if (match) return Number(match[1] ?? match[2]);
    if (/^\d{1,2}$/.test(text.trim())) return Number(text.trim());
  }
  return null;
}

export function isRecommendation(question: string, history: Message[]) {
  const text = normalize(question);
  return /يناسب|يناسبه|طفلي|ولدي|بنتي|recommend|suitable|my (?:child|son|daughter)|عمر/.test(text) ||
    (/^\d{1,2}$/.test(text.trim()) && history.some(m => /عمر|how old/i.test(m.content)));
}

/** Restrict recommendations to published age ranges, even when retrieval terms
 * would otherwise favor an older robotics programme. Never infer ranges. */
export function recommendationSources(question: string, history: Message[], all: KnowledgeSource[]) {
  const age = childAge(question, history);
  const interest = normalize([question, ...history.filter(m => m.role === 'user').slice(-3).map(m => m.content)].join(' '));
  const robotics = /robot|روبوت/.test(interest);
  const coding = /cod|programming|برمج/.test(interest);
  return all.filter(s => s.type === 'program' && age !== null &&
      s.ageMin !== undefined && s.ageMax !== undefined && age >= s.ageMin && age <= s.ageMax)
    .sort((a, b) => {
      const score = (s: KnowledgeSource) => (robotics && /robot|روبوت/i.test(s.text) ? 2 : 0) +
        (coding && /cod|برمج/i.test(s.text) ? 2 : 0);
      return score(b) - score(a);
    }).slice(0, 3);
}

const gear = {
  ar: {
    question: 'تحدّي تروس: تخيّل ترسين متلامسين مباشرة. إذا دار الأول مع عقارب الساعة، بأي اتجاه يدور الثاني؟',
    hint: 'تلميح التروس: الأسنان المتلامسة تدفع بعضها. تخيّل نقطة التلامس؛ هل يتحرك الترسان في الاتجاه نفسه أم اتجاهين متعاكسين؟ جرّب مرة ثانية!',
    success: 'صح عليك! الترسان المتلامسان يدوران باتجاهين متعاكسين؛ أسنان الأول تدفع أسنان الثاني، فيدور الثاني عكس عقارب الساعة. نجمتك تستاهل تلمع!',
  },
  en: {
    question: 'Gear challenge: imagine two gears meshing directly. If the first turns clockwise, which direction does the second turn?',
    hint: 'Gear hint: the touching teeth push each other. Picture their contact point: do the gears turn the same way or in opposite directions? Try again!',
    success: 'You got it! Meshing gears turn in opposite directions: the first gear’s teeth push the second, so it turns counterclockwise. You earned a glowing star!',
  },
};

export function gearReply(question: string, history: Message[], locale: NujaymLocale): { text: string; celebrate: boolean } | null {
  const text = normalize(question);
  if (/(?:تحدي|challenge).*(?:تروس|gear)|(?:gear|engineering).*(?:challenge)|تحدي هندس/.test(text))
    return { text: gear[locale].question, celebrate: false };
  const last = [...history].reverse().find(m => m.role === 'assistant');
  const pending = last && Object.values(gear).some(g => last.content === g.question || last.content === g.hint);
  if (!pending) return null;
  // A new unrelated request exits the activity instead of swallowing bookings.
  if (/احجز|أحجز|حجز|book|trial|يناسب|recommend|رسوم|price/.test(text)) return null;
  const opposite = /opposite|counter.?clockwise|anti.?clockwise|عكس|متعاكس|يسار/.test(text);
  const negated = /(?:not|isn't|isnt)\s+(?:the\s+)?(?:opposite|counter)|ليس.*(?:عكس|متعاكس)|مو\s+(?:عكس|متعاكس)/.test(text);
  const correct = (opposite && !negated) || /not (?:the )?same|مو نفس|ليس.*نفس/.test(text);
  return { text: correct ? gear[locale].success : gear[locale].hint, celebrate: correct };
}
