import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceDriverAngle } from '@/lib/motor-controls';

export const SLOW_FACTOR = 0.25;
export const REDUCED_FACTOR = 0.3;

/** Accumulates the driver angle per animation frame so speed/direction changes never jump. */
export function useMotor(rpm: number, reduced: boolean) {
  const [angle, setAngle] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [slow, setSlow] = useState(false);
  const factor = speed * (slow ? SLOW_FACTOR : 1) * (reduced ? REDUCED_FACTOR : 1);
  const fRef = useRef(factor); fRef.current = factor;
  const dRef = useRef(direction); dRef.current = direction;
  const aRef = useRef(0);

  useEffect(() => {
    if (!running || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      aRef.current = advanceDriverAngle(aRef.current, dt, rpm, fRef.current, dRef.current) % 1080;
      setAngle(aRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, paused, rpm]);

  const start = useCallback(() => { aRef.current = 0; setAngle(0); setPaused(false); setRunning(true); }, []);
  const stop = useCallback(() => { aRef.current = 0; setAngle(0); setPaused(false); setRunning(false); }, []);
  const togglePause = useCallback(() => setPaused((p) => !p), []);
  const reverse = useCallback(() => setDirection((d) => (d === 1 ? -1 : 1)), []);

  return { angle, running, paused, speed, setSpeed, direction, reverse, slow, setSlow, factor, start, stop, togglePause };
}
export type MotorState = ReturnType<typeof useMotor>;
