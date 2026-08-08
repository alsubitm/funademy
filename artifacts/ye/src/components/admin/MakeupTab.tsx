'use client';

import { useState, useEffect, useCallback } from 'react';

const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'قيد المراجعة', cls: 'bg-[rgba(255,202,23,0.2)] text-[#8a6d00]' },
  approved: { label: 'موافَق عليه', cls: 'bg-[rgba(34,218,255,0.15)] text-[#0e7a94]' },
  rejected: { label: 'مرفوض', cls: 'bg-[#F0F5FF] text-[#5F6B92]' },
};

export function MakeupTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/svc/admin/makeup');
      if (res.status === 401) { window.location.reload(); return; }
      setRequests((await res.json()).requests || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const decide = async (id: number, status: 'approved' | 'rejected') => {
    setBusy(true);
    const res = await fetch('/svc/admin/makeup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, adminNote: noteFor === id ? note : undefined }),
    });
    if (res.ok) {
      setNoteFor(null);
      setNote('');
      await fetchRequests();
    } else {
      alert('تعذّر حفظ القرار — أعد المحاولة.');
    }
    setBusy(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending');

  const Card = ({ r }: { r: any }) => (
    <div className="bg-white p-5 rounded-2xl border border-[#DFE5F2] space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display font-bold text-[#101A38]">
            {r.student.firstName} <span className="text-xs text-[#5F6B92] font-body">— {r.student.family.parentName}</span>
          </div>
          <div className="text-sm text-[#5F6B92] mt-0.5">
            {r.session.courseRun.program?.nameAr} · جلسة <span className="font-mono" dir="ltr">{fmtDate(r.session.date)}</span>
          </div>
          <div className="font-mono text-xs text-[#5F6B92] mt-0.5" dir="ltr">{r.student.family.phone}</div>
          {r.note && <div className="text-sm text-[#101A38] mt-2 bg-[#F7FAFF] rounded-xl px-3 py-2">💬 {r.note}</div>}
          {r.adminNote && <div className="text-sm text-[#0e7a94] mt-2 bg-[rgba(34,218,255,0.08)] rounded-xl px-3 py-2">↩ {r.adminNote}</div>}
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_LABEL[r.status].cls}`}>{STATUS_LABEL[r.status].label}</span>
      </div>
      {r.status === 'pending' && (
        <div className="space-y-2 pt-2 border-t border-[#DFE5F2]">
          {noteFor === r.id ? (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-hq"
              placeholder="ملاحظة للأهل (اختياري) — مثل موعد التعويض المقترح"
              maxLength={300}
            />
          ) : (
            <button onClick={() => { setNoteFor(r.id); setNote(''); }} className="text-[#1C54CB] text-sm font-bold">+ إضافة ملاحظة للأهل</button>
          )}
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => decide(r.id, 'approved')} className="bg-[#1C54CB] text-white px-5 py-2.5 rounded-xl font-display font-bold text-sm shadow-[0_3px_0_#11388E] disabled:opacity-70">موافقة</button>
            <button disabled={busy} onClick={() => decide(r.id, 'rejected')} className="bg-white text-[#5F6B92] border-2 border-[#DFE5F2] px-5 py-2.5 rounded-xl font-display font-bold text-sm disabled:opacity-70">رفض</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
        <h2 className="text-3xl font-display font-bold text-[#101A38]">طلبات تعويض الحصص</h2>
        <p className="text-sm text-[#5F6B92] mt-1 font-medium">طلبات الأهالي لتعويض الحصص الفائتة — القرار يظهر لهم مباشرة في البوابة</p>
      </div>

      <div className="space-y-3">
        <div className="font-display font-bold text-[#101A38]">بانتظار القرار ({pending.length})</div>
        {pending.map((r) => <Card key={r.id} r={r} />)}
        {pending.length === 0 && <div className="text-center py-10 text-[#5F6B92] font-bold bg-white rounded-2xl border border-[#DFE5F2]">لا توجد طلبات معلقة.</div>}
      </div>

      {decided.length > 0 && (
        <div className="space-y-3">
          <div className="font-display font-bold text-[#101A38]">قرارات سابقة ({decided.length})</div>
          {decided.map((r) => <Card key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
