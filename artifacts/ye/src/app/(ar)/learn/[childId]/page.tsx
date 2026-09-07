'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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
    subjectNameAr: string;
    subjectColor: string;
    subjectIcon: string;
  } | null;
  subjects: Array<{
    id: number;
    nameAr: string;
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
  const params = useParams<{ childId: string }>();
  const childId = params.childId;
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/svc/learn/home')
      .then((r) => {
        if (r.status === 401) { window.location.href = '/learn'; return null; }
        if (r.status === 403) { setErr('لا يوجد تسجيل نشط'); return null; }
        if (!r.ok) throw new Error(`home request failed (${r.status})`);
        return r.json();
      })
      .then((d) => {
        if (d && String(d.child?.id) !== childId) {
          window.location.href = '/learn';
          return;
        }
        if (d) setData(d);
      })
      .catch(() => setErr('حدث خطأ في التحميل'))
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) return <div className="kid-content" style={{ padding: 40, textAlign: 'center' }}>جاري التحميل...</div>;
  if (err) return (
    <div className="kid-content" style={{ padding: 40, textAlign: 'center', color: '#c0392b' }}>
      {err} <button type="button" className="btn" onClick={() => window.location.reload()}>إعادة المحاولة</button>
    </div>
  );
  if (!data) return (
    <div className="kid-content" role="alert" style={{ padding: 40, textAlign: 'center', color: '#c0392b' }}>
      تعذر تحميل بيانات الطفل. <button type="button" className="btn" onClick={() => window.location.reload()}>إعادة المحاولة</button>
    </div>
  );

  const { child, continueLesson, subjects, todayMinutes, dailyLimitReached } = data;

  return (
    <div className="kid-content">
      {/* Greeting */}
      <div style={{ margin: '4px 0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>{child.avatar}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#101A38' }}>
          أهلاً {child.name}! 👋
        </div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          {BAND_LABELS[child.band]}
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
          ⏰ وصلت إلى حد الوقت اليومي ({child.dailyLimitMinutes} دقيقة). عظيم!
        </div>
      )}
      {!dailyLimitReached && child.dailyLimitMinutes && (
        <div className="kid-limit-warning" style={{ background: '#e8f8f0', color: '#1a7a4a' }}>
          ⏱ {todayMinutes} / {child.dailyLimitMinutes} دقيقة اليوم
        </div>
      )}

      {/* Continue lesson */}
      {continueLesson && (
        <Link
          className="kid-continue-card"
          href={`/learn/${childId}/lessons/${continueLesson.lessonId}`}
          style={{ background: `linear-gradient(135deg, ${continueLesson.subjectColor}, #22DAFF 200%)` }}
        >
          <span className="kid-continue-icon">{continueLesson.subjectIcon}</span>
          <div className="kid-continue-info">
            <div className="kid-continue-label">أكمل من حيث توقفت</div>
            <div className="kid-continue-title">{continueLesson.titleAr}</div>
            <div className="kid-continue-sub">{continueLesson.subjectNameAr}</div>
          </div>
          <span className="kid-continue-arrow">←</span>
        </Link>
      )}

      {/* Subjects */}
      <div className="kid-subjects-title">المواد الدراسية 📚</div>
      {subjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
          لا توجد محتويات لمستواك بعد. تحقق لاحقاً!
        </div>
      ) : (
        <div className="kid-subjects-grid">
          {subjects.map((s) => (
            <Link
              key={s.id}
              className="kid-subject-card"
              href={`/learn/${childId}/subjects/${s.slug}`}
              style={{ background: s.color }}
            >
              <span className="kid-subject-icon">{s.icon}</span>
              <span className="kid-subject-name">{s.nameAr}</span>
              <span className="kid-subject-count">{s.lessonCount} درس</span>
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
