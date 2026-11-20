'use client';

import { useEffect, useState } from 'react';
import { adminListQuery, emptyPagination, useAdminList, useAdminSearch, pick, setAdminParams, type AdminPagination } from './useAdminQuery';
import { AdminPaging } from './AdminPaging';

const B_STATUS = ['all', 'new', 'contacted', 'enrolled', 'converted'] as const;
const B_OWNER = ['all', 'assigned', 'unassigned'] as const;

type Metrics = {
  total: number;
  attended: number;
  enrolled: number;
  attendanceRatePct: number;
  bookingConversionPct: number;
  attendedConversionPct: number;
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
  const [savingId, setSavingId] = useState<number | null>(null);
  const params = useAdminSearch();
  const { data, loading, error: loadError, refresh: fetchBookings } = useAdminList<{
    bookings: any[]; metrics: Metrics; programs: { id: number; nameAr: string }[]; pagination: AdminPagination;
  }>('/svc/admin/bookings', adminListQuery(params, 'b'));
  const bookings = data?.bookings ?? [];
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const pagination = data?.pagination ?? emptyPagination;
  const [programOptions, setProgramOptions] = useState<[string, string][]>([]);
  useEffect(() => {
    if (data) {
      setProgramOptions(data.programs.map((p) => [String(p.id), p.nameAr]));
      setMetrics(data.metrics);
    }
  }, [data]);
  const q = params.get('bq') ?? '';
  const fStatus = pick(params, 'bstatus', B_STATUS, 'all');
  const fOwner = pick(params, 'bowner', B_OWNER, 'all');
  const rawProgram = params.get('bprogram') ?? 'all';
  const fProgram = rawProgram;
  const filtersOn = !!q.trim() || fStatus !== 'all' || fOwner !== 'all' || fProgram !== 'all';
  const visible = bookings;
  const clearFilters = () => setAdminParams({ bq: null, bstatus: null, bowner: null, bprogram: null });

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

  const cards = [
    ['الحجوزات', metrics?.total ?? '—', 'كل الحجوزات التجريبية'],
    ['الحضور', metrics ? `${metrics.attendanceRatePct}%` : '—', metrics ? `${metrics.attended} حضروا` : 'جارٍ تحميل المؤشرات'],
    ['تحويل الحجز', metrics ? `${metrics.bookingConversionPct}%` : '—', metrics ? `${metrics.enrolled} اشتراكات مدفوعة` : 'جارٍ تحميل المؤشرات'],
    ['تحويل الحاضرين', metrics ? `${metrics.attendedConversionPct}%` : '—', 'من الحضور إلى اشتراك'],
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-[24px] border border-[#DFE5F2] shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-[#101A38]">متابعة الحجوزات التجريبية</h2>
            <p className="text-[#5F6B92] mt-2">الخطوة القادمة، المسؤول، الحضور، والتحويل إلى اشتراك مدفوع.</p>
          </div>
          <div className="self-start text-start">
            <a href="/svc/admin/bookings?format=csv" className="adm-btn navy" data-testid="link-bookings-csv">تصدير CSV — كل الحجوزات</a>
            <div className="adm-hint" data-testid="text-bookings-csv-scope">يشمل التصدير جميع الحجوزات دون تطبيق التصفية الحالية.</div>
          </div>
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

      <div className="adm-filters" role="search" aria-label="تصفية الحجوزات">
        <label className="adm-field grow">
          <span>بحث</span>
          <input type="search" value={q} maxLength={200} placeholder="اسم الطفل أو ولي الأمر أو الجوال أو المسؤول"
            onChange={(e) => setAdminParams({ bq: e.target.value })} data-testid="input-bookings-search" />
        </label>
        <label className="adm-field">
          <span>الحالة</span>
          <select value={fStatus} onChange={(e) => setAdminParams({ bstatus: e.target.value })} data-testid="select-bookings-status">
            <option value="all">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="contacted">تم التواصل</option>
            <option value="enrolled">مسجّل — دون دفع مؤكد</option>
            <option value="converted">مشترك مدفوع</option>
          </select>
        </label>
        <label className="adm-field">
          <span>البرنامج</span>
          <select value={fProgram} onChange={(e) => setAdminParams({ bprogram: e.target.value })} data-testid="select-bookings-program">
            <option value="all">كل البرامج</option>
            {programOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="adm-field">
          <span>المسؤول</span>
          <select value={fOwner} onChange={(e) => setAdminParams({ bowner: e.target.value })} data-testid="select-bookings-owner">
            <option value="all">الكل</option>
            <option value="assigned">مُسنَد</option>
            <option value="unassigned">غير مُسنَد</option>
          </select>
        </label>
        <div className="adm-count" role="status" aria-live="polite" data-testid="text-bookings-count">
          {loadError ? 'تعذّر تحديث الأعداد' : loading ? 'جارٍ التحميل…' : `${pagination.matching} من ${pagination.total} حجز · المعروض ${visible.length}`}
        </div>
        {filtersOn && <button type="button" className="adm-btn line" onClick={clearFilters} data-testid="button-bookings-clear">مسح التصفية</button>}
      </div>
      <AdminPaging page={pagination} prefix="b" busy={loading && !loadError} refresh={() => void fetchBookings()} />
      {loadError && <div className="adm-state err" role="alert" data-testid={data ? 'status-bookings-refresh-error' : 'status-bookings-error'}>تعذّر تحديث القائمة؛ المعروض إن وجد آخر نسخة محمّلة. <button type="button" className="adm-link" onClick={() => void fetchBookings()}>إعادة المحاولة</button></div>}

      <div className="space-y-4">
        {visible.map((b) => (
          <article key={b.id} data-testid={`card-booking-${b.id}`} className="bg-white rounded-[24px] border border-[#DFE5F2] p-5 sm:p-6 shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
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
        {!loading && !loadError && pagination.total === 0 && <div className="adm-state" data-testid="empty-bookings">لا توجد حجوزات تجريبية بعد.</div>}
        {!loading && !loadError && pagination.total > 0 && visible.length === 0 && (
          <div className="adm-state" data-testid="empty-bookings-filtered">
            <b>لا توجد حجوزات في هذه الصفحة.</b>
            <button type="button" className="adm-btn line" onClick={clearFilters} data-testid="button-bookings-clear-empty">مسح التصفية</button>
          </div>
        )}
      </div>
    </div>
  );
}