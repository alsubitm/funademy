'use client';

import { useState } from 'react';
import { safeHttpUrl, toYoutubeEmbed, toVimeoEmbed } from '@/lib/lesson-video';

/** Key this component by URL/type so edits discard all previous preview state. */
export default function LessonVideoPreview({ url, type, label }: { url: string; type: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'unchecked' | 'playing' | 'error'>('unchecked');
  const safe = safeHttpUrl(url);
  const src = safe && (type === 'youtube' ? toYoutubeEmbed(url) : type === 'vimeo' ? toVimeoEmbed(url) : type === 'mp4' ? safe : null);
  if (!url.trim()) return <p style={{ fontSize: 12 }}>{label}: لم يُضف رابط للمعاينة.</p>;

  return (
    <section aria-label={`معاينة ${label}`} style={{ margin: '12px 0', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>{label}</strong>
      {!src ? (
        <p role="alert">الرابط غير صالح لنوع الفيديو المحدد. اختر النوع الصحيح واستخدم رابط مشاهدة YouTube أو Vimeo، أو رابط ملف MP4 مباشر يبدأ بـ https://.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="curr-add-btn" onClick={() => { setOpen(!open); setStatus('unchecked'); }}>
              {open ? 'إغلاق المعاينة' : 'معاينة الفيديو'}
            </button>
            {open && <button type="button" className="curr-add-btn" onClick={() => { setAttempt(x => x + 1); setStatus('unchecked'); }}>إعادة المحاولة</button>}
            <a href={safe!} target="_blank" rel="noopener noreferrer">فتح المصدر</a>
          </div>
          {open && (
            <>
              {type === 'mp4' ? (
                <video key={attempt} src={src} controls preload="metadata" aria-label={label}
                  style={{ width: '100%', marginTop: 12, maxHeight: 300 }}
                  onPlaying={() => setStatus('playing')} onError={() => setStatus('error')} />
              ) : (
                <iframe key={attempt} src={src} title={`معاينة ${label}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen
                  style={{ width: '100%', aspectRatio: '16 / 9', border: 0, marginTop: 12 }}
                  onError={() => setStatus('error')} />
              )}
              <p role="status">
                {status === 'error'
                  ? 'تعذر تشغيل المعاينة. تحقق من الرابط وصلاحية الوصول وإعدادات السماح بالتضمين، ثم أعد المحاولة. قد يكون السبب انقطاع الشبكة أو خدمة الفيديو؛ هذا لا يعني نقص الترجمة.'
                  : status === 'playing'
                    ? 'بدأ تشغيل الملف في هذه المعاينة. راجع الصوت واللغة والمحتوى قبل النشر.'
                    : 'اضغط تشغيل داخل المشغّل للتحقق من الفيديو والصوت. ظهور إطار المشغّل وحده لا يؤكد إمكانية التشغيل.'}
              </p>
              <p style={{ fontSize: 12 }}>إذا عرض المشغّل «غير متاح» أو «خاص»، صحح الرابط أو صلاحيات الفيديو. إذا رفض التضمين، اسمح بتضمينه على موقع المنصة أو استبدله. إذا تعطل المزود أو الاتصال، أعد المحاولة لاحقاً ولا تغيّر لغة الفيديو. فتح المصدر وحده لا يثبت أن التضمين يعمل.</p>
            </>
          )}
        </>
      )}
      <p style={{ fontSize: 12 }}>المعاينة لا تغيّر جاهزية الترجمة ولا تمنع الحفظ. الجاهزية تعتمد على اللغة التي يحددها المؤلف، وليست فحصاً لتوفر الفيديو.</p>
    </section>
  );
}
