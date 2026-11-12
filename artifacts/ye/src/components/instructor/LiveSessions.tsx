'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './instructor.css';
import type { LiveGuest, LivePhase, LiveRoom, LiveStaffResponse } from '@/lib/live-lab-types';

type Lang = 'ar' | 'en';
type Room = LiveRoom & { guests: LiveGuest[] };
const TOTAL = 14;
const MAX_GUESTS = 16;

const T = {
  ar: {
    title: 'الحصص التجريبية المباشرة', lead: 'حصص Windmill مجانية عبر الإنترنت بقيادة المدرّب. البرامج الحضورية المعتادة لا تتأثر.',
    create: 'جدولة حصة', name: 'العنوان', start: 'الموعد (بتوقيت الرياض)', dur: 'المدة (دقيقة)', teacher: 'المدرّب', save: 'إنشاء', saving: 'جارٍ الإنشاء…',
    empty: 'لا توجد حصص مباشرة بعد', emptyLead: 'جدول أول حصة تجريبية ثم أضف الضيوف.', load: 'تعذّر تحميل الحصص.', retry: 'إعادة المحاولة', reconnect: 'انقطع الاتصال، نعيد المحاولة…',
    phase: { waiting: 'بانتظار البدء', teaching: 'قيد الشرح', quiz: 'الاختبار', ended: 'انتهت' } as Record<LivePhase, string>,
    startClass: 'بدء الحصة', toQuiz: 'فتح الاختبار', end: 'إنهاء الحصة', needStep: 'الاختبار والمحرك يتطلبان إكمال الخطوة 14.',
    stage: 'التحكم بالنموذج', prev: 'السابق', next: 'التالي', step: (n: number) => `الخطوة ${n} من ${TOTAL}`, motorOn: 'تشغيل المحرك', motorOff: 'إيقاف المحرك', speed: 'السرعة', reverse: 'عكس الاتجاه',
    preview: 'ما يراه الطلاب', guests: 'الضيوف', addGuest: 'إضافة ضيف', gName: 'اسم الطالب', gEmail: 'بريد ولي الأمر', add: 'إضافة', onlyWaiting: 'تُضاف الدعوات قبل بدء الحصة فقط.', max: `الحد الأقصى ${MAX_GUESTS} طالباً. أضف كل أخ أو أخت باسمه وبنفس بريد ولي الأمر؛ لكل طالب مقعد ورابط خاص ونتيجة مستقلة.`,
    copy: 'نسخ رابط المختبر الخاص', share: 'مشاركة', copied: 'نُسخ', revoke: 'إلغاء الدعوة', restore: 'إعادة التفعيل', revoked: 'ملغاة',
    editName: 'تصحيح الاسم', saveName: 'حفظ الاسم', cancelEdit: 'إلغاء', namePlaceholder: 'اسم الطالب',
    privateNote: 'يُرسل الرابط تلقائياً ببريد خاص بعد تأكيد موافقة ولي الأمر، ولا يظهر في التقويم المشترك. قبول مزود البريد لا يضمن وصوله. ينتهي الرابط بعد 24 ساعة من نهاية الموعد.', revokeNote: 'إلغاء الدعوة يمنع دخول المختبر فوراً، لكن قائمة حضور التقويم تتحدّث بعد المزامنة فقط. قبول أو إخراج المشاركين في Meet يتم من المضيف بشكل منفصل.', cancel: 'إلغاء الحصة', confirmCancel: 'إلغاء هذه الحصة نهائياً؟', noAccess: 'انتهت صلاحية الدخول. حدّث الصفحة وسجّل الدخول مجدداً.',
    emailConsent: 'أؤكد موافقة ولي الأمر على استلام رابط الطالب الخاص بهذا البريد.',
    emailSend: 'تأكيد الموافقة وإرسال الرابط', emailRetry: 'إعادة محاولة البريد',
    emailState: { not_requested: 'البريد: بانتظار الموافقة', pending: 'البريد: لم يُؤكد الإرسال — أعد المحاولة', sent: 'البريد: قبله مزود الإرسال', failed: 'البريد: تعذّر تأكيد الإرسال — أعد المحاولة', review_required: 'البريد: نتيجة غير مؤكدة؛ راجع Resend أو شارك الرابط يدوياً. توقفت المحاولات لمنع التكرار.' } as Record<string, string>,
    calendar: 'دعوات التقويم', send: 'إرسال دعوات التقويم', sync: 'إعادة المزامنة', syncing: 'جارٍ المزامنة…',
    calNote: 'دعوة Google Calendar تحتوي رابط Meet المشترك فقط، ودعوة واحدة لكل بريد ولي أمر. يبقى البريد في التقويم ما دام لأحد الأبناء دعوة مفعّلة. قبول Google للتحديث لا يضمن وصول البريد.',
    cal: { not_sent: 'لم تُرسل', needs_sync: 'تحتاج مزامنة', ready: 'جاهزة', pending: 'Google يجهّز Meet — أعد المزامنة بعد قليل' } as Record<string, string>,
    meetPending: 'رابط Meet لم يجهز بعد. أعد المزامنة.', meetReady: 'رابط Meet جاهز.', openMeet: 'فتح Meet',
    invited: 'قُبلت في التقويم', notInvited: 'لم تُدرج في التقويم', joined: 'دخل', notJoined: 'لم يدخل', score: (s: number) => `النتيجة ${s}`, noScore: 'لم يُرسل الاختبار',
    stale: 'تغيّرت الحصة من جهاز آخر. تم التحديث، أعد المحاولة.', failed: 'تعذّر التنفيذ.', all: 'كل المدرّبين', confirmEnd: 'إنهاء الحصة نهائياً؟ لا يمكن إعادة تشغيلها.',
  },
  en: {
    title: 'Live trial classes', lead: 'Free instructor-led online Windmill classes. Regular in-person programs are unaffected.',
    create: 'Schedule a class', name: 'Title', start: 'Start (Riyadh time)', dur: 'Duration (min)', teacher: 'Instructor', save: 'Create', saving: 'Creating…',
    empty: 'No live classes yet', emptyLead: 'Schedule a first trial class, then add guests.', load: 'Could not load classes.', retry: 'Retry', reconnect: 'Connection lost, retrying…',
    phase: { waiting: 'Waiting', teaching: 'Teaching', quiz: 'Quiz', ended: 'Ended' } as Record<LivePhase, string>,
    startClass: 'Start class', toQuiz: 'Unlock quiz', end: 'End class', needStep: 'Quiz and motor need step 14 complete.',
    stage: 'Stage control', prev: 'Previous', next: 'Next', step: (n: number) => `Step ${n} of ${TOTAL}`, motorOn: 'Run motor', motorOff: 'Stop motor', speed: 'Speed', reverse: 'Reverse',
    preview: 'What students see', guests: 'Guests', addGuest: 'Add guest', gName: 'Student name', gEmail: 'Guardian email', add: 'Add', onlyWaiting: 'Guests can be added only before the class starts.', max: `Up to ${MAX_GUESTS} students. Add each sibling by name using the same guardian email; each student gets a seat, private link, and separate result.`,
    copy: 'Copy private lab link', share: 'Share', copied: 'Copied', revoke: 'Revoke', restore: 'Re-enable', revoked: 'Revoked',
    editName: 'Correct name', saveName: 'Save name', cancelEdit: 'Cancel', namePlaceholder: 'Student name',
    privateNote: 'The link is emailed privately once guardian consent is confirmed, never included in shared Calendar invitations. Provider acceptance does not guarantee delivery. Links expire 24 hours after the scheduled end.', revokeNote: 'Revoking blocks lab access immediately, but the Calendar attendee list updates only after Sync. The Meet host admits or removes participants separately.', cancel: 'Cancel session', confirmCancel: 'Cancel this session permanently?', noAccess: 'Access expired. Refresh and sign in again.',
    emailConsent: 'I confirm the guardian agreed to receive this student’s private link at this email address.',
    emailSend: 'Confirm consent and email link', emailRetry: 'Retry private email',
    emailState: { not_requested: 'Email: awaiting consent', pending: 'Email: send unconfirmed — retry', sent: 'Email: accepted by provider', failed: 'Email: send unconfirmed — retry', review_required: 'Email: outcome uncertain; check Resend or share privately. Retries stopped to prevent duplicates.' } as Record<string, string>,
    calendar: 'Calendar invitations', send: 'Send calendar invitations', sync: 'Retry sync', syncing: 'Syncing…',
    calNote: 'Google Calendar sends one invitation per guardian email, containing only the shared Meet link. The email stays on the calendar while any sibling has an active invitation. Google accepting the update does not guarantee email delivery.',
    cal: { not_sent: 'Not sent', needs_sync: 'Needs sync', ready: 'Ready', pending: 'Google is preparing Meet — retry sync shortly' } as Record<string, string>,
    meetPending: 'Meet link is not ready. Retry sync.', meetReady: 'Meet link ready.', openMeet: 'Open Meet',
    invited: 'Accepted by Calendar', notInvited: 'Not on calendar yet', joined: 'Joined', notJoined: 'Not joined', score: (s: number) => `Score ${s}`, noScore: 'Quiz not submitted',
    stale: 'Class changed elsewhere. Refreshed — try again.', failed: 'Action failed.', all: 'All instructors', confirmEnd: 'End the class permanently? It cannot be restarted.',
  },
};

const ERR: Record<string, { ar: string; en: string }> = {
  forbidden: { ar: 'غير مسموح.', en: 'Not allowed.' },
  session_full: { ar: 'تم بلوغ الحد الأقصى للضيوف.', en: 'Guest limit reached.' },
  session_started: { ar: 'لا يمكن الإضافة بعد بدء الحصة.', en: 'Cannot add after the class starts.' },
  finish_lesson_first: { ar: 'أكمل الخطوة 14 أولاً.', en: 'Complete step 14 first.' },
  stale_version: { ar: 'تغيّرت الحصة من جهاز آخر. تم التحديث، أعد المحاولة.', en: 'Class changed elsewhere. Refreshed — try again.' },
  invalid_input: { ar: 'بيانات غير صالحة. راجع الحقول.', en: 'Invalid input. Check the fields.' },
  idempotency_conflict: { ar: 'تعذّر تأكيد الدعوة بسبب اختلاف البيانات. أعد المحاولة.', en: 'This invitation key was used with different details. Retry the invitation.' },
  quiz_closed: { ar: 'الاختبار مغلق.', en: 'Quiz is closed.' },
};

const riyadh = (iso: string, lang: Lang) => {
  try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); } catch { return iso; }
};

async function errText(res: Response, lang: Lang, fallback: string) {
  try { const j = await res.json(); const c = typeof j?.error === 'string' ? j.error : ''; return ERR[c]?.[lang] ?? (c ? `${fallback} (${c})` : fallback); } catch { return fallback; }
}

export function LiveSessions({ lang, admin = false }: { lang: Lang; admin?: boolean }) {
  const s = T[lang];
  const [data, setData] = useState<LiveStaffResponse | null>(null);
  const [err, setErr] = useState('');
  const [stale, setStale] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<number | 0>(0);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/svc/live-lab', { cache: 'no-store', credentials: 'include', signal: AbortSignal.timeout(8000) });
      if (res.status === 401 || res.status === 403) { setData(null); setDenied(true); return; }
      if (!res.ok) throw new Error(String(res.status));
      setDenied(false);
      const d: LiveStaffResponse = await res.json();
      setData(d); setStale(false); setErr('');
    } catch { setStale(true); setErr((e) => e || ''); }
  }, []);
  useEffect(() => {
    let alive = true; let timer = 0;
    const tick = async () => { await load(); if (alive) timer = window.setTimeout(tick, 3000); };
    tick();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [load]);

  if (denied) return <section className="ip-live" dir={lang === 'ar' ? 'rtl' : 'ltr'}><h2 className="ip-h">{s.title}</h2><div className="ip-error" role="alert" data-testid="status-live-denied">{s.noAccess}</div></section>;
  if (!data) {
    return (
      <section className="ip-live" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <h2 className="ip-h">{s.title}</h2>
        {stale ? <div className="ip-error" role="alert"><span>{s.load}</span><button className="ip-btn line sm" onClick={load} data-testid="button-live-retry">{s.retry}</button></div>
          : <div className="ip-skel" style={{ height: 220, borderRadius: 20 }} aria-busy="true" data-testid="status-live-loading" />}
      </section>
    );
  }
  const rooms = data.rooms.filter((r) => !filter || r.instructorId === filter).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const room = data.rooms.find((r) => r.id === sel) ?? null;
  const teacher = (id: number) => data.instructors.find((i) => i.id === id)?.name ?? `#${id}`;

  return (
    <section className="ip-live" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} data-testid="section-live-sessions">
      <h2 className="ip-h">{s.title}</h2>
      <p className="ip-lead">{s.lead}</p>
      {stale && <p className="ip-pill gold" role="status" style={{ marginBottom: 12 }} data-testid="status-live-stale">{s.reconnect}</p>}
      {err && <div className="ip-error" role="alert" style={{ marginBottom: 12 }}><span>{err}</span></div>}
      <CreateForm lang={lang} data={data} admin={admin || data.role === 'admin'} onDone={async (id) => { await load(); setSel(id); }} />
      {data.role === 'admin' && data.instructors.length > 1 && (
        <label className="ip-live-row" style={{ margin: '12px 0', fontSize: 13, fontWeight: 700 }}>{s.teacher}
          <select className="ip-select" value={filter} onChange={(e) => setFilter(Number(e.target.value))} data-testid="select-live-filter">
            <option value={0}>{s.all}</option>
            {data.instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
      )}
      {rooms.length === 0 ? (
        <div className="ip-card" style={{ textAlign: 'center', marginTop: 16 }} data-testid="empty-live">
          <h3>{s.empty}</h3><p className="ip-live-note">{s.emptyLead}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {rooms.map((r) => (
            <button key={r.id} type="button" className="ip-card" onClick={() => setSel(sel === r.id ? null : r.id)} aria-expanded={sel === r.id}
              style={{ textAlign: 'start', cursor: 'pointer', borderColor: sel === r.id ? 'var(--blue)' : undefined, font: 'inherit', color: 'inherit' }} data-testid={`card-live-${r.id}`}>
              <div className="ip-live-row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{r.title}</strong>
                <span className={`ip-pill ${r.phase === 'ended' ? 'mute' : r.phase === 'waiting' ? 'gold' : 'ok'}`} data-testid={`status-live-phase-${r.id}`}>{s.phase[r.phase]}</span>
              </div>
              <div className="ip-meta" style={{ marginTop: 6 }}>
                <span>{riyadh(r.startsAt, lang)}</span><span>{r.durationMin}′</span>
                {data.role === 'admin' && <span>{teacher(r.instructorId)}</span>}
                <span>{s.guests}: {r.guests.filter((g) => !g.revoked).length}/{MAX_GUESTS}</span>
                <span>{s.cal[r.calendarStatus] ?? r.calendarStatus}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {room && <RoomPanel key={room.id} lang={lang} room={room} reload={load} setErr={setErr} stale={stale} />}
    </section>
  );
}

function CreateForm({ lang, data, admin, onDone }: { lang: Lang; data: LiveStaffResponse; admin: boolean; onDone: (id: string) => void }) {
  const s = T[lang];
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Windmill');
  const [when, setWhen] = useState('');
  const [dur, setDur] = useState(60);
  const [who, setWho] = useState<number>(data.instructors[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);
  const [e, setE] = useState('');
  if (!open) return <button className="ip-btn gold" onClick={() => setOpen(true)} data-testid="button-live-new">{s.create}</button>;
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setE('');
    if (!title.trim() || !when || !who) return;
    setBusy(true);
    try {
      const startsAt = new Date(`${when}:00+03:00`).toISOString();
      const res = await fetch('/svc/live-lab', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), startsAt, durationMin: Number(dur), instructorId: Number(who) }) });
      if (!res.ok) { setE(await errText(res, lang, T[lang].failed)); return; }
      const j = await res.json(); setOpen(false); onDone(String(j.id));
    } catch { setE(s.failed); } finally { setBusy(false); }
  };
  return (
    <form className="ip-card ip-live-form" onSubmit={submit} data-testid="form-live-create">
      <label>{s.name}<input className="ip-input" required maxLength={120} value={title} onChange={(x) => setTitle(x.target.value)} data-testid="input-live-title" /></label>
      <label>{s.start}<input className="ip-input" type="datetime-local" required value={when} onChange={(x) => setWhen(x.target.value)} dir="ltr" data-testid="input-live-start" /></label>
      <label>{s.dur}<input className="ip-input" type="number" min={15} max={120} step={5} required value={dur} onChange={(x) => setDur(Number(x.target.value))} data-testid="input-live-duration" /></label>
      <label>{s.teacher}
        <select className="ip-select" value={who} onChange={(x) => setWho(Number(x.target.value))} disabled={!admin && data.instructors.length <= 1} data-testid="select-live-instructor">
          {data.instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </label>
      <div className="ip-live-row">
        <button className="ip-btn" disabled={busy} data-testid="button-live-create">{busy ? s.saving : s.save}</button>
        <button type="button" className="ip-btn line" onClick={() => setOpen(false)} data-testid="button-live-cancel">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
      </div>
      {e && <div className="ip-error" role="alert" style={{ gridColumn: '1/-1' }}>{e}</div>}
    </form>
  );
}

function RoomPanel({ lang, room, reload, setErr, stale }: { lang: Lang; room: Room; reload: () => Promise<void>; setErr: (v: string) => void; stale: boolean }) {
  const s = T[lang];
  const [busyRaw, setBusy] = useState(false);
  const busy = busyRaw || stale;
  const [gName, setGName] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [nameEditId, setNameEditId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const guestRequest = useRef<{ signature: string; key: string } | null>(null);
  const roomRef = useRef(room); roomRef.current = room;

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/svc/live-lab', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: roomRef.current.id, version: roomRef.current.version, ...body }) });
      if (res.status === 409) setErr(s.stale);
      else if (res.status === 401 || res.status === 403) setErr(s.noAccess);
      else if (!res.ok) setErr(await errText(res, lang, s.failed));
    } catch { setErr(s.failed); } finally { await reload(); setBusy(false); }
  };
  const guestCall = async (method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/svc/live-lab/invitations', { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: room.id, ...body }) });
      if (!res.ok) { setErr(await errText(res, lang, s.failed)); return false; }
      return true;
    } catch { setErr(s.failed); return false; } finally { await reload(); setBusy(false); }
  };
  const sendEmail = async (g: LiveGuest) => {
    if (!g.emailConsentAt && !window.confirm(s.emailConsent)) return;
    setBusy(true); setEmailMsg('');
    try {
      const res = await fetch('/svc/live-lab/invitations/email', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, guestId: g.id, consent: !g.emailConsentAt }),
      });
      if (!res.ok) { setEmailMsg(await errText(res, lang, s.failed)); return; }
      const result = await res.json();
      setEmailMsg(s.emailState[result.status] ?? s.failed);
    } catch { setEmailMsg(s.failed); } finally { await reload(); setBusy(false); }
  };
  const sync = async () => {
    setSyncBusy(true); setSyncMsg('');
    try {
      const res = await fetch('/svc/live-lab/calendar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: room.id }) });
      if (!res.ok) { setSyncMsg(await errText(res, lang, s.failed)); return; }
      const j = await res.json();
      setSyncMsg(j?.meetUrl ? s.meetReady : s.meetPending);
    } catch { setSyncMsg(s.failed); } finally { await reload(); setSyncBusy(false); }
  };
  const linkOf = (g: LiveGuest) => new URL(g.joinPath, window.location.origin).toString();
  const copy = async (g: LiveGuest) => {
    try { await navigator.clipboard.writeText(linkOf(g)); setCopied(g.id); window.setTimeout(() => setCopied(null), 1800); } catch { window.prompt(s.copy, linkOf(g)); }
  };
  const share = async (g: LiveGuest) => {
    try { await navigator.share({ title: room.title, url: linkOf(g) }); } catch { /* cancelled */ }
  };
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const done = room.step >= TOTAL;
  const teaching = room.phase === 'teaching';
  const ended = room.phase === 'ended';
  const active = room.guests.filter((g) => !g.revoked).length;
  const calLabel = s.cal[room.calendarStatus] ?? room.calendarStatus;

  return (
    <div className="ip-live-grid" style={{ marginTop: 20 }} data-testid={`panel-live-${room.id}`}>
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <div className="ip-card">
          <h3>{room.title}</h3>
          <div className="ip-meta" style={{ marginBottom: 12 }}><span>{riyadh(room.startsAt, lang)}</span><span>{room.durationMin}′</span><span className="ip-pill">{s.phase[room.phase]}</span></div>
          <div className="ip-live-row">
            {room.phase === 'waiting' && <button className="ip-btn" disabled={busy} onClick={() => patch({ phase: 'teaching' })} data-testid="button-live-start">{s.startClass}</button>}
            {room.phase === 'waiting' && <button className="ip-btn line" disabled={busy} onClick={() => window.confirm(s.confirmCancel) && patch({ phase: 'ended' })} data-testid="button-live-cancel-session">{s.cancel}</button>}
            {room.phase === 'teaching' && <button className="ip-btn gold" disabled={busy || !teaching || !done} onClick={() => patch({ phase: 'quiz' })} data-testid="button-live-quiz">{s.toQuiz}</button>}
            {(room.phase === 'teaching' || room.phase === 'quiz') && <button className="ip-btn line" disabled={busy} onClick={() => window.confirm(s.confirmEnd) && patch({ phase: 'ended' })} data-testid="button-live-end">{s.end}</button>}
          </div>
          {room.phase === 'teaching' && !done && <p className="ip-live-note">{s.needStep}</p>}
        </div>

        {(room.phase === 'teaching' || room.phase === 'quiz') && (
          <div className="ip-card" data-testid="card-live-stage">
            <h3>{s.stage}</h3>
            <div className="ip-live-row" style={{ marginBottom: 10 }}>
              <button className="ip-btn line sm" disabled={busy || !teaching || room.step <= 0} onClick={() => patch({ step: room.step - 1, motor: false })} data-testid="button-live-prev">{s.prev}</button>
              <strong aria-live="polite" data-testid="text-live-step">{s.step(room.step)}</strong>
              <button className="ip-btn line sm" disabled={busy || !teaching || room.step >= TOTAL} onClick={() => patch({ step: room.step + 1 })} data-testid="button-live-next">{s.next}</button>
            </div>
            <div className="ip-live-row">
              <button className={`ip-btn sm ${room.motor ? 'gold' : ''}`} disabled={busy || !teaching || !done} aria-pressed={room.motor} onClick={() => patch({ motor: !room.motor })} data-testid="button-live-motor">{room.motor ? s.motorOff : s.motorOn}</button>
              <label className="ip-live-row" style={{ fontSize: 13, fontWeight: 700 }}>{s.speed}
                <select className="ip-select" value={room.speed} disabled={busy || !teaching || !done} onChange={(e) => patch({ speed: Number(e.target.value) })} data-testid="select-live-speed">
                  {[0.25, 0.5, 1, 1.5, 2].map((v) => <option key={v} value={v}>{v}x</option>)}
                </select>
              </label>
              <label className="ip-live-row" style={{ fontSize: 13, fontWeight: 700 }}>
                <input type="checkbox" checked={room.reverse} disabled={busy || !teaching || !done} onChange={(e) => patch({ reverse: e.target.checked })} data-testid="checkbox-live-reverse" />{s.reverse}
              </label>
            </div>
            {teaching && !done && <p className="ip-live-note">{s.needStep}</p>}
          </div>
        )}

        <div className="ip-card" data-testid="card-live-calendar">
          <h3>{s.calendar}</h3>
          <p className="ip-live-row"><span className={`ip-pill ${room.calendarStatus === 'ready' ? 'ok' : room.calendarStatus === 'pending' || room.calendarStatus === 'needs_sync' ? 'gold' : 'mute'}`} data-testid="status-live-calendar">{calLabel}</span>
            {room.meetUrl && <a className="ip-btn line sm" href={room.meetUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-testid="link-live-meet">{s.openMeet}</a>}</p>
          <p className="ip-live-note">{s.calNote}</p>
          <button className="ip-btn" disabled={syncBusy || stale || ended || (active === 0 && room.calendarStatus === 'not_sent')} onClick={sync} data-testid="button-live-sync">
            {syncBusy ? s.syncing : room.calendarStatus === 'not_sent' ? s.send : s.sync}
          </button>
          {syncMsg && <p role="status" className="ip-live-note" data-testid="text-live-sync">{syncMsg}</p>}
        </div>

        <div className="ip-card" data-testid="card-live-guests">
          <h3>{s.guests} <small style={{ color: 'var(--mute)', fontWeight: 600 }}>{active}/{MAX_GUESTS}</small></h3>
          <p className="ip-live-note">{s.privateNote}</p>
          {room.phase === 'waiting' ? (
            <form className="ip-live-form" style={{ marginBottom: 8 }} onSubmit={async (e) => {
              e.preventDefault();
              const name = gName.trim();
              const email = gEmail.trim();
              const signature = JSON.stringify([name, email]);
              if (!guestRequest.current || guestRequest.current.signature !== signature) {
                guestRequest.current = { signature, key: crypto.randomUUID() };
              }
              if (await guestCall('POST', { name, email, emailConsent, idempotencyKey: guestRequest.current.key })) {
                guestRequest.current = null;
                setGName('');
                setGEmail('');
                setEmailConsent(false);
              }
            }}>
              <label>{s.gName}<input className="ip-input" required maxLength={80} value={gName} onChange={(e) => setGName(e.target.value)} data-testid="input-guest-name" /></label>
              <label>{s.gEmail}<input className="ip-input" type="email" dir="ltr" required value={gEmail} onChange={(e) => setGEmail(e.target.value)} data-testid="input-guest-email" /></label>
              <label style={{ gridColumn: '1/-1' }}><span><input type="checkbox" checked={emailConsent} onChange={(e) => setEmailConsent(e.target.checked)} data-testid="checkbox-guest-email-consent" /> {s.emailConsent}</span></label>
              <button className="ip-btn" disabled={busy || active >= MAX_GUESTS} data-testid="button-guest-add">{s.add}</button>
            </form>
          ) : <p className="ip-live-note">{s.onlyWaiting}</p>}
          <p className="ip-live-note">{s.max}</p>
          <p className="ip-live-note">{s.revokeNote}</p>
          {emailMsg && <p role="status" className="ip-live-note">{emailMsg}</p>}
          {room.guests.map((g) => (
            <div key={g.id} className="ip-live-guest" data-testid={`row-guest-${g.id}`}>
              <div style={{ minWidth: 0 }}>
                {nameEditId === g.id ? (
                  <form className="ip-live-row" onSubmit={async (e) => {
                    e.preventDefault();
                    if (await guestCall('PATCH', { guestId: g.id, name: nameDraft.trim() })) setNameEditId(null);
                  }}>
                    <input className="ip-input" required maxLength={80} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                      aria-label={s.namePlaceholder} data-testid={`input-guest-name-edit-${g.id}`} />
                    <button className="ip-btn sm" disabled={busy || !nameDraft.trim()} data-testid={`button-guest-name-save-${g.id}`}>{s.saveName}</button>
                    <button type="button" className="ip-btn line sm" disabled={busy} onClick={() => setNameEditId(null)} data-testid={`button-guest-name-cancel-${g.id}`}>{s.cancelEdit}</button>
                  </form>
                ) : <strong data-testid={`text-guest-name-${g.id}`}>{g.name}</strong>} {g.revoked && <span className="ip-pill bad">{s.revoked}</span>}
                <div className="ip-live-note" dir="ltr" style={{ textAlign: 'start', margin: 0 }}>{g.email}</div>
                <div className="ip-live-note" data-testid={`status-guest-email-${g.id}`}>
                  {s.emailState[g.privateEmailStatus] ?? s.emailState.not_requested}
                  {g.privateEmailSentAt && ` · ${riyadh(g.privateEmailSentAt, lang)}`}
                  {g.privateEmailError && <span dir="ltr"> ({g.privateEmailError})</span>}
                </div>
                <div className="ip-meta" style={{ fontSize: 12 }}>
                  <span>{g.invitedAt ? `${s.invited} · ${riyadh(g.invitedAt, lang)}` : s.notInvited}</span>
                  <span>{g.joinedAt ? `${s.joined} · ${riyadh(g.joinedAt, lang)}` : s.notJoined}</span>
                  <span data-testid={`text-guest-score-${g.id}`}>{g.score !== null ? s.score(g.score) : s.noScore}</span>
                </div>
              </div>
              <div className="ip-live-row">
                {!g.revoked && !ended && !['sent', 'review_required'].includes(g.privateEmailStatus) && <button className="ip-btn line sm" disabled={busy} onClick={() => sendEmail(g)} data-testid={`button-guest-email-${g.id}`}>{g.emailConsentAt ? s.emailRetry : s.emailSend}</button>}
                {!ended && nameEditId !== g.id && <button className="ip-btn line sm" disabled={busy} onClick={() => { setNameDraft(g.name); setNameEditId(g.id); }} data-testid={`button-guest-name-edit-${g.id}`}>{s.editName}</button>}
                {!g.revoked && !ended && <button className="ip-btn line sm" onClick={() => copy(g)} data-testid={`button-guest-copy-${g.id}`}>{copied === g.id ? s.copied : s.copy}</button>}
                {!g.revoked && !ended && canShare && <button className="ip-btn line sm" onClick={() => share(g)} data-testid={`button-guest-share-${g.id}`}>{s.share}</button>}
                {!ended && <button className="ip-btn line sm" disabled={busy} onClick={() => guestCall('PATCH', { guestId: g.id, revoked: !g.revoked })} data-testid={`button-guest-revoke-${g.id}`}>{g.revoked ? s.restore : s.revoke}</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ip-card" style={{ alignSelf: 'start' }}>
        <h3>{s.preview}</h3>
        <iframe className="ip-live-frame" src={`/windmill/live-preview?room=${encodeURIComponent(room.id)}`} title={s.preview} referrerPolicy="no-referrer" data-testid="frame-live-preview" />
      </div>
    </div>
  );
}
