import { describe, it, expect } from 'vitest';
import { englishReadiness, lessonVideo, parseLessonMedia } from '@/lib/learning-readiness';

const lesson = {
  titleEn: 'Shapes', descAr: 'وصف', descEn: 'Description',
  videoUrl: 'https://youtu.be/original', videoType: 'youtube', videoLanguage: 'unknown',
  exercises: [{ promptEn: 'Choose red', options: ['أحمر'], optionsEn: ['Red'] }],
};

describe('English curriculum readiness', () => {
  it('never treats legacy or Arabic-only videos as English', () => {
    for (const videoLanguage of [undefined, 'unknown', 'ar']) {
      expect(lessonVideo({ ...lesson, videoLanguage }, true).url).toBeNull();
      expect(lessonVideo({ ...lesson, videoLanguage }, false).url).toBe(lesson.videoUrl);
    }
    expect(englishReadiness(lesson)).toEqual({ text: true, video: 'unknown' });
    expect(englishReadiness({ ...lesson, videoLanguage: 'ar' }).video).toBe('arabic');
  });
  it('prefers an English alternative with its own player type', () => {
    const alternate = { ...lesson, videoUrlEn: 'https://example.com/english.mp4', videoTypeEn: 'mp4' };
    expect(lessonVideo(alternate, true)).toEqual({ url: alternate.videoUrlEn, type: 'mp4' });
    expect(lessonVideo(alternate, false)).toEqual({ url: lesson.videoUrl, type: 'youtube' });
    expect(englishReadiness(alternate).video).toBe('ready');
  });
  it('supports English and bilingual originals, and lessons without video', () => {
    for (const videoLanguage of ['en', 'bilingual'])
      expect(englishReadiness({ ...lesson, videoLanguage }).video).toBe('ready');
    expect(englishReadiness({ ...lesson, videoUrl: null }).video).toBe('none');
  });
  it('checks all teaching text without changing canonical options', () => {
    expect(englishReadiness({ ...lesson, titleEn: ' ' }).text).toBe(false);
    expect(englishReadiness({ ...lesson, descEn: '' }).text).toBe(false);
    expect(englishReadiness({ ...lesson, exercises: [{ ...lesson.exercises[0], promptEn: '' }] }).text).toBe(false);
    expect(englishReadiness({ ...lesson, exercises: [{ ...lesson.exercises[0], optionsEn: [] }] }).text).toBe(false);
    expect(lesson.exercises[0].options).toEqual(['أحمر']);
  });
  it('validates media writes and distinguishes omission from clearing', () => {
    expect(parseLessonMedia({})).toEqual({});
    expect(parseLessonMedia({ videoUrlEn: ' ' })).toEqual({ videoUrlEn: null });
    expect(parseLessonMedia({ videoUrlEn: null })).toEqual({ videoUrlEn: null });
    expect(parseLessonMedia({ videoLanguage: 'en', videoTypeEn: 'vimeo' })).toEqual({ videoLanguage: 'en', videoTypeEn: 'vimeo' });
    for (const body of [{ videoLanguage: 'French' }, { videoTypeEn: 'html' }, { videoUrlEn: 'javascript:alert(1)' }, { videoUrlEn: 1 }])
      expect(() => parseLessonMedia(body)).toThrow();
  });
});
