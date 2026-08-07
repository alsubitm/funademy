'use client';

import { useState, useRef, useEffect } from 'react';
import { watanonaDict } from './dictionary';
import { arabicDigits } from '@/lib/constants';

export function ClientBricks({ initialCount, lang }: { initialCount: number; lang: 'ar' | 'en' }) {
  const d = watanonaDict[lang];
  const [count, setCount] = useState(initialCount);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [visualBricks, setVisualBricks] = useState<{ id: number; fresh: boolean }[]>([]);
  const brickId = useRef(initialCount);

  useEffect(() => {
    const initVisuals = [];
    const maxVis = Math.min(initialCount, 300); // cap visual bricks at 300 for performance
    for (let i = 0; i < maxVis; i++) {
      initVisuals.push({ id: i, fresh: false });
    }
    setVisualBricks(initVisuals);
    brickId.current = initialCount;
  }, [initialCount]);

  const placeBrick = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/svc/bricks', { method: 'POST' });
      const data = await res.json();
      
      if (res.status === 429) {
        setError(d.wallLimitReached);
        setCount(data.count); 
        return;
      }
      
      if (res.ok) {
        setCount(data.count);
        setRemaining(data.remainingToday);
        const newId = ++brickId.current;
        setVisualBricks(prev => [...prev, { id: newId, fresh: true }].slice(-300));
      } else {
        setError(d.wallError);
      }
    } catch (err) {
      setError(d.wallError);
    } finally {
      setLoading(false);
    }
  };

  const displayCount = lang === 'ar' ? arabicDigits(count) : count;

  return (
    <div className="brick-wall-sec" id="wall">
      <div className="wrap">
        <span className="kick" style={{ color: 'var(--color-cyan)', borderColor: 'var(--color-cyan)' }}>
          {d.wallKick}
        </span>
        <h2>{d.wallTitle}</h2>
        <p className="sub" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
          {d.wallSub}
        </p>
        
        <div className="brick-display">
          <div className="brick-counter-huge">{displayCount}</div>
          <div className="wall-container">
            {visualBricks.map(b => (
              <div key={b.id} className={`mini-brick ${b.fresh ? 'anim-in' : ''}`} />
            ))}
          </div>
        </div>

        <button 
          className="btn-brick" 
          onClick={placeBrick} 
          disabled={loading || remaining === 0}
        >
          {d.wallPlaceBtn}
        </button>

        <div className="mt-4 text-sm font-mono font-semibold" style={{ color: 'var(--color-mut)', marginTop: '16px' }}>
          {error ? (
            <span style={{ color: '#FF7B74' }}>{error}</span>
          ) : remaining !== null ? (
            <span style={{ color: 'var(--color-gold)' }}>{d.wallRemaining(remaining)}</span>
          ) : (
            <span>{displayCount} {d.wallCountLbl}</span>
          )}
        </div>
      </div>
    </div>
  );
}
