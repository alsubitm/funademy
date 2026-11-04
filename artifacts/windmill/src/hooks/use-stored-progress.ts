import { useEffect, useState } from 'react';
import { createProgress, restoreProgress, type Language, type LessonRules, type Progress } from '@/lib/lesson-engine';

const LANG_KEY = 'funademy.lab.language';
const keyFor = (l: LessonRules) => `funademy.lab.progress.${l.id}.v${l.version}`;

type Notice = 'none' | 'blocked' | 'discarded';

function load(lesson: LessonRules): { progress: Progress; notice: Notice } {
  try {
    const raw = localStorage.getItem(keyFor(lesson));
    const storedLang = localStorage.getItem(LANG_KEY);
    const lang: Language = storedLang === 'en' || storedLang === 'ar' ? storedLang : 'ar';
    const restored = restoreProgress(lesson, raw);
    if (restored) return { progress: restored, notice: 'none' };
    return { progress: createProgress(lesson, lang), notice: raw ? 'discarded' : 'none' };
  } catch {
    return { progress: createProgress(lesson, 'ar'), notice: 'blocked' };
  }
}

/** Browser-local, validated (engine restoreProgress) student progress. Failures are surfaced, never hidden. */
export function useStoredProgress(lesson: LessonRules) {
  const [init] = useState(() => load(lesson));
  const [progress, setProgress] = useState<Progress>(init.progress);
  const [notice, setNotice] = useState<Notice>(init.notice);

  useEffect(() => {
    try {
      localStorage.setItem(keyFor(lesson), JSON.stringify(progress));
      localStorage.setItem(LANG_KEY, progress.language);
    } catch {
      setNotice('blocked');
    }
  }, [lesson, progress]);

  return { progress, setProgress, notice, dismissNotice: () => setNotice((n) => (n === 'discarded' ? 'none' : n)) };
}
