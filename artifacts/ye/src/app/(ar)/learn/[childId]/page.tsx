'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLearningLocale } from '@/components/learning/locale';
import { classifyHome, LearnerRecovery, type HomeFailure } from '@/components/learning/LearnerRecovery';

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

const BAND_LABELS: Record<string, string> = {
  explorers: 'المستكشفون', builders: 'الصانعون',
  achievers: 'المتفوقون', graduates: 'الخريجون',
};

export default function KidHomePage() {
  const { t, path, content } = useLearningLocale();
  const params = useParams<{ childId: string }>();
  const childId = params.childId;
  const [data, setData] = useState<HomeData | null>(null);
  const [failure, setFailure] = useState<HomeFailure | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [freshness, setFreshness] = useState(0);

  useEffect(() => {
    const refresh = () => setFreshness(n => n + 1);
    window.addEventListener('funademy:child-progress', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('funademy:child-progress', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFailure(null);
    setData(null);
    fetch('/svc/learn/home', { cache: 'no-store' })
      .then(async (r) => {
        const kind = await classifyHome(r.clone());
        if (cancelled) return;
        if (kind) { setFailure(kind); return; }
        const d = await r.json();
        if (String(d?.child?.id) !== childId) { setFailure('chooser'); return; }
        if (!cancelled) setData(d);
      })
      .catch(() => { if (!cancelled) setFailure('transient'); });
    return () => { cancelled = true; };
  }, [childId, attempts, freshness]);

  if (failure && !data) return <div className="kid-content"><LearnerRecovery kind={failure} attempts={attempts + 1} onRetry={() => setAttempts((a) => a + 1)} /></div>;
  if (!data) return (
    <div className="kid-content" role="status" aria-busy="true" data-testid="status-learner-home-loading">
      <span className="kid-sr">{t('جاري التحميل...', 'Loading...')}</span>
      <div className="kid-skel" style={{ height: 96 }} />
      <div className="kid-skel" style={{ height: 110, marginTop: 14 }} />
    </div>
  );

  const { child, continueLesson, subjects, todayMinutes, dailyLimitReached } = data;
  const limit = child.dailyLimitMinutes;
  const usedPct = limit ? Math.min(100, Math.round((todayMinutes / limit) * 100)) : 0;

  return (
    <div className="kid-content kid-home">
      <section className="kid-hello" aria-labelledby="kid-hello-t">
        <div className="kid-hello-avatar" aria-hidden="true">{child.avatar}</div>
        <div>
          <h1 id="kid-hello-t" data-testid="text-learner-greeting">{t('أهلاً', 'Hello')} {child.name}</h1>
          <div className="kid-hello-band">{t(BAND_LABELS[child.band] ?? child.band, child.band[0].toUpperCase() + child.band.slice(1))}</div>
        </div>
        <dl className="kid-hello-stats">
          <div><dt>XP</dt><dd data-testid="stat-learner-xp">{child.xp}</dd></div>
          <div><dt>{t('أيام متتالية', 'Day streak')}</dt><dd data-testid="stat-learner-streak">{child.streak}</dd></div>
          <div><dt>{t('شارات', 'Badges')}</dt><dd data-testid="stat-learner-badges">{child.badges.length}</dd></div>
        </dl>
      </section>

      {limit ? (
        <div className={`kid-limit${dailyLimitReached ? ' done' : ''}`} role="status" data-testid="status-learner-daily-limit" data-state={dailyLimitReached ? 'reached' : 'ok'}>
          <div className="kid-limit-row">
            <b>{dailyLimitReached ? t('انتهى وقت التعلّم لليوم', 'Learning time is done for today') : t('وقت التعلّم اليوم', 'Learning time today')}</b>
            <span>{todayMinutes} / {limit} {t('دقيقة', 'min')}</span>
          </div>
          <div className="kid-limit-bar" aria-hidden="true"><span style={{ width: `${usedPct}%` }} /></div>
          {dailyLimitReached && <p>{t('عمل رائع! لا يتبقى وقت كافٍ لدرس جديد اليوم. نكمل غداً.', 'Great work! There is not enough time left for another lesson today. See you tomorrow.')}</p>}
        </div>
      ) : dailyLimitReached ? (
        <div className="kid-limit done" role="status" data-testid="status-learner-daily-limit" data-state="reached">
          <b>{t('انتهى وقت التعلّم لليوم', 'Learning time is done for today')}</b>
        </div>
      ) : null}

      {continueLesson && !dailyLimitReached ? (
        <Link
          className="kid-continue-card"
          href={path(`/learn/${childId}/lessons/${continueLesson.lessonId}`)}
          style={{ background: continueLesson.subjectColor }}
          data-testid="link-learner-continue"
        >
          <span className="kid-continue-icon" aria-hidden="true">{continueLesson.subjectIcon}</span>
          <div className="kid-continue-info">
            <div className="kid-continue-label">{t('أكمل من حيث توقفت', 'Continue learning')}</div>
            <div className="kid-continue-title">{content(continueLesson.titleAr, continueLesson.titleEn)}</div>
            <div className="kid-continue-sub">{content(continueLesson.subjectNameAr, continueLesson.subjectNameEn)}</div>
          </div>
          <span className="kid-continue-arrow" aria-hidden="true">{t('←', '→')}</span>
        </Link>
      ) : !dailyLimitReached && subjects.length > 0 ? (
        <div className="kid-note" role="status" data-testid="status-learner-no-continue">
          {t('لا يوجد درس متاح للمتابعة الآن. اختر مادة لمراجعة ما أنجزته.', 'No lesson is ready to continue right now. Pick a subject to review what you have done.')}
        </div>
      ) : null}

      <h2 className="kid-subjects-title">{t('المواد', 'Subjects')}</h2>
      {subjects.length === 0 ? (
        <div className="kid-note" data-testid="empty-learner-subjects">
          {t('لا توجد دروس منشورة لمستواك بعد. سيضيفها فريق FunAdemy قريباً.', 'There are no published lessons for your level yet. The FunAdemy team will add them.')}
          <div style={{ marginTop: 12 }}><Link className="kid-btn line" href={path('/learn')} data-testid="link-learner-chooser-empty">{t('اختيار ملف آخر', 'Choose another profile')}</Link></div>
        </div>
      ) : (
        <div className="kid-subjects-grid">
          {subjects.map((s) => (
            <Link
              key={s.id}
              className="kid-subject-card"
              href={path(`/learn/${childId}/subjects/${s.slug}`)}
              style={{ background: s.color }}
              data-testid={`link-learner-subject-${s.slug}`}
            >
              <span className="kid-subject-icon" aria-hidden="true">{s.icon}</span>
              <span className="kid-subject-name">{content(s.nameAr, s.nameEn)}</span>
              <span className="kid-subject-count">{s.lessonCount} {t('درس', 'lessons')}</span>
              <div className="kid-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.progressPercent} aria-label={content(s.nameAr, s.nameEn)}>
                <div className="kid-progress-fill" style={{ width: `${s.progressPercent}%` }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{s.progressPercent}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
