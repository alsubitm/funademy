'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLearningLocale } from '@/components/learning/locale';
import { hasEnglishOptions, optionLabel } from '@/lib/learning-options';
import { englishReadiness, lessonVideo } from '@/lib/learning-readiness';

// correctAnswer is intentionally absent — the server never sends it.
// Grading is server-side only; perAnswer results are returned after submission.
interface Exercise {
  id: number;
  type: string;
  promptAr: string;
  promptEn: string;
  options: string[];
  optionsEn: string[];
}

interface LessonData {
  id: number;
  titleAr: string;
  titleEn: string;
  descAr: string | null;
  descEn: string | null;
  videoUrl: string | null;
  videoType: 'youtube' | 'vimeo' | 'mp4';
  videoLanguage: string;
  videoUrlEn: string | null;
  videoTypeEn: 'youtube' | 'vimeo' | 'mp4';
  durationMinutes: number;
  subjectNameAr: string;
  subjectNameEn: string;
  subjectColor: string;
  subjectSlug: string;
  completed: boolean;
  exercises: Exercise[];
}

interface RewardData {
  xpEarned: number;
  totalXp: number;
  streak: number;
  newBadges: string[];
  score: number;
  perAnswer: Array<{ exerciseId: number; correct: boolean }>;
}

const BADGE_ICONS: Record<string, string> = {
  first_lesson: '⭐', five_lessons: '🔥', ten_lessons: '🏆',
  streak_3: '⚡', streak_7: '💎', perfect_score: '🎯',
};

function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch { return null; }
}

function toYoutubeEmbed(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    const id = host === 'youtu.be'
      ? url.pathname.slice(1).split('/')[0]
      : ['youtube.com', 'm.youtube.com'].includes(host)
        ? (url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/embed\/([^/]+)/)?.[1])
        : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}?rel=0`
      : null;
  } catch { return null; }
}

function toVimeoEmbed(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    if (!['vimeo.com', 'player.vimeo.com'].includes(host)) return null;
    const id = url.pathname.match(/(?:\/video)?\/(\d+)(?:\/|$)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  } catch { return null; }
}

type Stage = 'video' | 'exercises' | 'reward';
type Answer = { exerciseId: number; answer: string };
type Draft = {
  stage: Exclude<Stage, 'reward'>;
  exIdx: number;
  selected: string | null;
  answers: Answer[];
  elapsedSeconds: number;
};

export default function KidLessonPage() {
  const { t, path, dir, content, en } = useLearningLocale();
  const params = useParams<{ childId: string; id: string }>();
  const { childId, id } = params;
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>('video');
  const [exIdx, setExIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [reward, setReward] = useState<RewardData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const draftLoaded = useRef(false);
  const elapsedRef = useRef(0);
  const questionRef = useRef<HTMLParagraphElement>(null);
  const storageKey = `funademy:lesson-draft:${childId}:${id}`;

  useEffect(() => {
    fetch(`/svc/learn/lessons/${id}`)
      .then((r) => {
        if (r.status === 401 || r.status === 403) { window.location.href = path('/learn'); return null; }
        if (!r.ok) throw new Error(`lesson_load_${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d) {
          setLesson(d);
          const defaultStage = (d.videoUrl || d.videoUrlEn) ? 'video' : d.exercises.length > 0 ? 'exercises' : 'video';
          try {
            const saved = sessionStorage.getItem(storageKey);
            if (saved) {
              const draft = JSON.parse(saved) as Draft;
              const validAnswers = Array.isArray(draft.answers)
                ? draft.answers.filter((a) => d.exercises.some((e: Exercise) => e.id === a.exerciseId))
                : [];
              const idx = Math.min(Math.max(Number(draft.exIdx) || 0, 0), Math.max(d.exercises.length - 1, 0));
              setStage(draft.stage === 'exercises' && d.exercises.length ? 'exercises' : defaultStage);
              setExIdx(idx);
              setSelected(typeof draft.selected === 'string' ? draft.selected : null);
              setAnswers(validAnswers);
              const elapsed = Math.max(0, Math.round(Number(draft.elapsedSeconds) || 0));
              elapsedRef.current = elapsed;
              setElapsedSeconds(elapsed);
            } else {
              setStage(defaultStage);
            }
          } catch {
            sessionStorage.removeItem(storageKey);
            setStage(defaultStage);
          }
          draftLoaded.current = true;
        }
      })
      .catch(() => setError(navigator.onLine ? t('تعذر تحميل الدرس. حاول مرة أخرى.', 'Could not load the lesson. Please try again.') : t('أنت غير متصل بالإنترنت. اتصل ثم أعد المحاولة.', 'You are offline. Connect to the internet and try again.')))
      .finally(() => setLoading(false));
  }, [id, storageKey]);

  useEffect(() => {
    if (!draftLoaded.current || stage === 'reward') return;
    const draft: Draft = { stage, exIdx, selected, answers, elapsedSeconds };
    sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [answers, elapsedSeconds, exIdx, selected, stage, storageKey]);

  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && document.hasFocus() && stage !== 'reward') {
        elapsedRef.current += Math.min(now - last, 1500) / 1000;
        const rounded = Math.round(elapsedRef.current);
        setElapsedSeconds(rounded);
      }
      last = now;
    };
    const timer = window.setInterval(tick, 1000);
    const resetClock = () => { last = Date.now(); };
    window.addEventListener('focus', resetClock);
    document.addEventListener('visibilitychange', resetClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', resetClock);
      document.removeEventListener('visibilitychange', resetClock);
    };
  }, [stage]);

  async function submitLesson(finalAnswers: typeof answers) {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const timeSpent = Math.round(elapsedRef.current);
    try {
      const r = await fetch(`/svc/learn/lessons/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers, timeSpentSeconds: timeSpent }),
      });
      if (r.ok) {
        const data = await r.json();
        setReward(data);
        setStage('reward');
        sessionStorage.removeItem(storageKey);
        window.dispatchEvent(new CustomEvent('funademy:child-progress', {
          detail: {
            childId: Number(childId),
            totalXp: data.totalXp,
            streak: data.streak,
          },
        }));
      } else {
        const data = await r.json().catch(() => ({}));
        setError(
          data.error === 'daily_limit_reached'
            ? t('تم بلوغ الحد اليومي. إجاباتك محفوظة ويمكنك المحاولة لاحقاً.', 'Daily limit reached. Your answers are saved; try again later.')
            : data.error === 'missing_exercise_answer'
              ? t('بعض الإجابات ناقصة. راجع الأسئلة ثم حاول مجدداً.', 'Some answers are missing. Review the questions and try again.')
              : t('لم يتم حفظ إكمال الدرس. إجاباتك محفوظة؛ حاول مرة أخرى.', 'Lesson completion was not saved. Your answers are saved; please try again.'),
        );
      }
    } catch {
      setError(navigator.onLine
        ? t('تعذر الاتصال بالخادم. إجاباتك محفوظة؛ حاول مرة أخرى.', 'Could not reach the server. Your answers are saved; please try again.')
        : t('أنت غير متصل بالإنترنت. إجاباتك محفوظة؛ اتصل ثم أعد المحاولة.', 'You are offline. Your answers are saved; reconnect and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleOption(opt: string) {
    if (submitting) return;
    setSelected(opt);
    setError('');
  }

  function confirmAnswer() {
    if (!lesson || selected === null || submitting) return;
    const ex = lesson.exercises[exIdx];
    const newAnswers = [...answers.filter((a) => a.exerciseId !== ex.id), { exerciseId: ex.id, answer: selected }];
    setAnswers(newAnswers);
    if (exIdx + 1 < lesson.exercises.length) {
      const nextIdx = exIdx + 1;
      setExIdx(nextIdx);
      setSelected(newAnswers.find((a) => a.exerciseId === lesson.exercises[nextIdx].id)?.answer ?? null);
      requestAnimationFrame(() => questionRef.current?.focus());
    } else {
      submitLesson(newAnswers);
    }
  }

  function proceedToExercises() {
    if (!lesson) return;
    setError('');
    if (lesson.exercises.length > 0) {
      setStage('exercises');
    } else {
      submitLesson([]);
    }
  }

  if (loading) return <div className="kid-content" style={{ padding: 40, textAlign: 'center' }} role="status">{t('جاري التحميل...', 'Loading...')}</div>;
  if (!lesson) return (
    <div className="kid-content" style={{ padding: 40, textAlign: 'center' }} role="alert">
      {error || t('تعذر تحميل الدرس.', 'Could not load this lesson.')}
      <div><button className="btn y" onClick={() => window.location.reload()}>{t('إعادة المحاولة', 'Try again')}</button></div>
    </div>
  );

  const backHref = path(`/learn/${childId}/subjects/${lesson.subjectSlug}`);
  const readiness = englishReadiness(lesson);
  const video = lessonVideo(lesson, en);
  const missingTranslation = en && (!lesson.titleEn?.trim() ||
    (lesson.descAr && !lesson.descEn?.trim()) ||
    lesson.exercises.some(ex => !ex.promptEn?.trim() || !hasEnglishOptions(ex.options, ex.optionsEn ?? [])));
  if (missingTranslation) return <div className="kid-content" role="alert">
    <h1>English translation unavailable</h1>
    <p>This lesson is not fully translated yet. Choose another lesson or switch to Arabic using the language link above.</p>
    <Link className="btn" href={backHref}>← Back to subject</Link>
  </div>;

  return (
    <div className="kid-player" dir={dir}>
      <div className="kid-player-header" style={{ background: lesson.subjectColor }}>
        <Link className="kid-player-back" href={backHref}>← {content(lesson.subjectNameAr, lesson.subjectNameEn)}</Link>
        <span className="kid-player-title">{content(lesson.titleAr, lesson.titleEn)}</span>
      </div>

      <div className="kid-player-body">
        <p role="status">
          {t('النص الإنجليزي: ', 'English text: ')}{readiness.text ? t('جاهز', 'ready') : t('ناقص', 'incomplete')}
          {' · '}{t('الفيديو الإنجليزي: ', 'English video: ')}
          {readiness.video === 'ready' ? t('متوفر', 'available') :
            readiness.video === 'none' ? t('بدون فيديو', 'no video') :
            readiness.video === 'arabic' ? t('الفيديو الأصلي عربي فقط', 'original video is Arabic-only') :
            t('لغة الفيديو الأصلي غير محددة', 'original video language is unconfirmed')}
        </p>

        {/* ── VIDEO STAGE ── */}
        {stage === 'video' && (
          <>
            {video.url ? (
              <div className="kid-video-wrap">
                {video.type === 'youtube' && toYoutubeEmbed(video.url) && (
                  <iframe
                    src={toYoutubeEmbed(video.url)!}
                    title={`${t('فيديو', 'Video')}: ${content(lesson.titleAr, lesson.titleEn)}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {video.type === 'vimeo' && toVimeoEmbed(video.url) && (
                  <iframe
                    src={toVimeoEmbed(video.url)!}
                    title={`${t('فيديو', 'Video')}: ${content(lesson.titleAr, lesson.titleEn)}`}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {video.type === 'mp4' && safeHttpUrl(video.url) && (
                  <video src={safeHttpUrl(video.url)!} controls>
                    {t('متصفحك لا يدعم تشغيل الفيديو.', 'Your browser does not support video playback.')}
                  </video>
                )}
                {((video.type === 'youtube' && !toYoutubeEmbed(video.url)) ||
                  (video.type === 'vimeo' && !toVimeoEmbed(video.url)) ||
                  (video.type === 'mp4' && !safeHttpUrl(video.url))) && (
                  <div className="kid-video-fallback">
                    <p>{t('تعذر عرض رابط الفيديو بأمان.', 'This video link cannot be displayed safely.')}</p>
                    {safeHttpUrl(video.url) && (
                      <a className="btn" href={safeHttpUrl(video.url)!} target="_blank" rel="noopener noreferrer">
                        {t('فتح الفيديو في نافذة جديدة', 'Open video in a new window')}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#eef2ff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#1C54CB', marginBottom: 24 }}>
                {en && lesson.videoUrl ? 'English video unavailable. You can use the English text and exercises below, or switch to Arabic to watch the original video.' : t('درس نصي', 'Reading lesson')}
              </div>
            )}
            {(lesson.descAr || lesson.descEn) && (
              <p style={{ color: '#444', lineHeight: 1.7, marginBottom: 24 }}>{content(lesson.descAr ?? '', lesson.descEn)}</p>
            )}
            <button
              className="btn y"
              style={{ width: '100%', padding: '16px', fontSize: 16 }}
              onClick={proceedToExercises}
            >
              {lesson.exercises.length > 0 ? t('ابدأ التمارين 📝', 'Start exercises 📝') : t('إنهاء الدرس ✓', 'Finish lesson ✓')}
            </button>
            {error && (
              <div className="kid-submit-error" role="alert" aria-live="assertive">
                {error}
                <button className="btn small" onClick={() => submitLesson([])} disabled={submitting}>
                  {t('إعادة المحاولة', 'Try again')}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── EXERCISES STAGE ──
            Correct answers are NOT known client-side (excluded from GET response).
            Options are highlighted only as "selected" while advancing;
            correctness feedback is shown server-returned in the reward stage. */}
        {stage === 'exercises' && lesson.exercises.length > 0 && (
          <div className="kid-exercise-card">
            <div className="kid-exercise-progress">
              <div
                className="kid-exercise-progress-fill"
                style={{ width: `${((exIdx + 1) / lesson.exercises.length) * 100}%` }}
                role="progressbar"
                aria-label={t('تقدم التمارين', 'Exercise progress')}
                aria-valuemin={0}
                aria-valuemax={lesson.exercises.length}
                aria-valuenow={exIdx + 1}
              />
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              {t('السؤال', 'Question')} {exIdx + 1} {t('من', 'of')} {lesson.exercises.length}
            </div>
            <p className="kid-exercise-prompt" ref={questionRef} tabIndex={-1}>
              {content(lesson.exercises[exIdx].promptAr, lesson.exercises[exIdx].promptEn)}
            </p>
            <div className="kid-options">
              {lesson.exercises[exIdx].options.map((opt, index) => {
                // Only show "selected" state while waiting — no correctAnswer comparison
                const isSelected = opt === selected;
                const cls = 'kid-option-btn' + (isSelected ? ' selected' : '');
                return (
                  <button
                    key={opt}
                    className={cls}
                    onClick={() => handleOption(opt)}
                    disabled={submitting}
                    aria-pressed={isSelected}
                  >
                    {optionLabel(lesson.exercises[exIdx].options, lesson.exercises[exIdx].optionsEn ?? [], index, en)}
                  </button>
                );
              })}
            </div>
            <button
              className="btn y kid-confirm-answer"
              onClick={confirmAnswer}
              disabled={selected === null || submitting}
            >
              {exIdx + 1 === lesson.exercises.length ? t('تأكيد وإنهاء', 'Confirm and finish') : t('تأكيد والتالي', 'Confirm and next')}
            </button>
            <div className="kid-selection-status" aria-live="polite">
              {selected === null ? t('اختر إجابة ثم أكدها', 'Choose an answer, then confirm') : t('تم اختيار إجابة. يمكنك تغييرها قبل التأكيد.', 'Answer selected. You can change it before confirming.')}
            </div>
            {submitting && (
              <div style={{ textAlign: 'center', marginTop: 12, color: '#888', fontSize: 13 }} role="status" aria-live="polite">
                {t('جاري الحفظ...', 'Saving...')}
              </div>
            )}
            {error && (
              <div className="kid-submit-error" role="alert" aria-live="assertive">
                <span>{error}</span>
                <button className="btn small" onClick={() => submitLesson(answers)} disabled={submitting}>
                  {t('إعادة المحاولة', 'Try again')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── REWARD STAGE ── */}
        {stage === 'reward' && reward && (
          <div className="kid-reward">
            <div className="kid-reward-icon">🏆</div>
            <div className="kid-reward-title">{t('رائع! أنهيت الدرس!', 'Great work! You finished the lesson!')}</div>
              <>
                <div className="kid-reward-score">{reward.score}%</div>
                <div className="kid-reward-xp">+{reward.xpEarned} XP · {t('مجموع', 'Total')}: {reward.totalXp}</div>
                {reward.newBadges.length > 0 && (
                  <div className="kid-reward-badges">
                    {reward.newBadges.map((b) => BADGE_ICONS[b] ?? '🏅')}
                    <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>{t('شارات جديدة!', 'New badges!')}</div>
                  </div>
                )}
                <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>
                  🔥 {t('السلسلة', 'Streak')}: {reward.streak} {t('يوم', 'days')}
                </div>
                {/* Per-exercise correctness feedback (server-validated) */}
                {reward.perAnswer.length > 0 && (
                  <div style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
                    {reward.perAnswer.map((a, i) => {
                      const ex = lesson.exercises.find((e) => e.id === a.exerciseId);
                      return (
                        <div key={a.exerciseId} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                          <span aria-label={a.correct ? t('صحيح', 'Correct') : t('غير صحيح', 'Incorrect')}>{a.correct ? '✅' : '❌'}</span>
                          <span style={{ opacity: 0.8 }}>{ex ? content(ex.promptAr, ex.promptEn) : `${t('سؤال', 'Question')} ${i + 1}`}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            <div className="kid-reward-actions">
              <Link className="btn y" href={backHref}>{t('← عودة للمادة', '← Back to subject')}</Link>
              <Link className="btn" href={path(`/learn/${childId}`)}>{t('الرئيسية 🏠', 'Home 🏠')}</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
