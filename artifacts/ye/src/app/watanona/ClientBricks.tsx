'use client';

import { useState, useRef, useEffect } from 'react';
import { watanonaDict } from './dictionary';
import { arabicDigits } from '@/lib/constants';

// Brand palette only (blue / gold / cyan / sand) — mirrors svc/bricks BRICK_COLORS.
const BRICK_COLORS = ['#1C54CB', '#FFCA17', '#22DAFF', '#E5AE4A'];

type WallBrick = { id: number; authorName: string; color: string; message: string };
type Child = { id: number; firstName: string; birthYear: number };

export function ClientBricks({ initialCount, lang }: { initialCount: number; lang: 'ar' | 'en' }) {
  const d = watanonaDict[lang];
  const [count, setCount] = useState(initialCount);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [visualBricks, setVisualBricks] = useState<{ id: number; fresh: boolean }[]>([]);
  const brickId = useRef(initialCount);

  // The real wall: approved WatanBrick records from the DB.
  const [wall, setWall] = useState<WallBrick[]>([]);
  const [openBrick, setOpenBrick] = useState<number | null>(null);

  // Placement form
  const [color, setColor] = useState(BRICK_COLORS[1]);
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [pendingNote, setPendingNote] = useState(false);

  // Logged-in family children (optional link)
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/svc/bricks')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.wall) setWall(data.wall); })
      .catch(() => {});
    fetch('/svc/account/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => { if (me?.students?.length) setChildren(me.students); })
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
      const hasMsg = message.trim() && (authorName.trim() || childId !== null);
      const res = await fetch('/svc/bricks', {
        method: 'POST',
        ...(hasMsg
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                color,
                message: message.trim().slice(0, 120),
                ...(childId !== null ? { studentId: childId } : {}),
                ...(authorName.trim() ? { authorName: authorName.trim() } : {}),
              }),
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
    } catch {
      setError(d.wallError);
    } finally {
      setLoading(false);
    }
  };

  const displayCount = lang === 'ar' ? arabicDigits(count) : count;
  const opened = wall.find((b) => b.id === openBrick) ?? null;

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

        {/* ——— The real wall: approved bricks from the DB, tap to read ——— */}
        {wall.length > 0 && (
          <>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginTop: 36 }}>{d.wallMsgsTitle}</h3>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-mut)', marginTop: 4 }}>{d.brickTapHint}</p>
            <div className="wallgrid">
              {wall.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`wallbrick ${openBrick === b.id ? 'open' : ''}`}
                  style={{ background: b.color }}
                  aria-label={b.authorName}
                  onClick={() => setOpenBrick(openBrick === b.id ? null : b.id)}
                />
              ))}
            </div>
            {opened && (
              <div className="wallbrick-msg">
                <div className="who">🧱 {opened.authorName}</div>
                {opened.message}
              </div>
            )}
          </>
        )}

        {/* ——— Placement: color + optional message (+ child link if logged in) ——— */}
        <div style={{ maxWidth: 460, margin: '34px auto 0', display: 'grid', gap: 10, textAlign: 'start' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-mut)', textAlign: 'center' }}>{d.brickColorLbl}</label>
          <div className="color-pick">
            {BRICK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={color === c}
                className={color === c ? 'sel' : ''}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          {children.length > 0 ? (
            <>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-mut)' }}>{d.brickChildLbl}</label>
              <select
                value={childId ?? ''}
                onChange={(e) => setChildId(e.target.value ? Number(e.target.value) : null)}
                style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(159,192,255,0.3)', background: 'rgba(255,255,255,0.06)', color: 'inherit', fontFamily: 'inherit' }}
              >
                <option value="">{d.brickAnonOpt}</option>
                {children.map((c) => <option key={c.id} value={c.id}>{c.firstName}</option>)}
              </select>
            </>
          ) : (
            <>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-mut)' }}>{d.wallNameLbl}</label>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={30}
                placeholder={d.wallNamePh}
                style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(159,192,255,0.3)', background: 'rgba(255,255,255,0.06)', color: 'inherit', fontFamily: 'inherit' }}
              />
            </>
          )}

          {(authorName.trim() || childId !== null) && (
            <>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-mut)' }}>{d.wallMsgLbl}</label>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={120}
                placeholder={d.wallMsgPh}
                style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(159,192,255,0.3)', background: 'rgba(255,255,255,0.06)', color: 'inherit', fontFamily: 'inherit' }}
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
