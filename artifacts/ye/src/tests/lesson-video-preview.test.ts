import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LessonVideoPreview from '../components/admin/LessonVideoPreview';
import { safeHttpUrl, toYoutubeEmbed, toVimeoEmbed } from '../lib/lesson-video';
import { englishReadiness } from '../lib/learning-readiness';

describe('author video preview', () => {
  it('uses the family embed URLs for supported providers', () => {
    expect(toYoutubeEmbed('https://youtu.be/abcdefghijk')).toBe('https://www.youtube-nocookie.com/embed/abcdefghijk?rel=0');
    expect(toYoutubeEmbed('https://www.youtube.com/watch?v=abcdefghijk')).toBe(toYoutubeEmbed('https://youtu.be/abcdefghijk'));
    expect(toVimeoEmbed('https://vimeo.com/12345')).toBe('https://player.vimeo.com/video/12345');
    expect(toVimeoEmbed('https://player.vimeo.com/video/12345')).toBe(toVimeoEmbed('https://vimeo.com/12345'));
  });

  it('rejects malformed and lookalike provider links', () => {
    expect(toYoutubeEmbed('https://youtube.com.evil.example/watch?v=abcdefghijk')).toBeNull();
    expect(toYoutubeEmbed('https://youtu.be/invalid')).toBeNull();
    expect(toVimeoEmbed('https://example.com/12345')).toBeNull();
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('not a URL')).toBeNull();
  });

  for (const label of ['الفيديو الأصلي', 'الفيديو الإنجليزي البديل']) {
    it(`offers an opt-in preview without loading external media: ${label}`, () => {
      const html = renderToStaticMarkup(createElement(LessonVideoPreview, { url: 'https://youtu.be/abcdefghijk', type: 'youtube', label }));
      expect(html).toContain(label);
      expect(html).toContain('معاينة الفيديو');
      expect(html).toContain('فتح المصدر');
      expect(html).not.toContain('<iframe');
      expect(html).toContain('وليست فحصاً لتوفر الفيديو');
    });
  }

  it('shows actionable invalid-link errors and handles absent optional video', () => {
    const invalid = renderToStaticMarkup(createElement(LessonVideoPreview, { url: 'javascript:alert(1)', type: 'mp4', label: 'video' }));
    expect(invalid).toContain('role="alert"');
    expect(invalid).not.toContain('href=');
    const empty = renderToStaticMarkup(createElement(LessonVideoPreview, { url: '', type: 'youtube', label: 'video' }));
    expect(empty).toContain('لم يُضف رابط');
    expect(empty).not.toContain('role="alert"');
  });

  it('keeps editorial language readiness independent of playback availability', () => {
    expect(englishReadiness({ titleEn: 'Lesson', exercises: [], videoUrl: 'https://youtu.be/unavailable', videoType: 'youtube', videoLanguage: 'en' }).video).toBe('ready');
  });
});
