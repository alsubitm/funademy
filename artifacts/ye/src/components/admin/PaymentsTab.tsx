'use client';

import { useState, useEffect, useCallback } from 'react';

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

const PROVIDER_LABEL: Record<string, string> = {
  moyasar_mada: 'مدى',
  moyasar_applepay: 'Apple Pay',
  moyasar_stcpay: 'STC Pay',
  tamara: 'تمارا',
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  paid: { label: 'مدفوعة', cls: 'bg-[rgba(34,218,255,0.15)] text-[#0e7a94]' },
  initiated: { label: 'قيد الدفع', cls: 'bg-[rgba(255,202,23,0.2)] text-[#8a6d00]' },
  failed: { label: 'فاشلة', cls: 'bg-[#FDECEC] text-[#B3261E]' },
  expired: { label: 'منتهية', cls: 'bg-[#F0F5FF] text-[#5F6B92]' },
  refunding: { label: 'جارٍ الاسترجاع', cls: 'bg-[#EFE7FD] text-[#6B3FD1]' },
  refunded: { label: 'مُستردة', cls: 'bg-[#EFE7FD] text-[#6B3FD1]' },
};

type PaymentRow = {
  id: number;
  kind: string;
  provider: string;
  reference: string;
  status: string;
  totalSar: number;
  simulated: boolean;
  createdAt: string;
  parentName: string;
  phone: string;
  students: string[];
};

export function PaymentsTab() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch('/svc/admin/payments');
      if (res.status === 401) { window.location.reload(); return; }
      setPayments((await res.json()).payments || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const refund = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch('/svc/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setConfirmId(null);
        await fetchPayments();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(
          data.error === 'refund_status_unknown'
            ? 'تعذّر تأكيد نتيجة الاسترجاع لدى المزود — الدفعة الآن بحالة «جارٍ الاسترجاع». راجع لوحة المزود قبل أي إجراء آخر (لن يُنفَّذ استرجاع مكرر).'
            : data.error === 'refund_in_progress'
              ? 'هناك عملية استرجاع جارية لهذه الدفعة بالفعل.'
              : data.error === 'not_refundable'
            ? 'هذه الدفعة ليست في حالة تسمح بالاسترجاع.'
            : data.error === 'provider_not_configured'
              ? 'مزود الدفع غير مفعّل حالياً — لا يمكن تنفيذ الاسترجاع.'
              : 'تعذّر تنفيذ الاسترجاع لدى مزود الدفع — أعد المحاولة أو راجع لوحة المزود.',
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-xl text-[#101A38]">المدفوعات</h2>
      {payments.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-[#DFE5F2] text-center text-[#5F6B92]">
          لا توجد دفعات بعد.
        </div>
      ) : (
        payments.map((p) => {
          const st = STATUS_LABEL[p.status] ?? { label: p.status, cls: 'bg-[#F0F5FF] text-[#5F6B92]' };
          return (
            <div key={p.id} className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-display font-bold text-[#101A38]">
                    {p.parentName}
                    <span className="text-xs text-[#5F6B92] font-body font-normal"> — {p.students.join('، ') || (p.kind === 'renewal' ? 'تجديد اشتراك' : 'تسجيل')}</span>
                  </div>
                  <div className="text-sm text-[#5F6B92] mt-0.5">
                    {p.kind === 'renewal' ? 'تجديد اشتراك' : 'تسجيل جديد'} · {PROVIDER_LABEL[p.provider] ?? p.provider}
                    {' · '}<span className="font-mono" dir="ltr">{fmtDate(p.createdAt)}</span>
                  </div>
                  <div className="font-mono text-xs text-[#5F6B92] mt-0.5" dir="ltr">{p.phone} · #{p.id} · {p.reference}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {p.simulated && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[rgba(255,202,23,0.2)] text-[#8a6d00]">تجريبية</span>
                  )}
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${st.cls}`}>{st.label}</span>
                  <span className="font-display font-bold text-[#101A38]" dir="ltr">{p.totalSar} SAR</span>
                </div>
              </div>
              {p.status === 'paid' && (
                <div className="pt-2 border-t border-[#DFE5F2]">
                  {confirmId === p.id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-[#B3261E] font-bold">استرجاع {p.totalSar} ريال لولي الأمر؟ لا يمكن التراجع.</span>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => refund(p.id)}
                        className="bg-[#B3261E] text-white px-5 py-2.5 rounded-xl font-display font-bold text-sm disabled:opacity-70"
                      >
                        {busyId === p.id ? 'جارٍ الاسترجاع…' : 'تأكيد الاسترجاع'}
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => setConfirmId(null)}
                        className="bg-white text-[#5F6B92] border-2 border-[#DFE5F2] px-5 py-2.5 rounded-xl font-display font-bold text-sm disabled:opacity-70"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(p.id)}
                      className="bg-white text-[#B3261E] border-2 border-[#F3C3C0] px-5 py-2.5 rounded-xl font-display font-bold text-sm"
                    >
                      ↩ استرجاع المبلغ
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
