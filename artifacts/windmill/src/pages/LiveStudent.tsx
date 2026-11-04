import { useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { Languages } from 'lucide-react';
import { FunAdemyWordmark } from '@/components/brand/FunAdemyMark';
import { LiveModel, LIVE_TOTAL, liveStepTitle } from '@/components/live/LiveModel';

type L = 'ar' | 'en';
type Q = { id: string; ar: string; en: string; options: { ar: string; en: string }[] };
type Room = { id: string; title: string; startsAt: string; durationMin: number; phase: 'waiting' | 'teaching' | 'quiz' | 'ended'; step: number; motor: boolean; speed: number; reverse: boolean; meetUrl: string | null };
type Data = { room: Room; name: string; questions: Q[]; submission: { score: number; total: number } | null };

const S = {
  ar: { live: 'حصة تجريبية مباشرة', hi: (n: string) => `أهلاً ${n}`, waiting: 'الحصة لم تبدأ بعد. سيبدأ المدرّب قريباً.', teaching: 'المدرّب يبني النموذج الآن. تابع معه.', quiz: 'اختبار قصير', ended: 'انتهت الحصة. شكراً لحضورك.', meet: 'افتح Google Meet', noMeet: 'رابط الاجتماع لم يجهز بعد.', starts: 'الموعد (بتوقيت الرياض)', step: (n: number) => `الخطوة ${n} من ${LIVE_TOTAL}`, submit: 'إرسال الإجابات', sending: 'جارٍ الإرسال…', once: 'يمكنك الإرسال مرة واحدة فقط.', answerAll: 'أجب عن كل الأسئلة أولاً.', result: (s: number, t: number) => `نتيجتك: ${s} من ${t}`, reconnect: 'انقطع الاتصال. نعيد المحاولة… إجاباتك محفوظة في هذه الصفحة.', noAccess: 'هذا الرابط غير صالح أو انتهت صلاحيته. تواصل مع FunAdemy للحصول على دعوة جديدة.', loading: 'جارٍ التحميل…', failed: 'تعذّر الإرسال. حاول مرة أخرى.', motorOn: 'المحرك يعمل', motorOff: 'المحرك متوقف', model: 'نموذج الطاحونة المتزامن', readonly: 'يتحكم المدرّب بالنموذج.' },
  en: { live: 'Live trial class', hi: (n: string) => `Welcome, ${n}`, waiting: 'Class has not started yet. Your instructor will begin shortly.', teaching: 'Your instructor is building the model. Follow along.', quiz: 'Quick quiz', ended: 'Class has ended. Thanks for joining.', meet: 'Open Google Meet', noMeet: 'Meeting link is not ready yet.', starts: 'Time (Riyadh)', step: (n: number) => `Step ${n} of ${LIVE_TOTAL}`, submit: 'Submit answers', sending: 'Submitting…', once: 'You can submit only once.', answerAll: 'Answer every question first.', result: (s: number, t: number) => `Your score: ${s} of ${t}`, reconnect: 'Connection lost. Retrying… your answers are kept on this page.', noAccess: 'This link is invalid or has expired. Contact FunAdemy for a new invitation.', loading: 'Loading…', failed: 'Could not submit. Try again.', motorOn: 'Motor running', motorOff: 'Motor stopped', model: 'Synchronized windmill model', readonly: 'Your instructor controls the model.' },
};

export default function LiveStudent() {
  const { token = '' } = useParams<{ token: string }>();
  const [lang, setLang] = useState<L>('ar');
  const t = S[lang];
  const [data, setData] = useState<Data | null>(null);
  const [denied, setDenied] = useState(false);
  const [stale, setStale] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const url = `/svc/live-lab/student?token=${encodeURIComponent(token)}`;
  const urlRef = useRef(url); urlRef.current = url;

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
  useEffect(() => {
    setData(null); setDenied(false); setStale(false); setAnswers({}); setMsg(''); setBusy(false);
    let alive = true; let timer = 0;
    const load = async () => {
      try {
        const res = await fetch(urlRef.current, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
        if ([401, 403, 404, 410].includes(res.status)) { if (alive) { setData(null); setDenied(true); } return; }
        if (!res.ok) throw new Error();
        const d: Data = await res.json();
        if (alive) { setData(d); setStale(false); }
      } catch { if (alive) setStale(true); }
      if (alive) timer = window.setTimeout(load, 2000);
    };
    load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [token]);

  const submit = async () => {
    if (!data) return;
    const arr = data.questions.map((q) => answers[q.id]);
    if (arr.some((a) => a === undefined)) { setMsg(t.answerAll); return; }
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/svc/live-lab/student', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, referrerPolicy: 'no-referrer', body: JSON.stringify({ token, answers: arr }) });
      if ([401, 403, 404, 410].includes(res.status)) { setDenied(true); return; }
      const j = await res.json().catch(() => ({}));
      if (res.ok && typeof j.score === 'number') setData((d) => d && { ...d, submission: { score: j.score, total: j.total } });
      else if (j?.error === 'quiz_closed') setMsg(lang === 'ar' ? 'الاختبار مغلق.' : 'The quiz is closed.');
      else setMsg(t.failed);
    } catch { setMsg(t.failed); } finally { setBusy(false); }
  };

  const head = (
    <header className="topbar">
      <FunAdemyWordmark sub={t.live} />
      <div className="top-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} data-testid="button-live-language">
          <Languages size={18} aria-hidden="true" />{lang === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>
    </header>
  );
  if (denied) return <div className="lab">{head}<main className="panel" role="alert" style={{ margin: 24, padding: 32 }} data-testid="status-live-no-access"><h1 className="display" style={{ fontSize: 28 }}>{lang === 'ar' ? 'لا يمكن الوصول' : 'No access'}</h1><p>{t.noAccess}</p></main></div>;
  if (!data) return <div className="lab">{head}<main role="status" style={{ padding: 32 }}>{stale ? t.reconnect : t.loading}</main></div>;

  const r = data.room;
  const when = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { timeZone: 'Asia/Riyadh', dateStyle: 'full', timeStyle: 'short' }).format(new Date(r.startsAt));
  const phaseText = { waiting: t.waiting, teaching: t.teaching, quiz: t.quiz, ended: t.ended }[r.phase];
  const showModel = r.phase === 'teaching' || r.phase === 'quiz';
  return (
    <div className="lab">
      {head}
      {stale && <div className="notice" role="status" data-testid="status-live-reconnecting">{t.reconnect}</div>}
      <section className="lesson-head">
        <div className="lh-main">
          <p className="eyebrow">{t.hi(data.name)}</p>
          <h1 className="display" data-testid="text-live-title">{r.title}</h1>
          <p className="objective" role="status" aria-live="polite" data-testid="text-live-phase">{phaseText}</p>
          <p className="muted small">{t.starts}: <span data-testid="text-live-time">{when}</span> · {r.durationMin}′</p>
        </div>
        <div className="lh-progress">
          {r.phase !== 'ended' && (r.meetUrl
            ? <a className="btn btn-motor ready" href={r.meetUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-testid="link-live-meet">{t.meet}</a>
            : <p className="muted small" data-testid="text-live-no-meet">{t.noMeet}</p>)}
        </div>
      </section>
      <main className="workspace" style={{ gridTemplateColumns: '1fr' }}>
        {showModel && (
          <section className="panel panel-mat" aria-labelledby="live-model-h">
            <div className="mat-head">
              <h2 id="live-model-h" className="mini-h">{t.model}</h2>
              <span className={`motor-pill ${r.motor && !stale && r.step >= LIVE_TOTAL ? 'on' : ''}`} role="status" data-testid="status-live-motor"><span className="dot" aria-hidden="true" />{r.motor && !stale && r.step >= LIVE_TOTAL ? t.motorOn : t.motorOff}</span>
            </div>
            <LiveModel paused={stale} state={r} label={`${t.model}. ${t.step(r.step)}`} />
            <p className="step-of" data-testid="text-live-step">{t.step(r.step)}{r.step > 0 ? ` · ${liveStepTitle(r.step, lang)}` : ''}</p>
            <p className="muted small">{t.readonly}</p>
          </section>
        )}
        {(r.phase === 'quiz' || data.submission) && (
          <section className="panel" aria-labelledby="quiz-h" data-testid="section-live-quiz">
            <h2 id="quiz-h" className="step-title">{t.quiz}</h2>
            {data.submission ? (
              <p className="badge-ok" role="status" data-testid="text-live-score" style={{ fontSize: 20 }}>{t.result(data.submission.score, data.submission.total)}</p>
            ) : (
              <>
                {data.questions.map((q, qi) => (
                  <fieldset key={q.id} className="quiz" style={{ marginBottom: 16 }}>
                    <legend><span className="mono">{qi + 1}.</span> {q[lang]}</legend>
                    {q.options.map((o, oi) => (
                      <button key={oi} type="button" className="quiz-opt" aria-pressed={answers[q.id] === oi} style={answers[q.id] === oi ? { outline: '3px solid currentColor' } : undefined}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} data-testid={`option-${q.id}-${oi}`}>
                        <span className="mono">{oi + 1}</span>{o[lang]}
                      </button>
                    ))}
                  </fieldset>
                ))}
                <p className="muted small">{t.once}</p>
                {msg && <p className="fb fb-warn" role="alert" data-testid="text-live-quiz-msg">{msg}</p>}
                <button type="button" className="btn btn-motor ready" disabled={busy || stale || r.phase !== 'quiz'} onClick={submit} data-testid="button-live-submit">{busy ? t.sending : t.submit}</button>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
