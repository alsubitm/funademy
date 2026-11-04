import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { createProgress, restoreProgress, type Language, type LessonRules, type Progress } from '@/lib/lesson-engine';

const LANG_KEY = 'funademy.lab.language';
const keyFor = (l: LessonRules) => `funademy.lab.progress.${l.id}.v${l.version}`;

type Notice = 'none' | 'blocked' | 'discarded' | 'conflict';

function load(lesson: LessonRules): { progress: Progress; notice: Notice; raw: string | null; revision: string | null } {
  try {
    const raw = localStorage.getItem(keyFor(lesson));
    const revision = localStorage.getItem(`${keyFor(lesson)}.revision`);
    const storedLang = localStorage.getItem(LANG_KEY);
    const lang: Language = storedLang === 'en' || storedLang === 'ar' ? storedLang : 'ar';
    const restored = restoreProgress(lesson, raw);
    if (restored) return { progress: restored, notice: 'none', raw, revision };
    return { progress: createProgress(lesson, lang), notice: raw ? 'discarded' : 'none', raw, revision };
  } catch {
    return { progress: createProgress(lesson, 'ar'), notice: 'blocked', raw: null, revision: null };
  }
}

/** Browser-local, validated (engine restoreProgress) student progress. Failures are surfaced, never hidden. */
export function useStoredProgress(lesson: LessonRules) {
  const [init] = useState(() => load(lesson));
  const [progress, updateProgress] = useState<Progress>(init.progress);
  const [notice, setNotice] = useState<Notice>(init.notice);
  const baseline = useRef({ raw: init.raw, revision: init.revision });
  const lastWritten = useRef(init.progress);
  const stopped = useRef<'blocked' | 'conflict' | null>(init.notice === 'blocked' ? 'blocked' : null);
  const key = keyFor(lesson);
  const revisionKey = `${key}.revision`;

  // Never merge construction snapshots: undo/reset/tested/hints must stay coherent.
  // A revision token detects even build → reset → identical saved JSON (ABA).
  // Tokens identify writes only, not devices, tabs, or students.
  const checkBaseline = useCallback(() => {
    if (localStorage.getItem(key) !== baseline.current.raw ||
        localStorage.getItem(revisionKey) !== baseline.current.revision) {
      stopped.current = 'conflict';
      setNotice('conflict');
      return false;
    }
    return true;
  }, [key, revisionKey]);

  const setProgress = useCallback((value: SetStateAction<Progress>) => {
    if (stopped.current !== 'conflict') updateProgress(value);
  }, []);

  useEffect(() => {
    const fail = () => {
      if (stopped.current === 'conflict') return;
      stopped.current = 'blocked';
      setNotice('blocked');
    };
    if (stopped.current) return;
    // No unsafe read/compare/write fallback when Web Locks is unavailable.
    if (!navigator.locks) { fail(); return; }
    void navigator.locks.request(key, () => {
      if (stopped.current || !checkBaseline()) return;
      const raw = JSON.stringify(progress);
      if (raw !== baseline.current.raw || progress !== lastWritten.current) {
        const revision = crypto.randomUUID();
        localStorage.setItem(revisionKey, revision);
        localStorage.setItem(key, raw);
        baseline.current = { raw, revision };
        lastWritten.current = progress;
      }
      localStorage.setItem(LANG_KEY, progress.language);
    }).catch(fail);
  }, [key, revisionKey, progress, checkBaseline]);

  useEffect(() => {
    const check = () => {
      if (stopped.current || !navigator.locks) return;
      void navigator.locks.request(key, () => {
        if (!stopped.current) checkBaseline();
      }).catch(() => {
        if (stopped.current) return;
        stopped.current = 'blocked';
        setNotice('blocked');
      });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key || event.key === revisionKey) check();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [key, revisionKey, checkBaseline]);

  function replaceProgress(candidate: Progress) {
    const validated = restoreProgress(lesson, JSON.stringify(candidate));
    if (!validated) return false;
    setProgress(validated);
    return true;
  }

  return { progress, setProgress, replaceProgress, notice, dismissNotice: () => setNotice((n) => (n === 'discarded' ? 'none' : n)) };
}
