'use client';

import { useCallback, useEffect, useState } from 'react';

type Shipment = {
  id: number;
  studentName: string;
  programAr: string;
  kitCode: string;
  kitFeeSar: number;
  recipientName: string;
  recipientPhone: string;
  city: string;
  district: string;
  addressLine: string;
  nationalAddressCode: string | null;
  postalCode: string | null;
  status: 'to_ship' | 'shipped' | 'delivered' | 'returned' | 'cancelled';
  carrier: string;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  adminNote: string | null;
  createdAt: string;
};

const STATUS: Record<Shipment['status'], { label: string; cls: string }> = {
  to_ship: { label: 'بانتظار الشحن', cls: 'bg-[rgba(255,202,23,0.2)] text-[#8a6d00]' },
  shipped: { label: 'تم الشحن', cls: 'bg-[rgba(34,218,255,0.15)] text-[#0e7a94]' },
  delivered: { label: 'تم التسليم', cls: 'bg-[#e8f7ee] text-[#146c3c]' },
  returned: { label: 'مُرتجع', cls: 'bg-[#fdeaea] text-[#a12622]' },
  cancelled: { label: 'ملغى', cls: 'bg-[#F0F5FF] text-[#5F6B92]' },
};
const FILTERS: (Shipment['status'] | '')[] = ['to_ship', 'shipped', 'delivered', 'returned', 'cancelled', ''];
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh' }) : '');

/** Kit shipments for online enrollments: ship with SMSA, then mark delivered or returned. */
export function KitsTab() {
  const [filter, setFilter] = useState<Shipment['status'] | ''>('to_ship');
  const [rows, setRows] = useState<Shipment[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/svc/admin/kits${filter ? `?status=${filter}` : ''}`, { cache: 'no-store' });
      if (res.status === 401) { window.location.reload(); return; }
      const data = await res.json();
      setRows(data.shipments ?? []);
      setCounts(data.counts ?? {});
    } finally {
      setLoading(false);
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: number, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(id);
    setError(null);
    const res = await fetch('/svc/admin/kits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...extra }),
    });
    setBusy(null);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e.error === 'tracking_required' ? 'أدخل رقم تتبع سمسا صحيحاً (٦ خانات على الأقل)' : 'تعذّر التحديث — حدّث الصفحة وحاول مرة أخرى');
      return;
    }
    load();
  };

  return (
    <div>
      <h2 className="font-display font-extrabold text-2xl text-[#101A38] mb-1">أطقم الطلاب الأونلاين</h2>
      <p className="text-sm text-[#5F6B92] mb-4">
        يُنشأ طلب شحن تلقائياً لكل طفل عند تأكيد دفع تسجيل أونلاين. اشحن عبر سمسا ثم أدخل رقم التتبع. رسوم الطقم تُسترد فقط إذا أُرجع الطقم.
      </p>
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="حالة الشحن">
        {FILTERS.map((f) => (
          <button
            key={f || 'all'}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-sm font-bold border"
            // Inline colours: the admin theme overrides some utility classes on buttons.
            style={filter === f
              ? { background: '#101A38', color: '#FFFFFF', borderColor: '#101A38' }
              : { background: '#FFFEFA', color: '#101A38', borderColor: '#E8DCC4' }}
          >
            {f ? STATUS[f].label : 'الكل'}{f && counts[f] ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>
      {error && <div role="alert" className="mb-3 text-sm font-bold text-[#a12622]">{error}</div>}
      {loading ? (
        <div className="text-[#5F6B92]" aria-busy="true">جاري التحميل…</div>
      ) : rows.length === 0 ? (
        <div className="text-[#5F6B92]">لا توجد أطقم في هذه الحالة.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((s) => (
            <article key={s.id} className="bg-white border border-[#DFE5F2] rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="font-bold text-[#101A38]">
                  {s.studentName} — {s.programAr} <span className="font-mono text-xs text-[#5F6B92]">{s.kitCode}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
              </div>
              <div className="text-sm text-[#101A38] leading-7">
                <div>المستلم: {s.recipientName} · <span dir="ltr">{s.recipientPhone}</span></div>
                <div>{s.city} — {s.district} — {s.addressLine}</div>
                {(s.nationalAddressCode || s.postalCode) && (
                  <div dir="ltr" className="font-mono text-xs">{[s.nationalAddressCode, s.postalCode].filter(Boolean).join(' · ')}</div>
                )}
                <div className="text-xs text-[#5F6B92]">
                  طُلب {fmtDate(s.createdAt)} · رسوم الطقم {s.kitFeeSar} ر.س
                  {s.trackingNumber ? <> · {s.carrier} <span dir="ltr" className="font-mono">{s.trackingNumber}</span></> : null}
                  {s.shippedAt ? ` · شُحن ${fmtDate(s.shippedAt)}` : ''}
                  {s.deliveredAt ? ` · سُلّم ${fmtDate(s.deliveredAt)}` : ''}
                  {s.returnedAt ? ` · أُرجع ${fmtDate(s.returnedAt)}` : ''}
                </div>
                {s.adminNote && <div className="text-xs text-[#5F6B92]">ملاحظة: {s.adminNote}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {s.status === 'to_ship' && (
                  <>
                    <label className="sr-only" htmlFor={`trk-${s.id}`}>رقم تتبع سمسا</label>
                    <input
                      id={`trk-${s.id}`}
                      dir="ltr"
                      placeholder="رقم تتبع سمسا"
                      value={tracking[s.id] ?? ''}
                      onChange={(e) => setTracking({ ...tracking, [s.id]: e.target.value })}
                      className="input-hq font-mono text-sm max-w-[220px]"
                    />
                    <button disabled={busy === s.id} onClick={() => act(s.id, 'ship', { trackingNumber: tracking[s.id] ?? '' })} className="bg-[#7C3AED] text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60">
                      تم الشحن
                    </button>
                    <button disabled={busy === s.id} onClick={() => { if (confirm('إلغاء شحن هذا الطقم؟ (مثلاً بعد استرداد قبل الشحن)')) act(s.id, 'cancel'); }} className="px-3 py-2 rounded-xl text-sm font-bold text-[#5F6B92] border border-[#DFE5F2]">
                      إلغاء
                    </button>
                  </>
                )}
                {s.status === 'shipped' && (
                  <button disabled={busy === s.id} onClick={() => act(s.id, 'deliver')} className="bg-[#146c3c] text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60">
                    تم التسليم
                  </button>
                )}
                {(s.status === 'shipped' || s.status === 'delivered') && (
                  <button disabled={busy === s.id} onClick={() => { if (confirm('تسجيل الطقم كمُرتجع؟ بعدها يمكن استرداد رسوم الطقم.')) act(s.id, 'return'); }} className="px-3 py-2 rounded-xl text-sm font-bold text-[#a12622] border border-[#f3c4c1]">
                    مُرتجع
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
