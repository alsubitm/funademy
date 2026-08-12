'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lang = 'ar' | 'en';

const PROVIDERS: { id: string; label: string }[] = [
  { id: 'moyasar_mada', label: 'Mada مدى' },
  { id: 'moyasar_applepay', label: 'Apple Pay' },
  { id: 'moyasar_stcpay', label: 'STC Pay' },
  { id: 'tamara', label: 'Tamara تمارا' },
];

const T = {
  ar: {
    renew: 'تجديد / دفع',
    pick: 'اختر وسيلة الدفع',
    pay: (n: number) => `ادفع ${n} ريال`,
    cancel: 'إلغاء',
    working: 'جارٍ الدفع…',
    done: 'تم الدفع بنجاح ✓',
    fail: 'تعذّر إتمام الدفع، حاول مجدداً',
    sim: 'وضع تجريبي — لن يُخصم مبلغ حقيقي',
    live: 'سيتم تحويلك إلى صفحة الدفع الآمنة',
    none: 'الدفع الإلكتروني غير متاح حالياً — تواصل معنا لإتمام التجديد',
  },
  en: {
    renew: 'Renew / Pay',
    pick: 'Choose a payment method',
    pay: (n: number) => `Pay ${n} SAR`,
    cancel: 'Cancel',
    working: 'Processing…',
    done: 'Payment successful ✓',
    fail: 'Payment failed, please try again',
    sim: 'Simulation mode — no real charge',
    live: 'You will be redirected to a secure payment page',
    none: 'Online payment is temporarily unavailable — contact us to renew',
  },
};

export function RenewButton({
  lang,
  enrollmentId,
  amountSar,
  live = { moyasar: false, tamara: false },
  available = { moyasar: true, tamara: true },
}: {
  lang: Lang;
  enrollmentId: number;
  amountSar: number;
  live?: { moyasar: boolean; tamara: boolean };
  /** Methods that may be OFFERED (production hides non-live providers). */
  available?: { moyasar: boolean; tamara: boolean };
}) {
  const t = T[lang];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const offered = PROVIDERS.filter((p) => (p.id === 'tamara' ? available.tamara : available.moyasar));
  const [provider, setProvider] = useState(offered[0]?.id ?? PROVIDERS[0].id);
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'fail'>('idle');

  const providerLive = provider === 'tamara' ? live.tamara : live.moyasar;

  async function pay() {
    setState('working');
    try {
      const res = await fetch('/svc/account/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, provider, lang }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      if (data.redirectUrl) {
        // LIVE payment — continue on the provider's secure page.
        window.location.assign(data.redirectUrl);
        return;
      }
      setState('done');
      setTimeout(() => router.refresh(), 900);
    } catch {
      setState('fail');
    }
  }

  if (!open) {
    return (
      <button className="ptl-renew-btn" onClick={() => { setOpen(true); setState('idle'); }}>
        {t.renew}
      </button>
    );
  }

  return (
    <div className="ptl-renew-box">
      {state === 'done' ? (
        <div className="ok">{t.done}</div>
      ) : offered.length === 0 ? (
        <>
          <div className="err">{t.none}</div>
          <div className="acts">
            <button className="cx" onClick={() => setOpen(false)}>{t.cancel}</button>
          </div>
        </>
      ) : (
        <>
          <div className="lbl">{t.pick}</div>
          <div className="provs">
            {offered.map((p) => (
              <button
                key={p.id}
                className={`prov ${provider === p.id ? 'sel' : ''}`}
                onClick={() => setProvider(p.id)}
                disabled={state === 'working'}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="sim">{providerLive ? t.live : t.sim}</div>
          {state === 'fail' && <div className="err">{t.fail}</div>}
          <div className="acts">
            <button className="go" onClick={pay} disabled={state === 'working'}>
              {state === 'working' ? t.working : t.pay(amountSar)}
            </button>
            <button className="cx" onClick={() => setOpen(false)} disabled={state === 'working'}>
              {t.cancel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
