import { useEffect, useState } from 'react';
import { LiveModel, LIVE_TOTAL } from '@/components/live/LiveModel';

type Room = { id: string; title: string; step: number; motor: boolean; speed: number; reverse: boolean; phase: string };

/** Staff-only preview: reads the authenticated staff endpoint and renders only the requested room. */
export default function LivePreview() {
  const id = new URLSearchParams(window.location.search).get('room') ?? '';
  const [room, setRoom] = useState<Room | null>(null);
  const [err, setErr] = useState<'' | 'auth' | 'missing' | 'net'>('');
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true; let timer = 0;
    const load = async () => {
      try {
        const res = await fetch('/svc/live-lab', { cache: 'no-store', credentials: 'include', signal: AbortSignal.timeout(8000) });
        if (res.status === 401 || res.status === 403) { if (alive) { setRoom(null); setErr('auth'); } return; }
        if (!res.ok) throw new Error();
        const d = await res.json();
        const r = (d.rooms ?? []).find((x: Room) => String(x.id) === id);
        if (!alive) return;
        if (!r) { setRoom(null); setErr('missing'); }
        else { setRoom({ id: r.id, title: r.title, step: r.step, motor: r.motor, speed: r.speed, reverse: r.reverse, phase: r.phase }); setErr(''); }
      } catch { if (alive) setErr('net'); }
      if (alive) timer = window.setTimeout(load, 3000);
    };
    load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [id, nonce]);
  if (err === 'auth') return <main className="lab" role="alert" style={{ padding: 24 }}>Sign in to the instructor panel. / سجّل الدخول إلى لوحة المدرّب.</main>;
  if (err === 'missing') return <main className="lab" role="alert" style={{ padding: 24 }}>Session not available. / الجلسة غير متاحة.</main>;
  if (!room) return <main className="lab" role="status" style={{ padding: 24 }}>{err === 'net' ? <>Reconnecting… / إعادة الاتصال… <button type="button" className="btn btn-soft" onClick={() => setNonce((n) => n + 1)} data-testid="button-preview-retry">Retry / إعادة المحاولة</button></> : 'Loading… / جارٍ التحميل…'}</main>;
  return (
    <main className="lab" style={{ padding: 12 }} data-testid="live-preview">
      {err === 'net' && <p className="notice" role="status">Reconnecting… / إعادة الاتصال…</p>}
      <LiveModel paused={err === 'net'} state={room} label={`Windmill ${room.step}/${LIVE_TOTAL}`} />
      <p className="muted small mono" style={{ textAlign: 'center' }} data-testid="text-preview-state">{room.step}/{LIVE_TOTAL} · {room.motor ? 'motor on' : 'motor off'} · {room.speed}x{room.reverse ? ' · reverse' : ''}</p>
    </main>
  );
}
