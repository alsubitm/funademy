import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { createProgress, restoreProgress, type Language, type LessonRules, type Progress } from '@/lib/lesson-engine';
import { progressTransaction, type StoredSnapshot } from '@/lib/progress-store';

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
  const [ready, setReady] = useState(false);
  const baseline = useRef({ raw: init.raw, revision: init.revision });
  const lastWritten = useRef(init.progress);
  const stopped = useRef<'blocked' | 'conflict' | null>(init.notice === 'blocked' ? 'blocked' : null);
  const key = keyFor(lesson);
  const revisionKey = `${key}.revision`;

  // Never merge construction snapshots: undo/reset/tested/hints must stay coherent.
  // A revision token detects even build → reset → identical saved JSON (ABA).
  // Tokens identify writes only, not devices, tabs, or students.
  const checkBaseline = useCallback((current: StoredSnapshot | undefined) => {
    if (!current || current.raw !== baseline.current.raw ||
        current.revision !== baseline.current.revision) {
      stopped.current = 'conflict';
      setNotice('conflict');
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    if (stopped.current || !navigator.locks) {
      stopped.current = 'blocked'; setNotice('blocked'); setReady(true);
      return;
    }
    void navigator.locks.request(key, () => progressTransaction(key, current => {
      const snapshot = current ?? { raw: init.raw, revision: init.revision };
      return { value: snapshot, write: current ? undefined : snapshot };
    })).then(async result => {
      const snapshot = await result;
      if (!active) return;
      const restored = restoreProgress(lesson, snapshot.raw);
      const next = restored ?? createProgress(lesson, init.progress.language);
      baseline.current = snapshot;
      lastWritten.current = next;
      updateProgress(next);
      setNotice(snapshot.raw && !restored ? 'discarded' : 'none');
      setReady(true);
    }).catch(() => {
      if (!active) return;
      stopped.current = 'blocked'; setNotice('blocked'); setReady(true);
    });
    return () => { active = false; };
  }, [key, lesson, init]);

  const setProgress = useCallback((value: SetStateAction<Progress>) => {
    if (ready && stopped.current !== 'conflict') updateProgress(value);
  }, [ready]);

  useEffect(() => {
    const fail = () => {
      if (stopped.current === 'conflict') return;
      stopped.current = 'blocked';
      setNotice('blocked');
    };
    if (!ready || stopped.current) return;
    // No unsafe read/compare/write fallback when Web Locks is unavailable.
    if (!navigator.locks) { fail(); return; }
    void navigator.locks.request(key, async () => {
      if (stopped.current) return;
      const raw = JSON.stringify(progress);
      const snapshot = await progressTransaction(key, current => {
        if (stopped.current || !checkBaseline(current)) return { value: null };
        const changed = raw !== current!.raw || progress !== lastWritten.current;
        const revision = changed ? crypto.randomUUID() : current!.revision;
        // A mirror failure aborts the transaction. Reload always recovers the
        // last committed canonical snapshot, even after a partial mirror write.
        if (revision !== null) localStorage.setItem(revisionKey, revision);
        localStorage.setItem(key, raw);
        localStorage.setItem(LANG_KEY, progress.language);
        const next = { raw, revision };
        return { value: next, write: changed ? next : undefined };
      });
      if (snapshot) {
        baseline.current = snapshot;
        lastWritten.current = progress;
      }
    }).catch(fail);
  }, [key, revisionKey, progress, checkBaseline, ready]);

  useEffect(() => {
    const check = () => {
      if (!ready || stopped.current || !navigator.locks) return;
      void navigator.locks.request(key, () => progressTransaction(key, current => {
        if (!stopped.current) checkBaseline(current);
        return { value: undefined };
      })).catch(() => {
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
  }, [key, revisionKey, checkBaseline, ready]);

  function replaceProgress(candidate: Progress) {
    const validated = restoreProgress(lesson, JSON.stringify(candidate));
    if (!validated || !ready || stopped.current === 'conflict') return false;
    setProgress(validated);
    return true;
  }

  return { progress, setProgress, replaceProgress, notice, ready, dismissNotice: () => setNotice((n) => (n === 'discarded' ? 'none' : n)) };
}
