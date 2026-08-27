'use client';

import { useEffect, useState } from 'react';

type Metrics = {
  total: number;
  attended: number;
  enrolled: number;
  attendanceRatePct: number;
  bookingConversionPct: number;
  attendedConversionPct: number;
};

const emptyMetrics: Metrics = {
  total: 0,
  attended: 0,
  enrolled: 0,
  attendanceRatePct: 0,
  bookingConversionPct: 0,
  attendedConversionPct: 0,
};

const fmtDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('ar-SA', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Riyadh',
      }).format(new Date(value))
    : '—';

const communicationLabel = (item: any) => {
  if (!item) return 'غير موجود';
  if (item.status === 'sent') return 'أُرسل';
  if (item.status === 'failed') return `فشل بعد ${item.attempts} محاولات`;
  if (item.status === 'sending') return 'جارٍ الإرسال';
  return 'مجدول';
};

export function BookingsTab() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/svc/admin/bookings', { cache: 'no-store' });
      if (res.status === 401) return window.location.reload();
      const data = await res.json();
      setBookings(data.bookings || []);
      setMetrics(data.metrics || emptyMetrics);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBookings();
  }, []);

  const update = async (id: number, patch: Record<string, unknown>) => {
    setSavingId(id);
    const res = await fetch('/svc/admin/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    await fetchBookings();
    setSavingId(null);
    return res.ok;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin" /></div>;
  }

  const cards = [
    ['الحجوزات', metrics.total, 'كل الحجوزات التجريبية'],
    ['الحضور', `${metrics.attendanceRatePct}%`, `${metrics.attended} حضروا`],
    ['تحويل الحجز', `${metrics.bookingConversionPct}%`, `${metrics.enrolled} اشتراكات مدفوعة`],
    ['تحويل الحاضرين', `${metrics.attendedConversionPct}%`, 'من الحضور إلى اشتراك'],
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-[24px] border border-[#DFE5F2] shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-[#101A38]">متابعة الحجوزات التجريبية</h2>
            <p className="text-[#5F6B92] mt-2">الخطوة القادمة، المسؤول، الحضور، والتحويل إلى اشتراك مدفوع.</p>
          </div>
          <a href="/svc/admin/bookings?format=csv" className="bg-[#101A38] text-white px-6 py-3 rounded-xl font-bold self-start">تصدير CSV</a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(([label, value, hint]) => (
          <div key={String(label)} className="bg-white rounded-2xl border border-[#DFE5F2] p-5">
            <div className="text-sm font-bold text-[#5F6B92]">{label}</div>
            <div className="text-3xl font-mono font-bold text-[#1C54CB] mt-2">{value}</div>
            <div className="text-xs text-[#5F6B92] mt-1">{hint}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {bookings.map((b) => (
          <article key={b.id} className="bg-white rounded-[24px] border border-[#DFE5F2] p-5 sm:p-6 shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
            <div className="grid lg:grid-cols-[1.2fr_1fr_1fr] gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-lg text-[#101A38]">{b.childFirstName}</strong>
                  <span className={`status-badge ${b.converted ? 'enrolled' : b.status}`}>{b.converted ? 'مشترك مدفوع' : b.status === 'new' ? 'جديد' : 'تم التواصل'}</span>
                </div>
                <div className="font-bold mt-2">{b.parentName}</div>
                <a href={`tel:${b.phone}`} dir="ltr" className="text-sm text-[#1C54CB]">{b.phone}</a>
                {b.email && <div className="text-sm text-[#5F6B92]" dir="ltr">{b.email}</div>}
                <div className="text-xs text-[#5F6B92] mt-2">
                  موافقة التواصل: {b.contactConsentAt ? `${fmtDate(b.contactConsentAt)} · بريد إلكتروني` : 'غير مسجلة — لا يجوز التواصل'}
                </div>
              </div>

              <div className="text-sm">
                <div className="font-bold text-[#1C54CB]">{b.program.nameAr}</div>
                <div className="mt-2"><b>الحصة:</b> {fmtDate(b.trialStartsAt)}</div>
                <div className="mt-1"><b>الخطوة القادمة:</b> {b.nextAction}</div>
                <div className="mt-1 text-[#5F6B92]">{fmtDate(b.nextActionAt)}</div>
                {b.communications?.length > 0 && (
                  <div className="mt-2 text-xs text-[#5F6B92]">
                    التذكير: {communicationLabel(b.communications.find((item: any) => item.kind === 'reminder'))}
                    {' · '}
                    المتابعة: {communicationLabel(b.communications.find((item: any) => item.kind === 'follow_up'))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#5F6B92]">
                  مسؤول المتابعة
                  <input
                    defaultValue={b.assignedTo}
                    onBlur={(e) => e.target.value !== b.assignedTo && void update(b.id, { assignedTo: e.target.value })}
                    className="mt-1 w-full bg-[#F7FAFF] border border-[#DFE5F2] rounded-xl px-3 py-2 text-sm text-[#101A38]"
                  />
                </label>
                <label className="block text-xs font-bold text-[#5F6B92]">
                  حضور الحصة
                  <select
                    value={b.trialAttendance}
                    disabled={savingId === b.id}
                    onChange={(e) => void update(b.id, { trialAttendance: e.target.value })}
                    className="mt-1 w-full bg-[#F7FAFF] border border-[#DFE5F2] rounded-xl px-3 py-2 text-sm text-[#101A38]"
                  >
                    <option value="pending">بانتظار التسجيل</option>
                    <option value="present">حضر</option>
                    <option value="absent">لم يحضر</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-[#DFE5F2]">
              {!b.contactConsentAt ? (
                <span className="bg-[#FFF4E5] text-[#9A5B00] px-4 py-2 rounded-xl text-sm font-bold">يلزم إعادة تأكيد موافقة التواصل</span>
              ) : !b.converted && b.trialAttendance === 'present' ? (
                <>
                  <a href={b.enrollmentUrl} target="_blank" className="bg-[#1C54CB] text-white px-4 py-2 rounded-xl text-sm font-bold">فتح رابط التسجيل والدفع</a>
                </>
              ) : !b.converted ? <span className="bg-[#F0F5FF] text-[#1C54CB] px-4 py-2 rounded-xl text-sm font-bold">التذكير والمتابعة مجدولان بالبريد</span> : null}
              {b.communications?.filter((item: any) => item.status === 'failed').map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => void update(b.id, { retryCommunicationId: item.id })}
                  className="bg-[#FFF0F0] text-[#B42318] px-4 py-2 rounded-xl text-sm font-bold"
                  title={item.lastError || undefined}
                >
                  إعادة محاولة {item.kind === 'reminder' ? 'التذكير' : 'المتابعة'}
                </button>
              ))}
            </div>
          </article>
        ))}
        {bookings.length === 0 && <div className="bg-white rounded-2xl p-12 text-center text-[#5F6B92]">لا توجد حجوزات تجريبية بعد.</div>}
      </div>
    </div>
  );
}