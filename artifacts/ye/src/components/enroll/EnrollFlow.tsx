'use client';

import { useEffect, useMemo, useState } from 'react';
import { enrollDict } from '@/app/(ar)/enroll/dict';
import { arabicDigits, WEEKDAYS_AR, WEEKDAYS_EN } from '@/lib/constants';

type Lang = 'ar' | 'en';
type Student = { id: number; firstName: string; birthYear: number };
type Run = {
  id: number;
  program: { id: number; slug: string; nameAr: string; nameEn: string; ageMin: number; ageMax: number; color: string; kitCode: string };
  titleAr: string | null;
  titleEn: string | null;
  weekday: number;
  time: string;
  format: string;
  location: string | null;
  seatsLeft: number;
  monthlyPriceSar: number;
};
type CartItem = {
  studentId: number;
  studentName: string;
  courseRunId: number;
  programNameAr: string;
  programNameEn: string;
  weekday: number;
  time: string;
  baseSar: number;
  discountPct: number;
  totalSar: number;
};
type Cart = { items: CartItem[]; subtotalSar: number; discountSar: number; totalSar: number };
type DoneItem = Partial<CartItem> & { studentName: string; programNameAr: string; programNameEn: string; totalSar: number; studentId: number; courseRunId: number };
type Done = { reference: string; totalSar: number; discountSar: number; items: DoneItem[]; simulated?: boolean };

const fmt = (lang: Lang, v: number | string) => (lang === 'ar' ? arabicDigits(v) : String(v));

export function EnrollFlow({ lang, preselectProgramSlug }: { lang: Lang; preselectProgramSlug?: string }) {
  const d = enrollDict[lang];
  const weekdays = lang === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN;
  const accountHref = lang === 'ar' ? '/account' : '/en/account';

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [cart, setCart] = useState<Cart>({ items: [], subtotalSar: 0, discountSar: 0, totalSar: 0 });

  const [childId, setChildId] = useState<number | null>(null);
  const [provider, setProvider] = useState<string>('moyasar_mada');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [live, setLive] = useState<{ moyasar: boolean; tamara: boolean }>({ moyasar: false, tamara: false });
  const [avail, setAvail] = useState<{ moyasar: boolean; tamara: boolean }>({ moyasar: true, tamara: true });

  const errMsg = (k: string | null) => (k ? d.errors[k] ?? d.errors.generic : null);

  useEffect(() => {
    (async () => {
      // Returning from a live payment redirect?
      const params = new URLSearchParams(window.location.search);
      const paidId = params.get('paid');
      if (params.get('payfail')) setError('payment_failed');
      if (params.get('paypending')) setError('payment_pending');
      if (paidId) {
        const doneRes = await fetch(`/svc/enroll/checkout?paymentId=${encodeURIComponent(paidId)}`, { cache: 'no-store' });
        if (doneRes.ok) {
          const dp = await doneRes.json();
          if (dp.paid) setDone(dp);
        }
      }

      const [meRes, runsRes, cfgRes] = await Promise.all([
        fetch('/svc/account/me', { cache: 'no-store' }),
        fetch('/svc/enroll/runs', { cache: 'no-store' }),
        fetch('/svc/pay/config', { cache: 'no-store' }),
      ]);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setLive({ moyasar: !!cfg.moyasar, tamara: !!cfg.tamara });
        const av = cfg.available ?? { moyasar: true, tamara: true };
        setAvail(av);
        // Never leave a hidden method selected.
        setProvider((p) => {
          const ok = (key: string) => (key === 'tamara' ? av.tamara : av.moyasar);
          if (ok(p)) return p;
          return av.moyasar ? 'moyasar_mada' : av.tamara ? 'tamara' : p;
        });
      }
      if (meRes.ok) {
        const me = await meRes.json();
        setAuthed(true);
        setStudents(me.students);
        if (me.students.length === 1) setChildId(me.students[0].id);
        const cartRes = await fetch('/svc/enroll/cart', { cache: 'no-store' });
        if (cartRes.ok) setCart(await cartRes.json());
      }
      if (runsRes.ok) setRuns((await runsRes.json()).runs);
      setLoading(false);
    })();
  }, []);

  const year = new Date().getFullYear();
  const selectedChild = students.find((s) => s.id === childId) ?? null;

  const eligibleRuns = useMemo(() => {
    if (!selectedChild) return [];
    const age = year - selectedChild.birthYear;
    const list = runs.filter((r) => age >= r.program.ageMin && age <= r.program.ageMax);
    // preselected program first
    return preselectProgramSlug
      ? [...list].sort((a, b) => Number(b.program.slug === preselectProgramSlug) - Number(a.program.slug === preselectProgramSlug))
      : list;
  }, [runs, selectedChild, preselectProgramSlug, year]);

  async function addToCart(courseRunId: number) {
    if (!childId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/svc/enroll/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: childId, courseRunId }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'generic');
      setCart(data);
      setChildId(null);
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(it: CartItem) {
    const res = await fetch(`/svc/enroll/cart?studentId=${it.studentId}&courseRunId=${it.courseRunId}`, { method: 'DELETE' });
    if (res.ok) setCart(await res.json());
  }

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/svc/enroll/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, lang }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'generic');
      if (data.redirectUrl) {
        // LIVE payment — continue on the provider's secure page.
        window.location.assign(data.redirectUrl);
        return;
      }
      setDone(data);
      setCart({ items: [], subtotalSar: 0, discountSar: 0, totalSar: 0 });
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="enr-box" style={{ maxWidth: 640, margin: '40px auto 0' }} aria-busy="true" />;

  if (!authed) {
    return (
      <div className="enr-box" style={{ maxWidth: 560, margin: '40px auto 0', textAlign: 'center' }}>
        <p style={{ marginBottom: 16 }}>{d.loginNeeded}</p>
        <a className="acct-btn" style={{ width: 'auto', textDecoration: 'none' }} href={accountHref}>
          {d.goLogin}
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="enr-box enr-done" style={{ maxWidth: 640, margin: '40px auto 0' }}>
        <div className="icon">🎉</div>
        <h2>{d.doneTitle}</h2>
        {done.simulated !== false && (
          <div className="enr-stub-note" style={{ display: 'inline-block', marginTop: 10 }}>{d.doneSimNote}</div>
        )}
        <p style={{ marginTop: 8 }}>
          {d.doneSub} <span className="ref">{done.reference}</span>
        </p>
        <h3 style={{ marginTop: 20 }}>{d.enrolled}</h3>
        {done.items.map((it) => (
          <div key={`${it.studentId}-${it.courseRunId}`} className="enr-cart-line" style={{ textAlign: 'start' }}>
            <div className="c-info">
              <div className="c-kid">{it.studentName}</div>
              <div className="c-prog">
                {lang === 'ar' ? it.programNameAr : it.programNameEn}
                {it.weekday != null ? ` — ${weekdays[it.weekday]} ${it.time ?? ''}` : ''}
              </div>
            </div>
            <div className="c-price">
              <span className="final">
                {fmt(lang, it.totalSar)} {d.sar}
              </span>
            </div>
          </div>
        ))}
        <div className="enr-cta-row">
          <a className="acct-btn" style={{ width: 'auto', textDecoration: 'none' }} href={accountHref}>
            {d.goPortal}
          </a>
          <a className="acct-btn ghost" style={{ textDecoration: 'none' }} href={lang === 'ar' ? '/' : '/en'}>
            {d.backHome}
          </a>
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="enr-box" style={{ maxWidth: 560, margin: '40px auto 0', textAlign: 'center' }}>
        <p style={{ marginBottom: 16 }}>{d.noKids}</p>
        <a className="acct-btn" style={{ width: 'auto', textDecoration: 'none' }} href={accountHref}>
          {d.goKids}
        </a>
      </div>
    );
  }

  return (
    <div className="enr-grid">
      {/* Left: pick child + run */}
      <div className="enr-box">
        {error && <div className="acct-err" role="alert">{errMsg(error)}</div>}
        <h3>{d.chooseChild}</h3>
        <div className="enr-kids">
          {students.map((s) => (
            <button key={s.id} className={`enr-kid ${childId === s.id ? 'sel' : ''}`} onClick={() => setChildId(s.id)}>
              {s.firstName}
              <small>{d.ageNote(year - s.birthYear)}</small>
            </button>
          ))}
        </div>

        {selectedChild && (
          <>
            <h3>{d.chooseRun}</h3>
            {eligibleRuns.length === 0 && <div className="acct-empty">{d.noEligible}</div>}
            <div className="enr-runs">
              {eligibleRuns.map((r) => {
                const full = r.seatsLeft <= 0;
                const inCart = cart.items.some((i) => i.studentId === selectedChild.id && i.courseRunId === r.id);
                return (
                  <div key={r.id} className="enr-run">
                    <div className="r-dot" style={{ background: r.program.color }} />
                    <div className="r-main">
                      <div className="r-name">{lang === 'ar' ? r.program.nameAr : r.program.nameEn}</div>
                      <div className="r-meta">
                        {(lang === 'ar' ? r.titleAr : r.titleEn) ?? ''} · {weekdays[r.weekday]} {r.time}
                        {r.location ? ` · 📍 ${r.location}` : ''}
                      </div>
                      <div className={`r-seats ${r.seatsLeft <= 3 ? 'low' : ''}`}>
                        {full ? d.full : `${fmt(lang, r.seatsLeft)} ${d.seats}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <div className="r-price">
                        {fmt(lang, r.monthlyPriceSar)} {d.perMonth}
                      </div>
                      <button
                        className="acct-btn"
                        style={{ width: 'auto', fontSize: 13, padding: '8px 16px', marginTop: 6 }}
                        disabled={busy || full || inCart}
                        onClick={() => addToCart(r.id)}
                      >
                        {busy ? d.adding : d.addToCart}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Right: cart + payment */}
      <div className="enr-box">
        <h3>{d.cartTitle}</h3>
        {cart.items.length === 0 ? (
          <div className="acct-empty">{d.cartEmpty}</div>
        ) : (
          <>
            {cart.items.map((it) => (
              <div key={`${it.studentId}-${it.courseRunId}`} className="enr-cart-line">
                <div className="c-info">
                  <div className="c-kid">{it.studentName}</div>
                  <div className="c-prog">
                    {lang === 'ar' ? it.programNameAr : it.programNameEn} — {weekdays[it.weekday]} {it.time}
                  </div>
                </div>
                <div className="c-price">
                  {it.discountPct > 0 && (
                    <div className="base off">
                      {fmt(lang, it.baseSar)} {d.sar}
                    </div>
                  )}
                  <div className="final">
                    {fmt(lang, it.totalSar)} {d.sar}
                  </div>
                  {it.discountPct > 0 && <span className="tag">{d.siblingDiscount}</span>}
                </div>
                <button className="acct-btn danger" onClick={() => removeItem(it)}>
                  {d.remove}
                </button>
              </div>
            ))}
            <div className="enr-totals">
              <div className="row">
                <span>{d.subtotal}</span>
                <span>
                  {fmt(lang, cart.subtotalSar)} {d.sar}
                </span>
              </div>
              {cart.discountSar > 0 && (
                <div className="row">
                  <span>{d.discount}</span>
                  <span>
                    −{fmt(lang, cart.discountSar)} {d.sar}
                  </span>
                </div>
              )}
              <div className="row grand">
                <span>{d.total}</span>
                <span>
                  {fmt(lang, cart.totalSar)} {d.sar}
                </span>
              </div>
            </div>

            <h3 style={{ marginTop: 20 }}>{d.payTitle}</h3>
            {!avail.moyasar && !avail.tamara ? (
              <div className="acct-err" role="alert">{d.noPayMethods}</div>
            ) : (
              <>
                <div className="enr-stub-note">
                  {(provider === 'tamara' ? live.tamara : live.moyasar) ? d.liveNote : d.stubNote}
                </div>
                <div className="enr-pay-opts">
                  {Object.entries(d.providers)
                    .filter(([key]) => (key === 'tamara' ? avail.tamara : avail.moyasar))
                    .map(([key, label]) => (
                      <button key={key} className={`enr-pay ${provider === key ? 'sel' : ''}`} aria-pressed={provider === key} onClick={() => setProvider(key)}>
                        {label}
                      </button>
                    ))}
                </div>
                <button className="acct-btn" onClick={checkout} disabled={busy}>
                  {busy ? d.paying : (provider === 'tamara' ? live.tamara : live.moyasar) ? d.payNowReal : d.payNow}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
