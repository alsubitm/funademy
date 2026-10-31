'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLearningLocale } from '@/components/learning/locale';

interface HomeData {
  child: {
    id: number;
    name: string;
    avatar: string;
    band: string;
    xp: number;
    streak: number;
    badges: string[];
    dailyLimitMinutes: number | null;
  };
  continueLesson: {
    lessonId: number;
    titleAr: string;
    titleEn: string;
    subjectNameAr: string;
    subjectNameEn: string;
    subjectColor: string;
    subjectIcon: string;
  } | null;
  subjects: Array<{
    id: number;
    nameAr: string;
    nameEn: string;
    slug: string;
    icon: string;
    color: string;
    unitCount: number;
    lessonCount: number;
    progressPercent: number;
  }>;
  todayMinutes: number;
  dailyLimitReached: boolean;
}

const BADGE_ICONS: Record<string, string> = {
  first_lesson: '⭐', five_lessons: '🔥', ten_lessons: '🏆',
  streak_3: '⚡', streak_7: '💎', perfect_score: '🎯',
};

const BAND_LABELS: Record<string, string> = {
  explorers: 'المستكشفون', builders: 'الصانعون',
  achievers: 'المتفوقون', graduates: 'الخريجون',
};

export default function KidHomePage() {
  const { t, path, content } = useLearningLocale();
  const params = useParams<{ childId: string }>();
  const childId = params.childId;
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/svc/learn/home')
      .then((r) => {
        if (r.status === 401) { window.location.href = path('/learn'); return null; }
        if (r.status === 403) { setErr(t('لا يوجد تسجيل نشط', 'No active enrollment')); return null; }
        if (!r.ok) throw new Error(`home request failed (${r.status})`);
        return r.json();
      })
      .then((d) => {
        if (d && String(d.child?.id) !== childId) {
          window.location.href = path('/learn');
          return;
        }
        if (d) setData(d);
      })
      .catch(() => setErr(t('حدث خطأ في التحميل', 'Could not load learning data')))
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) return <div className="kid-content" style={{ padding: 40, textAlign: 'center' }}>{t('جاري التحميل...', 'Loading...')}</div>;
  if (err) return (
    <div className="kid-content" style={{ padding: 40, textAlign: 'center', color: '#c0392b' }}>
      {err} <button type="button" className="btn" onClick={() => window.location.reload()}>{t('إعادة المحاولة', 'Try again')}</button>
    </div>
  );
  if (!data) return (
    <div className="kid-content" role="alert" style={{ padding: 40, textAlign: 'center', color: '#c0392b' }}>
      {t('تعذر تحميل بيانات الطفل.', 'Could not load the child’s profile.')} <button type="button" className="btn" onClick={() => window.location.reload()}>{t('إعادة المحاولة', 'Try again')}</button>
    </div>
  );

  const { child, continueLesson, subjects, todayMinutes, dailyLimitReached } = data;

  return (
    <div className="kid-content">
      {/* Greeting */}
      <div style={{ margin: '4px 0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>{child.avatar}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#101A38' }}>
          {t('أهلاً', 'Hello')} {child.name}! 👋
        </div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          {t(BAND_LABELS[child.band], child.band[0].toUpperCase() + child.band.slice(1))}
          {child.badges.length > 0 && (
            <span style={{ marginInlineStart: 8 }}>
              {child.badges.map((b) => BADGE_ICONS[b] ?? '🏅').join(' ')}
            </span>
          )}
        </div>
      </div>

      {/* Daily limit warning */}
      {dailyLimitReached && (
        <div className="kid-limit-warning">
          ⏰ {t(`وصلت إلى حد الوقت اليومي (${child.dailyLimitMinutes} دقيقة). عظيم!`, `You reached your daily limit (${child.dailyLimitMinutes} minutes). Great work!`)}
        </div>
      )}
      {!dailyLimitReached && child.dailyLimitMinutes && (
        <div className="kid-limit-warning" style={{ background: '#e8f8f0', color: '#1a7a4a' }}>
          ⏱ {todayMinutes} / {child.dailyLimitMinutes} {t('دقيقة اليوم', 'minutes today')}
        </div>
      )}

      {/* Continue lesson */}
      {continueLesson && (
        <Link
          className="kid-continue-card"
          href={path(`/learn/${childId}/lessons/${continueLesson.lessonId}`)}
          style={{ background: `linear-gradient(135deg, ${continueLesson.subjectColor}, #22DAFF 200%)` }}
        >
          <span className="kid-continue-icon">{continueLesson.subjectIcon}</span>
          <div className="kid-continue-info">
            <div className="kid-continue-label">{t('أكمل من حيث توقفت', 'Continue learning')}</div>
            <div className="kid-continue-title">{content(continueLesson.titleAr, continueLesson.titleEn)}</div>
            <div className="kid-continue-sub">{content(continueLesson.subjectNameAr, continueLesson.subjectNameEn)}</div>
          </div>
          <span className="kid-continue-arrow">←</span>
        </Link>
      )}

      {/* Subjects */}
      <div className="kid-subjects-title">{t('المواد الدراسية 📚', 'Subjects 📚')}</div>
      {subjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
          {t('لا توجد محتويات لمستواك بعد. تحقق لاحقاً!', 'No content for your level yet. Check back soon!')}
        </div>
      ) : (
        <div className="kid-subjects-grid">
          {subjects.map((s) => (
            <Link
              key={s.id}
              className="kid-subject-card"
              href={path(`/learn/${childId}/subjects/${s.slug}`)}
              style={{ background: s.color }}
            >
              <span className="kid-subject-icon">{s.icon}</span>
              <span className="kid-subject-name">{content(s.nameAr, s.nameEn)}</span>
              <span className="kid-subject-count">{s.lessonCount} {t('درس', 'lessons')}</span>
              <div className="kid-progress-bar">
                <div className="kid-progress-fill" style={{ width: `${s.progressPercent}%` }} />
              </div>
              <span style={{ fontSize: 11, opacity: .85 }}>{s.progressPercent}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
