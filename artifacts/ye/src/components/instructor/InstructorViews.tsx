'use client';

import { useMemo, useRef, useState } from 'react';
import type { Dashboard, Lang, Run, Session } from './types';
import { dayKey, fmtDate } from './types';
import { statusLabel, WINDMILL_STAGES, type Strings } from './strings';

export type NoteState = { draft: string; base: string; status: 'idle' | 'saving' | 'saved' | 'error'; error?: string; savedAt?: string };

export function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
export const ICONS = {
  overview: 'M3 3h7v9H3z|M14 3h7v5h-7z|M14 12h7v9h-7z|M3 16h7v5H3z',
  schedule: 'M3 5h18v16H3z|M16 3v4|M8 3v4|M3 10h18',
  roster: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
  notes: 'M12 20h9|M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  resources: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  lab: 'M12 12L12 22|M12 12L4 6|M12 12L20 6|M12 12L12 2|M9 22h6',
  settings: 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8|M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6|M15 3h6v6|M10 14L21 3',
  reload: 'M23 4v6h-6|M20.49 15a9 9 0 1 1-2.12-9.36L23 10',
  full: 'M8 3H5a2 2 0 0 0-2 2v3|M21 8V5a2 2 0 0 0-2-2h-3|M3 16v3a2 2 0 0 0 2 2h3|M16 21h3a2 2 0 0 0 2-2v-3',
  menu: 'M3 12h18|M3 6h18|M3 18h18',
  empty: 'M3 7l9-4 9 4-9 4z|M3 7v10l9 4 9-4V7|M12 11v10',
};

function Empty({ title, body, id }: { title: string; body?: string; id: string }) {
  return (
    <div className="ip-empty" data-testid={`empty-${id}`}>
      <Icon d={ICONS.empty} size={36} />
      <h3>{title}</h3>
      {body && <p>{body}</p>}
    </div>
  );
}

type Flat = { run: Run; session: Session };
function flatten(runs: Run[]): Flat[] {
  return runs.flatMap((run) => run.sessions.map((session) => ({ run, session }))).sort((a, b) => a.session.date.localeCompare(b.session.date));
}
const isUpcoming = (iso: string) => new Date(iso).getTime() >= Date.now() - 3 * 3600_000;

function SessionRow({ f, lang, s, right }: { f: Flat; lang: Lang; s: Strings; right?: React.ReactNode }) {
  const { session, run } = f;
  return (
    <li className="ip-sess" data-testid={`row-session-${session.id}`}>
      <div className="ip-date">
        <b>{fmtDate(session.date, lang, { day: 'numeric' })}</b>
        <small>{fmtDate(session.date, lang, { month: 'short' })}</small>
      </div>
      <div>
        <div className="ip-sess-t">{run.title}</div>
        <div className="ip-sess-m">
          <span dir="ltr">{run.program}</span> · {fmtDate(session.date, lang, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
          {run.location ? ` · ${run.location}` : ''}
        </div>
      </div>
      {right ?? <span className="ip-pill" data-testid={`status-session-${session.id}`}>{statusLabel(s, session.status)}</span>}
    </li>
  );
}

export function Overview({ data, lang, s, notes, go }: { data: Dashboard; lang: Lang; s: Strings; notes: Record<number, NoteState>; go: (t: string) => void }) {
  const flat = flatten(data.runs);
  const upcoming = flat.filter((f) => isUpcoming(f.session.date) && f.session.status !== 'cancelled');
  const studentIds = new Set(data.runs.flatMap((r) => r.students.map((st) => st.id)));
  const withNote = upcoming.filter((f) => (notes[f.session.id]?.base ?? f.session.preparationNote).trim().length > 0).length;
  const stats = [
    [s.activeRuns, data.runs.filter((r) => r.active).length, 'active-runs'],
    [s.students, studentIds.size, 'students'],
    [s.upcoming, upcoming.length, 'upcoming'],
    [s.notesReady, `${withNote}/${upcoming.length}`, 'notes-ready'],
  ] as const;
  return (
    <section>
      <div className="ip-kick">{fmtDate(new Date().toISOString(), lang, { dateStyle: 'full' })}</div>
      <h2 className="ip-h">{s.hello}, {data.viewer.name}</h2>
      <p className="ip-lead">{s.nav.overview}</p>
      <div className="ip-stats">
        {stats.map(([label, v, id]) => (
          <div className="ip-stat" key={id}><b data-testid={`stat-${id}`}>{v}</b><span>{label}</span></div>
        ))}
      </div>
      {data.runs.length === 0 ? <Empty id="runs" title={s.noRuns} body={s.noRunsLead} /> : (
        <div className="ip-grid2">
          <div className="ip-card">
            <h3>{s.nextSessions}</h3>
            {upcoming.length === 0 ? <Empty id="upcoming" title={s.noUpcoming} /> : (
              <ul className="ip-list">{upcoming.slice(0, 6).map((f) => <SessionRow key={f.session.id} f={f} lang={lang} s={s} />)}</ul>
            )}
            <div style={{ marginTop: 12 }}><button className="ip-btn line" onClick={() => go('schedule')} data-testid="button-overview-schedule">{s.nav.schedule}</button></div>
          </div>
          <div className="ip-card">
            <h3>{s.nav.roster}</h3>
            <ul className="ip-list">
              {data.runs.map((r) => (
                <li key={r.id} className="ip-sess" style={{ gridTemplateColumns: '1fr auto' }} data-testid={`card-run-summary-${r.id}`}>
                  <div><div className="ip-sess-t">{r.title}</div><div className="ip-sess-m" dir="ltr" style={{ textAlign: 'start' }}>{r.program}</div></div>
                  <span className="ip-pill gold">{r.students.length}/{r.capacity}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="ip-btn line" onClick={() => go('roster')} data-testid="button-overview-roster">{s.nav.roster}</button>
              <button className="ip-btn gold" onClick={() => go('lab')} data-testid="button-overview-lab">{s.openLab}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function useFilters(runs: Run[]) {
  const [q, setQ] = useState('');
  const [runId, setRunId] = useState('all');
  const filtered = useMemo(() => runs.filter((r) => (runId === 'all' || String(r.id) === runId) &&
    (!q.trim() || `${r.title} ${r.program} ${r.location ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [runs, q, runId]);
  return { q, setQ, runId, setRunId, filtered };
}
function FilterBar({ s, runs, f, children, prefix }: { s: Strings; runs: Run[]; f: ReturnType<typeof useFilters>; children?: React.ReactNode; prefix: string }) {
  return (
    <div className="ip-filters">
      <input className="ip-input" type="search" placeholder={s.search} aria-label={s.search} value={f.q} onChange={(e) => f.setQ(e.target.value)} data-testid={`input-${prefix}-search`} />
      <select className="ip-select" aria-label={s.allRuns} value={f.runId} onChange={(e) => f.setRunId(e.target.value)} data-testid={`select-${prefix}-run`}>
        <option value="all">{s.allRuns}</option>
        {runs.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
      </select>
      {children}
    </div>
  );
}

export function Schedule({ data, lang, s }: { data: Dashboard; lang: Lang; s: Strings }) {
  const f = useFilters(data.runs);
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [day, setDay] = useState('');
  const list = flatten(f.filtered).filter((x) => (when === 'upcoming' ? isUpcoming(x.session.date) : !isUpcoming(x.session.date)) && (!day || dayKey(x.session.date) === day));
  if (when === 'past') list.reverse();
  const groups = new Map<string, Flat[]>();
  list.forEach((x) => { const k = dayKey(x.session.date); groups.set(k, [...(groups.get(k) ?? []), x]); });
  return (
    <section>
      <h2 className="ip-h">{s.nav.schedule}</h2>
      <p className="ip-lead">Asia/Riyadh</p>
      {data.runs.length === 0 ? <Empty id="schedule-runs" title={s.noRuns} body={s.noRunsLead} /> : (<>
        <FilterBar s={s} runs={data.runs} f={f} prefix="schedule">
          <select className="ip-select" aria-label={s.upcomingOnly} value={when} onChange={(e) => setWhen(e.target.value as 'upcoming' | 'past')} data-testid="select-schedule-when">
            <option value="upcoming">{s.upcomingOnly}</option><option value="past">{s.past}</option>
          </select>
          <input className="ip-input" style={{ flex: '0 0 auto', minWidth: 0 }} type="date" aria-label={s.day} value={day} onChange={(e) => setDay(e.target.value)} data-testid="input-schedule-day" />
          {day && <button className="ip-btn line" onClick={() => setDay('')} data-testid="button-schedule-clear-day">{s.allDays}</button>}
        </FilterBar>
        {list.length === 0 ? <Empty id="schedule" title={s.noSessions} /> : [...groups.entries()].map(([k, items]) => (
          <div key={k} className="ip-card ip-run">
            <h3>{fmtDate(items[0].session.date, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
            <ul className="ip-list">{items.map((x) => <SessionRow key={x.session.id} f={x} lang={lang} s={s} />)}</ul>
          </div>
        ))}
      </>)}
    </section>
  );
}

export function Roster({ data, lang, s }: { data: Dashboard; lang: Lang; s: Strings }) {
  const f = useFilters(data.runs);
  return (
    <section>
      <h2 className="ip-h">{s.nav.roster}</h2>
      <p className="ip-lead">{s.attendanceRecorded} · {s.readOnly}</p>
      {data.runs.length === 0 ? <Empty id="roster-runs" title={s.noRuns} body={s.noRunsLead} /> : (<>
        <FilterBar s={s} runs={data.runs} f={f} prefix="roster" />
        {f.filtered.length === 0 ? <Empty id="roster" title={s.noSessions} /> : f.filtered.map((r) => {
          const done = [...r.sessions].filter((x) => x.attendance.length > 0).sort((a, b) => a.date.localeCompare(b.date));
          return (
            <article key={r.id} className="ip-card ip-run" data-testid={`card-run-${r.id}`}>
              <div className="ip-run-h">
                <div>
                  <h3>{r.title}</h3>
                  <div className="ip-meta">
                    <span dir="ltr">{r.program}</span>
                    <span>{fmtDate(r.startDate, lang)} — {fmtDate(r.endDate, lang)}</span>
                    <span>{s.location}: {r.location ?? s.noLocation}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className="ip-pill gold">{s.capacity} {r.students.length}/{r.capacity}</span>
                  <span className={`ip-pill ${r.active ? 'ok' : 'mute'}`}>{r.active ? s.active : s.inactive}</span>
                </div>
              </div>
              {r.students.length === 0 ? <Empty id={`students-${r.id}`} title={s.noStudents} /> : (
                <div className="ip-table-wrap">
                  <table className="ip-table">
                    <thead><tr><th>{s.name}</th><th>{s.born}</th><th>{s.role}</th><th>{s.attendanceRecorded}</th></tr></thead>
                    <tbody>
                      {r.students.map((st) => (
                        <tr key={st.id} data-testid={`row-student-${r.id}-${st.id}`}>
                          <td style={{ fontWeight: 700 }}>{st.firstName}</td>
                          <td className="mono">{st.birthYear ?? '—'}</td>
                          <td><span className="ip-pill mute">{statusLabel(s, st.status)}</span></td>
                          <td>
                            {done.length === 0 ? <span style={{ color: 'var(--mute)', fontSize: 13 }}>{s.noAttendance}</span> : (
                              <div className="ip-dots">
                                {done.map((x, i) => {
                                  const a = x.attendance.find((y) => y.studentId === st.id)?.status ?? '';
                                  return <span key={x.id} className={`ip-dot ${a}`} title={`${fmtDate(x.date, lang)} — ${a ? statusLabel(s, a) : '—'}`} aria-label={`${fmtDate(x.date, lang)}: ${a ? statusLabel(s, a) : '—'}`}>{i + 1}</span>;
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
      </>)}
    </section>
  );
}

export function Notes({ data, lang, s, notes, setDraft, save, readOnly }: {
  data: Dashboard; lang: Lang; s: Strings; notes: Record<number, NoteState>; readOnly: boolean;
  setDraft: (id: number, v: string) => void; save: (id: number) => void;
}) {
  const f = useFilters(data.runs);
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const list = flatten(f.filtered).filter((x) => (when === 'upcoming' ? isUpcoming(x.session.date) : !isUpcoming(x.session.date)));
  if (when === 'past') list.reverse();
  return (
    <section>
      <h2 className="ip-h">{s.nav.notes}</h2>
      <p className="ip-lead">{s.prepHint}</p>
      {data.runs.length === 0 ? <Empty id="notes-runs" title={s.noRuns} body={s.noRunsLead} /> : (<>
        <FilterBar s={s} runs={data.runs} f={f} prefix="notes">
          <select className="ip-select" aria-label={s.upcomingOnly} value={when} onChange={(e) => setWhen(e.target.value as 'upcoming' | 'past')} data-testid="select-notes-when">
            <option value="upcoming">{s.upcomingOnly}</option><option value="past">{s.past}</option>
          </select>
        </FilterBar>
        {list.length === 0 ? <Empty id="notes" title={s.noSessions} /> : list.map((x) => {
          const n = notes[x.session.id] ?? { draft: x.session.preparationNote, base: x.session.preparationNote, status: 'idle' as const };
          const dirty = n.draft !== n.base;
          const tooLong = n.draft.length > 5000;
          return (
            <article key={x.session.id} className="ip-card ip-run" data-testid={`card-note-${x.session.id}`}>
              <ul className="ip-list" style={{ marginBottom: 12 }}><SessionRow f={x} lang={lang} s={s} /></ul>
              {x.session.note && <p style={{ margin: '0 0 10px', fontSize: 14, color: '#2B355A' }}><b>{s.sessionNote}:</b> {x.session.note}</p>}
              <div className="ip-note-head">
                <label htmlFor={`note-${x.session.id}`} style={{ fontWeight: 800 }}>{s.prepLabel}</label>
                {readOnly && <span className="ip-pill gold">{s.readOnly}</span>}
              </div>
              <textarea id={`note-${x.session.id}`} className="ip-textarea" value={n.draft} readOnly={readOnly} maxLength={readOnly ? undefined : 5200}
                onChange={(e) => setDraft(x.session.id, e.target.value)} data-testid={`input-note-${x.session.id}`} />
              <div className="ip-save-row">
                <span className="mono" style={{ color: tooLong ? 'var(--bad)' : undefined }}>{n.draft.length}/5000</span>
                <span aria-live="polite" data-testid={`status-note-${x.session.id}`}>
                  {n.status === 'saving' && <span className="ip-state" style={{ color: 'var(--blue)' }}>{s.saving}</span>}
                  {n.status === 'error' && <span className="ip-state" style={{ color: 'var(--bad)' }}>{n.error ?? s.saveFailed}</span>}
                  {n.status !== 'saving' && n.status !== 'error' && dirty && <span className="ip-state" style={{ color: 'var(--warn)' }}>{s.unsaved}</span>}
                  {n.status === 'saved' && !dirty && <span className="ip-state" style={{ color: 'var(--ok)' }}>{s.saved}{n.savedAt ? ` · ${fmtDate(n.savedAt, lang, { timeStyle: 'short' })}` : ''}</span>}
                </span>
                {!readOnly && (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button className="ip-btn line" disabled={!dirty || n.status === 'saving'} onClick={() => setDraft(x.session.id, n.base)} data-testid={`button-revert-note-${x.session.id}`}>{s.discard}</button>
                    <button className="ip-btn" disabled={!dirty || tooLong || n.status === 'saving'} onClick={() => save(x.session.id)} data-testid={`button-save-note-${x.session.id}`}>{n.status === 'saving' ? s.saving : s.save}</button>
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </>)}
    </section>
  );
}

export function Resources({ lang, s, go }: { lang: Lang; s: Strings; go: (t: string) => void }) {
  return (
    <section>
      <div className="ip-kick" dir="ltr" style={{ textAlign: 'start' }}>Bricks Challenge · BC.013</div>
      <h2 className="ip-h">{s.libTitle}</h2>
      <p className="ip-lead">{s.libLead}</p>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>{s.stagesTitle}</h3>
          <ol className="ip-stages">
            {WINDMILL_STAGES.map((st) => (
              <li key={st.n} data-testid={`item-stage-${st.n}`}><b>{st.n}</b><span>{st[lang]}<small>{lang === 'ar' ? `صفحة الدليل ${st.page}` : `Guide page ${st.page}`}</small></span></li>
            ))}
          </ol>
        </div>
        <div className="ip-card">
          <h3>{s.howTo}</h3>
          <ul className="ip-tips">{s.tips.map((tip, i) => <li key={i}>{tip}</li>)}</ul>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ip-btn gold" onClick={() => go('lab')} data-testid="button-resources-open-lab">{s.openLab}</button>
            <a className="ip-btn line" href="/windmill/" target="_blank" rel="noopener" data-testid="link-resources-lab-newtab">{s.openNewTab}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Lab({ s, visible }: { s: Strings; visible: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  return (
    <section hidden={!visible} aria-hidden={!visible}>
      <div className="ip-lab-bar">
        <div>
          <h2 className="ip-h">{s.nav.lab}</h2>
          <p className="ip-lead" style={{ margin: 0 }}>{s.labNote}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ip-btn line" onClick={() => setKey((k) => k + 1)} data-testid="button-lab-reload"><Icon d={ICONS.reload} size={16} />{s.reload}</button>
          {canFull && <button className="ip-btn line" onClick={() => ref.current?.requestFullscreen?.().catch(() => undefined)} data-testid="button-lab-fullscreen"><Icon d={ICONS.full} size={16} />{s.fullscreen}</button>}
          <a className="ip-btn" href="/windmill/" target="_blank" rel="noopener" data-testid="link-lab-newtab"><Icon d={ICONS.external} size={16} />{s.openNewTab}</a>
        </div>
      </div>
      <iframe key={key} ref={ref} src="/windmill/" title="FunAdemy — Windmill BC.013" className="ip-frame" allow="fullscreen" allowFullScreen loading="lazy" data-testid="iframe-windmill" />
    </section>
  );
}
