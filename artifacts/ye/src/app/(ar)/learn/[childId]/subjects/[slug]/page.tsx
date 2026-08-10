'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface SubjectData {
  subject: {
    nameAr: string;
    icon: string;
    color: string;
    slug: string;
  };
  units: Array<{
    id: number;
    titleAr: string;
    locked: boolean;
    lessons: Array<{
      id: number;
      titleAr: string;
      durationMinutes: number;
      exerciseCount: number;
      completed: boolean;
    }>;
  }>;
}

export default function KidSubjectPage() {
  const params = useParams<{ childId: string; slug: string }>();
  const { childId, slug } = params;
  const [data, setData] = useState<SubjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/svc/learn/subjects/${slug}/units`)
      .then((r) => {
        if (r.status === 401) { window.location.href = '/learn'; return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="kid-content" style={{ padding: 40, textAlign: 'center' }}>جاري التحميل...</div>;
  if (!data) return null;

  const { subject, units } = data;
  const totalLessons = units.flatMap((u) => u.lessons).length;
  const doneLessons = units.flatMap((u) => u.lessons).filter((l) => l.completed).length;

  return (
    <div className="kid-player" dir="rtl">
      {/* Header */}
      <div className="kid-subject-header" style={{ background: subject.color }}>
        <Link
          href={`/learn/${childId}`}
          style={{ display: 'inline-block', marginBottom: 8, color: 'rgba(255,255,255,.8)', fontSize: 14 }}
        >
          ← الرئيسية
        </Link>
        <div className="kid-subject-header-icon">{subject.icon}</div>
        <h1 className="kid-subject-header-name">{subject.nameAr}</h1>
        <div style={{ fontSize: 13, marginTop: 6, opacity: .85 }}>
          {doneLessons} / {totalLessons} درس
        </div>
        <div className="kid-progress-bar" style={{ maxWidth: 200, margin: '10px auto 0' }}>
          <div
            className="kid-progress-fill"
            style={{ width: totalLessons ? `${Math.round((doneLessons / totalLessons) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      <div className="kid-units">
        {units.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>لا توجد وحدات لمستواك.</div>
        )}
        {units.map((unit, uIdx) => (
          <div key={unit.id} className="kid-unit-card">
            <div className="kid-unit-header">
              <span className="kid-unit-title">الوحدة {uIdx + 1}: {unit.titleAr}</span>
              {unit.locked && <span className="kid-unit-locked">🔒</span>}
            </div>
            <div className="kid-lessons-list">
              {unit.lessons.map((lesson, lIdx) => (
                <Link
                  key={lesson.id}
                  className={`kid-lesson-row${unit.locked ? ' locked' : ''}`}
                  href={unit.locked ? '#' : `/learn/${childId}/lessons/${lesson.id}`}
                >
                  {lesson.completed
                    ? <span className="kid-lesson-check">✓</span>
                    : <span className="kid-lesson-num">{lIdx + 1}</span>
                  }
                  <span className="kid-lesson-title">{lesson.titleAr}</span>
                  <span className="kid-lesson-dur">{lesson.durationMinutes}د</span>
                  {lesson.exerciseCount > 0 && (
                    <span className="kid-lesson-dur">📝 {lesson.exerciseCount}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
