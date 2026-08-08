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

  // Signed message bricks (approved ones shown publicly; new ones go to moderation)
  const [wallMsgs, setWallMsgs] = useState<{ id: number; authorName: string; color: string; message: string }[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [pendingNote, setPendingNote] = useState(false);

  useEffect(() => {
    fetch('/svc/bricks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.wall) setWallMsgs(d.wall); })
      .catch(() => {});
  }, []);

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
    setPendingNote(false);
    setLoading(true);

    try {
      const hasMsg = authorName.trim() && message.trim();
      const res = await fetch('/svc/bricks', {
        method: 'POST',
        ...(hasMsg
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ authorName: authorName.trim(), message: message.trim().slice(0, 120) }),
            }
          : {}),
      });
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
        if (data.pendingReview) {
          setPendingNote(true);
          setAuthorName('');
          setMessage('');
        }
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

        <div style={{ maxWidth: 460, margin: '20px auto 0', display: 'grid', gap: 10, textAlign: 'start' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-mut)' }}>{d.wallNameLbl}</label>
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={30}
            placeholder={d.wallNamePh}
            style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(159,192,255,0.3)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontFamily: 'inherit' }}
          />
          {authorName.trim() && (
            <>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-mut)' }}>{d.wallMsgLbl}</label>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={120}
                placeholder={d.wallMsgPh}
                style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(159,192,255,0.3)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontFamily: 'inherit' }}
              />
            </>
          )}
        </div>

        <button 
          className="btn-brick" 
          onClick={placeBrick} 
          disabled={loading || remaining === 0}
        >
          {d.wallPlaceBtn}
        </button>

        {pendingNote && (
          <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: 'var(--color-gold)' }}>{d.wallPendingNote}</div>
        )}

        {wallMsgs.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{d.wallMsgsTitle}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 760, margin: '0 auto' }}>
              {wallMsgs.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: m.color,
                    color: m.color === '#FFCA17' || m.color === '#22DAFF' ? '#101A38' : '#fff',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    maxWidth: 230,
                    textAlign: 'start',
                    boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
                  }}
                >
                  <div style={{ opacity: 0.85, fontSize: 11, marginBottom: 2 }}>{m.authorName}</div>
                  {m.message}
                </div>
              ))}
            </div>
          </div>
        )}

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
