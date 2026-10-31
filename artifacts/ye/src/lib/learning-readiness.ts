import { hasEnglishOptions } from './learning-options';

export interface LessonMedia {
  videoUrl?: string | null;
  videoType: string;
  videoLanguage?: string;
  videoUrlEn?: string | null;
  videoTypeEn?: string;
}

export function lessonVideo(lesson: LessonMedia, english: boolean) {
  if (!english) return { url: lesson.videoUrl, type: lesson.videoType };
  if (lesson.videoUrlEn?.trim()) return { url: lesson.videoUrlEn, type: lesson.videoTypeEn ?? 'youtube' };
  if (lesson.videoLanguage === 'en' || lesson.videoLanguage === 'bilingual')
    return { url: lesson.videoUrl, type: lesson.videoType };
  return { url: null, type: lesson.videoType };
}

export function englishReadiness(lesson: LessonMedia & {
  titleEn: string; descAr?: string | null; descEn?: string | null;
  exercises: { promptEn: string; options: string[]; optionsEn: string[] }[];
}) {
  const text = Boolean(lesson.titleEn.trim()) &&
    (!lesson.descAr?.trim() || Boolean(lesson.descEn?.trim())) &&
    lesson.exercises.every(ex => Boolean(ex.promptEn.trim()) && hasEnglishOptions(ex.options, ex.optionsEn));
  const video = lessonVideo(lesson, true).url ? 'ready' :
    lesson.videoUrl?.trim() ? (lesson.videoLanguage === 'ar' ? 'arabic' : 'unknown') : 'none';
  return { text, video };
}

/** Partial updates preserve omitted fields; empty URLs explicitly clear them. */
export function parseLessonMedia(body: Record<string, unknown>) {
  const data: { videoLanguage?: string; videoUrlEn?: string | null; videoTypeEn?: 'youtube' | 'vimeo' | 'mp4' } = {};
  if ('videoLanguage' in body) {
    if (!['unknown', 'ar', 'en', 'bilingual'].includes(String(body.videoLanguage))) throw new Error('invalid video language');
    data.videoLanguage = String(body.videoLanguage);
  }
  if ('videoTypeEn' in body) {
    if (!['youtube', 'vimeo', 'mp4'].includes(String(body.videoTypeEn))) throw new Error('invalid English video type');
    data.videoTypeEn = body.videoTypeEn as 'youtube' | 'vimeo' | 'mp4';
  }
  if ('videoUrlEn' in body) {
    if (body.videoUrlEn !== null && typeof body.videoUrlEn !== 'string') throw new Error('invalid English video URL');
    const url = (body.videoUrlEn as string | null)?.trim();
    if (url && !/^https?:\/\//i.test(url)) throw new Error('English video URL must use HTTP or HTTPS');
    if (url) { try { new URL(url); } catch { throw new Error('invalid English video URL'); } }
    data.videoUrlEn = url || null;
  }
  return data;
}
