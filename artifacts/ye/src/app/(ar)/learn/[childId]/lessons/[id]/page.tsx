'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

// correctAnswer is intentionally absent — the server never sends it.
// Grading is server-side only; perAnswer results are returned after submission.
interface Exercise {
  id: number;
  type: string;
  promptAr: string;
  promptEn: string;
  options: string[];
}

interface LessonData {
  id: number;
  titleAr: string;
  descAr: string | null;
  videoUrl: string | null;
  videoType: 'youtube' | 'vimeo' | 'mp4';
  durationMinutes: number;
  subjectNameAr: string;
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

function toYoutubeEmbed(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : url;
}

function toVimeoEmbed(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : url;
}

type Stage = 'video' | 'exercises' | 'reward';

export default function KidLessonPage() {
  const params = useParams<{ childId: string; id: string }>();
  const { childId, id } = params;
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>('video');
  const [exIdx, setExIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [answers, setAnswers] = useState<Array<{ exerciseId: number; answer: string }>>([]);
  const [reward, setReward] = useState<RewardData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    fetch(`/svc/learn/lessons/${id}`)
      .then((r) => {
        if (r.status === 401 || r.status === 403) { window.location.href = '/learn'; return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d) {
          setLesson(d);
          setStage(d.videoUrl ? 'video' : d.exercises.length > 0 ? 'exercises' : 'video');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function submitLesson(finalAnswers: typeof answers) {
    if (submitting) return;
    setSubmitting(true);
    const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
    try {
      const r = await fetch(`/svc/learn/lessons/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers, timeSpentSeconds: timeSpent }),
      });
      if (r.ok) {
        const data = (await r.json()) as RewardData;
        const scoreBucket = data.score >= 90 ? '90_100' : data.score >= 70 ? '70_89' : data.score >= 50 ? '50_69' : '0_49';
        trackEvent('kids_lesson_completed', {
          subject: lesson?.subjectSlug ?? 'unknown',
          score_bucket: scoreBucket,
          exercise_count: finalAnswers.length,
          xp_earned: data.xpEarned,
          repeated: lesson?.completed ?? false,
        });
        setReward(data);
        setStage('reward');
      } else if (r.status === 403) {
        // Daily limit reached or lesson locked after the fact — redirect
        window.location.href = `/learn/${childId}`;
      }
    } catch {
      // Offline fallback — show reward with no XP
      setStage('reward');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOption(opt: string) {
    // Prevent double-tap and ignore while advancing to next question
    if (advancing || selected !== null) return;
    setSelected(opt);
    setAdvancing(true);

    const ex = lesson!.exercises[exIdx];
    const newAnswers = [...answers, { exerciseId: ex.id, answer: opt }];
    setAnswers(newAnswers);

    setTimeout(() => {
      if (exIdx + 1 < lesson!.exercises.length) {
        setExIdx((i) => i + 1);
        setSelected(null);
        setAdvancing(false);
      } else {
        submitLesson(newAnswers);
      }
    }, 900);
  }

  function proceedToExercises() {
    if (!lesson) return;
    if (lesson.exercises.length > 0) {
      setStage('exercises');
    } else {
      submitLesson([]);
    }
  }

  if (loading) return <div className="kid-content" style={{ padding: 40, textAlign: 'center' }}>جاري التحميل...</div>;
  if (!lesson) return null;

  const backHref = `/learn/${childId}/subjects/${lesson.subjectSlug}`;

  // Per-answer lookup for the reward stage (indexed by exerciseId)
  const perAnswerMap = new Map(reward?.perAnswer.map((a) => [a.exerciseId, a.correct]) ?? []);

  return (
    <div className="kid-player" dir="rtl">
      <div className="kid-player-header" style={{ background: lesson.subjectColor }}>
        <Link className="kid-player-back" href={backHref}>← {lesson.subjectNameAr}</Link>
        <span className="kid-player-title">{lesson.titleAr}</span>
      </div>

      <div className="kid-player-body">

        {/* ── VIDEO STAGE ── */}
        {stage === 'video' && (
          <>
            {lesson.videoUrl ? (
              <div className="kid-video-wrap">
                {lesson.videoType === 'youtube' && (
                  <iframe
                    src={toYoutubeEmbed(lesson.videoUrl)}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {lesson.videoType === 'vimeo' && (
                  <iframe
                    src={toVimeoEmbed(lesson.videoUrl)}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {lesson.videoType === 'mp4' && (
                  <video src={lesson.videoUrl} controls />
                )}
              </div>
            ) : (
              <div style={{ background: '#eef2ff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#1C54CB', marginBottom: 24 }}>
                📚 درس نصي
              </div>
            )}
            {lesson.descAr && (
              <p style={{ color: '#444', lineHeight: 1.7, marginBottom: 24 }}>{lesson.descAr}</p>
            )}
            <button
              className="btn y"
              style={{ width: '100%', padding: '16px', fontSize: 16 }}
              onClick={proceedToExercises}
            >
              {lesson.exercises.length > 0 ? 'ابدأ التمارين 📝' : 'إنهاء الدرس ✓'}
            </button>
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
                style={{ width: `${(exIdx / lesson.exercises.length) * 100}%` }}
              />
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              السؤال {exIdx + 1} من {lesson.exercises.length}
            </div>
            <p className="kid-exercise-prompt">{lesson.exercises[exIdx].promptAr}</p>
            <div className="kid-options">
              {lesson.exercises[exIdx].options.map((opt) => {
                // Only show "selected" state while waiting — no correctAnswer comparison
                const isSelected = opt === selected;
                const cls = 'kid-option-btn' + (isSelected ? ' selected' : '');
                return (
                  <button
                    key={opt}
                    className={cls}
                    onClick={() => handleOption(opt)}
                    disabled={advancing}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitting && (
              <div style={{ textAlign: 'center', marginTop: 12, color: '#888', fontSize: 13 }}>
                جاري الحفظ...
              </div>
            )}
          </div>
        )}

        {/* ── REWARD STAGE ── */}
        {stage === 'reward' && (
          <div className="kid-reward">
            <div className="kid-reward-icon">🏆</div>
            <div className="kid-reward-title">رائع! أنهيت الدرس!</div>
            {reward && (
              <>
                <div className="kid-reward-score">{reward.score}%</div>
                <div className="kid-reward-xp">+{reward.xpEarned} XP · مجموع: {reward.totalXp}</div>
                {reward.newBadges.length > 0 && (
                  <div className="kid-reward-badges">
                    {reward.newBadges.map((b) => BADGE_ICONS[b] ?? '🏅')}
                    <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>شارات جديدة!</div>
                  </div>
                )}
                <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>
                  🔥 السلسلة: {reward.streak} يوم
                </div>
                {/* Per-exercise correctness feedback (server-validated) */}
                {reward.perAnswer.length > 0 && (
                  <div style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
                    {reward.perAnswer.map((a, i) => {
                      const ex = lesson.exercises.find((e) => e.id === a.exerciseId);
                      return (
                        <div key={a.exerciseId} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                          <span>{a.correct ? '✅' : '❌'}</span>
                          <span style={{ opacity: 0.8 }}>{ex ? ex.promptAr : `سؤال ${i + 1}`}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <div className="kid-reward-actions">
              <Link className="btn y" href={backHref}>← عودة للمادة</Link>
              <Link className="btn" href={`/learn/${childId}`}>الرئيسية 🏠</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
