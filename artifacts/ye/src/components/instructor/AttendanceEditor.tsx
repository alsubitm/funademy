'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lang, Run } from './types';
import { fmtDate } from './types';
import { statusLabel, t } from './strings';

type Row = { id: number; firstName: string; makeup: boolean; status: string | null; version: string | null };

/** One-tap persisted marks: no optimistic "saved" state or unsaved bulk draft. */
export function AttendanceEditor({ run, lang, onSaved }: {
  run: Run; lang: Lang; onSaved: (sessionId: number, studentId: number, status: string) => void;
}) {
  const s = t(lang);
  const ar = lang === 'ar';
  const [sessionId, setSessionId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  useEffect(() => {
    let cancelled = false;
    setRows([]); setMessage(''); setBlocked(false); setFailed(false);
    if (!sessionId) return;
    setLoading(true);
    fetch(`/svc/instructor/attendance?sessionId=${sessionId}`, { cache: 'no-store', credentials: 'include' })
      .then(async res => {
        if (!res.ok) throw new Error('load');
        const data = await res.json();
        if (!cancelled) {
          setRows(data.students);
          // Refresh the surrounding summary as well as the editable roster.
          for (const row of data.students as Row[]) {
            if (row.status) onSavedRef.current(Number(sessionId), row.id, row.status);
          }
        }
      }).catch(() => {
        if (!cancelled) { setFailed(true); setMessage(s.loadError); }
      }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId, refresh, s.loadError]);

  async function save(row: Row, status: string) {
    if (busy !== null || blocked) return;
    setBusy(row.id); setMessage(''); setFailed(false);
    try {
      const res = await fetch('/svc/instructor/attendance', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: Number(sessionId), studentId: row.id, status, expectedVersion: row.version }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFailed(true);
        setBlocked(true);
        setMessage(data.error === 'attendance_conflict'
          ? (ar ? 'تغيّر سجل الحضور. أعد تحميله وراجعه قبل الحفظ.' : 'Attendance changed elsewhere. Reload and review before saving.')
          : res.status === 401 || res.status === 403
            ? (ar ? 'لم تعد لديك صلاحية. حدّث الصفحة أو سجّل الدخول مجدداً.' : 'Access is no longer available. Refresh the page or sign in again.')
            : s.saveFailed);
        return;
      }
      const mark = await res.json();
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: mark.status, version: mark.version } : r));
      onSaved(Number(sessionId), row.id, mark.status);
      setMessage(`${row.firstName}: ${s.saved}`);
    } catch {
      // A lost response may have committed: force a fresh version before retry.
      setFailed(true); setBlocked(true); setMessage(s.saveFailed);
    } finally { setBusy(null); }
  }

  return <div style={{ marginTop: 20 }} data-testid={`attendance-editor-${run.id}`}>
    <label htmlFor={`attendance-session-${run.id}`}>{ar ? 'تسجيل حضور الحصة' : 'Record session attendance'}</label>
    <div className="ip-filters">
      <select id={`attendance-session-${run.id}`} className="ip-select" value={sessionId} disabled={busy !== null}
        onChange={e => setSessionId(e.target.value)}>
        <option value="">{ar ? 'اختر الحصة' : 'Choose a session'}</option>
        {run.sessions.map(x => <option key={x.id} value={x.id}>{fmtDate(x.date, lang, { dateStyle: 'medium', timeStyle: 'short' })} · {statusLabel(s, x.status)}</option>)}
      </select>
      {sessionId && <button className="ip-btn line" disabled={loading || busy !== null} onClick={() => setRefresh(v => v + 1)}>{s.reload}</button>}
    </div>
    <div role={failed ? 'alert' : 'status'} aria-live="polite">{loading ? (ar ? 'جارٍ التحميل…' : 'Loading…') : busy !== null ? s.saving : message}</div>
    {!loading && sessionId && !rows.length && !failed && <p>{s.noStudents}</p>}
    {rows.map(row => <div className="ip-save-row" key={row.id} data-testid={`attendance-student-${row.id}`}>
      <b>{row.firstName}{row.makeup ? (ar ? ' · تعويض' : ' · Makeup') : ''}</b>
      <span>{row.status ? statusLabel(s, row.status) : s.noAttendance}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['present', 'absent', 'late', 'excused'] as const).map(status =>
          <button key={status} className={`ip-btn ${row.status === status ? 'gold' : 'line'}`}
            aria-pressed={row.status === status} aria-label={`${row.firstName}: ${statusLabel(s, status)}`}
            disabled={busy !== null || blocked || row.status === status} onClick={() => save(row, status)}>
            {statusLabel(s, status)}
          </button>)}
      </div>
    </div>)}
  </div>;
}
