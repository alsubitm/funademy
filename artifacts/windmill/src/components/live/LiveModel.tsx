import { useEffect, useRef, useState } from 'react';
import { demoProgress } from '@/lib/lesson-engine';
import { windmillLesson as lesson } from '@/data/lessons/windmill';
import { ArrowDefs, STILL, WindmillModel } from '@/components/model/WindmillModel';
import { advanceDriverAngle, transmissionMotion } from '@/lib/motor-controls';

export type LiveModelState = { step: number; motor: boolean; speed: number; reverse: boolean };

function useReduced() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

/** Read-only, server-driven Windmill model. No local controls. */
export function LiveModel({ state, label, paused = false }: { state: LiveModelState; label: string; paused?: boolean }) {
  const reduced = useReduced();
  const tr = lesson.transmission;
  const step = Math.max(0, Math.min(lesson.steps.length, state.step));
  const placed = demoProgress(lesson, step, 'en').placed;
  const complete = step >= lesson.steps.length;
  const running = complete && state.motor && !paused && !reduced;
  const [angle, setAngle] = useState(0);
  const cfg = useRef({ speed: state.speed, dir: (state.reverse ? -1 : 1) as 1 | -1, reduced });
  cfg.current = { speed: Math.max(0.25, Math.min(2, state.speed || 1)), dir: state.reverse ? -1 : 1, reduced };
  useEffect(() => {
    if (!running) return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const c = cfg.current;
      setAngle((a) => advanceDriverAngle(a, dt, tr.driverRpm, c.speed, c.dir));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, tr.driverRpm]);
  useEffect(() => { if (!complete) setAngle(0); }, [complete]);
  const motion = running || angle !== 0 ? transmissionMotion(angle, tr.driverTeeth, tr.drivenTeeth, running || (reduced && complete && state.motor && !paused)) : STILL;
  const VB = lesson.viewBox;
  return (
    <div className="mat" dir="ltr" data-testid="live-model" style={{ aspectRatio: `${VB.w} / ${VB.h}`, cursor: 'default' }}>
      <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} role="img" aria-label={label}>
        <ArrowDefs />
        <WindmillModel lesson={lesson} placed={placed} motion={motion} direction={state.reverse ? -1 : 1} />
      </svg>
    </div>
  );
}
export const LIVE_TOTAL = lesson.steps.length;
export const liveStepTitle = (n: number, l: 'ar' | 'en') => lesson.steps[n - 1]?.title[l] ?? '';
