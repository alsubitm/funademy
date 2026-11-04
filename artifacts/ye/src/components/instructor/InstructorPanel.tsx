'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './instructor.css';
import { KiteMark } from '@/components/brand/FunAdemyMark';
import type { Dashboard, Lang } from './types';
import { t } from './strings';
import { Icon, ICONS, Lab, Notes, Overview, Resources, Roster, Schedule, type NoteState } from './InstructorViews';

const TABS = ['overview', 'schedule', 'roster', 'notes', 'resources', 'lab', 'settings'] as const;
type Tab = (typeof TABS)[number];

async function readError(res: Response) {
  try { const j = await res.json(); return typeof j?.error === 'string' ? j.error : ''; } catch { return ''; }
}

function Login({ lang, onDone }: { lang: Lang; onDone: () => void }) {
  const s = t(lang);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/svc/instructor/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: email.trim(), password }) });
      if (res.ok) { setPassword(''); onDone(); return; }
      setPassword('');
      setErr(res.status === 401 ? s.errInvalid : res.status === 429 ? s.errRate : res.status === 503 ? s.errUnavailable : s.errGeneric);
    } catch { setErr(s.errGeneric); } finally { setBusy(false); }
  };
  return (
    <div className="ip ip-login" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <form className="ip-login-card" onSubmit={submit} data-testid="form-instructor-login">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
          <div className="ip-brand-mark"><KiteMark size={26} dark full={false} /></div>
          <div><div className="ip-kick">FunAdemy</div><h1 className="ip-h" style={{ fontSize: 26, margin: 0 }}>{s.loginTitle}</h1></div>
        </div>
        <p className="ip-lead" style={{ marginBottom: 6 }}>{s.loginLead}</p>
        <label htmlFor="ip-email">{s.email}</label>
        <input id="ip-email" className="ip-input" type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-instructor-email" />
        <label htmlFor="ip-pass">{s.password}</label>
        <input id="ip-pass" className="ip-input" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-instructor-password" />
        {err && <div className="ip-error" role="alert" style={{ marginTop: 14 }} data-testid="text-login-error">{err}</div>}
        <button className="ip-btn gold" style={{ width: '100%', marginTop: 20 }} disabled={busy} data-testid="button-instructor-login">{busy ? s.signingIn : s.signIn}</button>
      </form>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="ip" data-testid="status-instructor-loading" aria-busy="true">
      <aside className="ip-side" />
      <main className="ip-main">
        <div className="ip-skel" style={{ height: 36, width: 280, marginBottom: 24 }} />
        <div className="ip-stats">{[0, 1, 2, 3].map((i) => <div key={i} className="ip-skel" style={{ height: 96 }} />)}</div>
        <div className="ip-skel" style={{ height: 320 }} />
      </main>
    </div>
  );
}

export function InstructorPanel({ lang }: { lang: Lang }) {
  const s = t(lang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [state, setState] = useState<'loading' | 'auth' | 'error' | 'ready'>('loading');
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [labMounted, setLabMounted] = useState(false);
  const [notes, setNotes] = useState<Record<number, NoteState>>({});

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/svc/instructor/dashboard', { cache: 'no-store', credentials: 'include' });
      if (res.status === 401) { setState('auth'); return; }
      if (!res.ok) throw new Error('load');
      const d: Dashboard = await res.json();
      setData(d);
      setNotes((prev) => {
        const next: Record<number, NoteState> = {};
        d.runs.forEach((r) => r.sessions.forEach((x) => {
          const p = prev[x.id];
          next[x.id] = p && p.draft !== p.base ? { ...p, base: x.preparationNote } : { draft: x.preparationNote, base: x.preparationNote, status: p?.status === 'saved' ? 'saved' : 'idle', savedAt: p?.savedAt };
        }));
        return next;
      });
      setState('ready');
    } catch { setState('error'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const anyDirty = Object.values(notes).some((n) => n.draft !== n.base);
  useEffect(() => {
    if (!anyDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [anyDirty]);

  const isAdmin = data?.viewer.role === 'admin';

  const setDraft = useCallback((id: number, v: string) => {
    setNotes((p) => ({ ...p, [id]: { ...(p[id] ?? { base: '', status: 'idle' }), draft: v, status: p[id]?.status === 'error' ? 'idle' : (p[id]?.status ?? 'idle'), error: undefined } as NoteState }));
  }, []);

  const save = useCallback(async (id: number) => {
    const text = notesRef.current[id]?.draft ?? '';
    setNotes((p) => ({ ...p, [id]: { ...p[id], status: 'saving', error: undefined } }));
    try {
      const res = await fetch('/svc/instructor/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ sessionId: id, text }) });
      if (res.status === 401) { setState('auth'); return; }
      if (!res.ok) {
        const code = await readError(res);
        const msg = res.status === 403 || code === 'forbidden' ? s.noteForbidden : /long|max|length/i.test(code) ? s.noteTooLong : s.saveFailed;
        setNotes((p) => ({ ...p, [id]: { ...p[id], status: 'error', error: msg } }));
        return;
      }
      const j = await res.json().catch(() => ({}));
      setNotes((p) => ({ ...p, [id]: { ...p[id], base: text, status: 'saved', savedAt: j?.updatedAt ?? new Date().toISOString() } }));
    } catch {
      setNotes((p) => ({ ...p, [id]: { ...p[id], status: 'error', error: s.saveFailed } }));
    }
  }, [s]);

  const go = (next: string) => {
    const n = next as Tab;
    if (n === 'lab') setLabMounted(true);
    setTab(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  const logout = async () => {
    if (anyDirty && !window.confirm(s.leaveWarn)) return;
    await fetch('/svc/instructor/session', { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
    setData(null); setNotes({}); setLabMounted(false); setTab('overview'); setState('auth');
  };

  if (state === 'loading' && !data) return <Skeleton />;
  if (state === 'auth') return <Login lang={lang} onDone={load} />;
  if (state === 'error' || !data) {
    return (
      <div className="ip ip-login" dir={dir}>
        <div className="ip-login-card">
          <h1 className="ip-h" style={{ fontSize: 24 }}>{s.loadError}</h1>
          <button className="ip-btn" style={{ marginTop: 16 }} onClick={load} data-testid="button-instructor-retry">{s.retry}</button>
        </div>
      </div>
    );
  }

  const adminHref = '/admin';
  const navBtn = (id: Tab, mobile = false) => (
    <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)} data-testid={`${mobile ? 'mobnav' : 'nav'}-instructor-${id}`}>
      <Icon d={ICONS[id]} size={mobile ? 20 : 20} /><span>{s.nav[id]}</span>
    </button>
  );
  const exitControl = isAdmin
    ? <a className="ip-ghost" href={adminHref} data-testid="link-instructor-back-admin">{s.backAdmin}</a>
    : <button className="ip-ghost" onClick={logout} data-testid="button-instructor-logout"><Icon d={ICONS.logout} size={16} />{s.logout}</button>;

  return (
    <div className="ip" dir={dir} lang={lang}>
      <aside className="ip-side" aria-label={s.menu}>
        <div className="ip-brand">
          <div className="ip-brand-mark"><KiteMark size={26} dark full={false} /></div>
          <div><h1>{s.brand}</h1><small>{s.sub}</small></div>
        </div>
        <nav className="ip-nav">{TABS.map((id) => navBtn(id))}</nav>
        <div className="ip-side-foot">
          <div className="ip-who"><b data-testid="text-viewer-name">{data.viewer.name}</b>{isAdmin ? s.roleAdmin : s.roleInstructor}</div>
          {exitControl}
        </div>
      </aside>
      <header className="ip-top">
        <h1>{s.brand}</h1>
        {isAdmin
          ? <a href={adminHref} className="ip-ghost" style={{ padding: '6px 10px', fontSize: 12 }} data-testid="link-instructor-back-admin-mobile">{s.backAdmin}</a>
          : <button onClick={logout} aria-label={s.logout} data-testid="button-instructor-logout-mobile"><Icon d={ICONS.logout} size={18} /></button>}
      </header>
      <nav className="ip-mobnav" aria-label={s.menu}>{TABS.map((id) => navBtn(id, true))}</nav>

      <main className="ip-main">
        {isAdmin && (
          <div className="ip-banner" role="status" data-testid="banner-admin-preview">
            <span>{s.adminPreview}</span><a href={adminHref}>{s.backAdmin}</a>
          </div>
        )}
        {state === 'loading' && <div className="ip-skel" style={{ height: 4, marginBottom: 12 }} />}
        {tab === 'overview' && <Overview data={data} lang={lang} s={s} notes={notes} go={go} />}
        {tab === 'schedule' && <Schedule data={data} lang={lang} s={s} />}
        {tab === 'roster' && <Roster data={data} lang={lang} s={s} onAttendanceSaved={(sessionId, studentId, status) => {
          setData(prev => prev && ({ ...prev, runs: prev.runs.map(run => ({
            ...run, sessions: run.sessions.map(session => session.id !== sessionId ? session : {
              ...session, attendance: [...session.attendance.filter(a => a.studentId !== studentId), { studentId, status }],
            }),
          })) }));
        }} />}
        {tab === 'notes' && <Notes data={data} lang={lang} s={s} notes={notes} setDraft={setDraft} save={save} readOnly={isAdmin} />}
        {tab === 'resources' && <Resources lang={lang} s={s} go={go} />}
        {labMounted && <Lab s={s} visible={tab === 'lab'} />}
        {tab === 'settings' && (
          <section>
            <h2 className="ip-h">{s.nav.settings}</h2>
            <p className="ip-lead">{s.readOnly}</p>
            <div className="ip-card" style={{ maxWidth: 640 }}>
              <h3>{s.profile}</h3>
              <dl className="ip-dl">
                <dt>{s.name}</dt><dd data-testid="text-profile-name">{data.viewer.name}</dd>
                <dt>{s.email}</dt><dd dir="ltr" style={{ textAlign: 'start' }} data-testid="text-profile-email">{data.viewer.email ?? '—'}</dd>
                <dt>{s.role}</dt><dd data-testid="text-profile-role">{isAdmin ? s.roleAdmin : s.roleInstructor}</dd>
              </dl>
              <p style={{ color: 'var(--mute)', fontSize: 14, lineHeight: 1.7, margin: '18px 0' }}>{s.contactAdmin}</p>
              {isAdmin
                ? <a className="ip-btn" href={adminHref} data-testid="link-settings-back-admin">{s.backAdmin}</a>
                : <button className="ip-btn" onClick={logout} data-testid="button-settings-logout"><Icon d={ICONS.logout} size={16} />{s.logout}</button>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
