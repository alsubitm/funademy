'use client';

import { useState, useEffect, useCallback } from 'react';
import { WEEKDAYS_AR } from '@/lib/constants';

const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ATT_OPTIONS = [
  { value: 'present', label: 'حضر', cls: 'bg-[rgba(34,218,255,0.15)] text-[#0C85A3] border-[rgba(34,218,255,0.3)]' },
  { value: 'absent', label: 'غاب', cls: 'bg-[rgba(211,144,27,0.15)] text-[#9a6a0e] border-[rgba(211,144,27,0.3)]' },
  { value: 'late', label: 'تأخر', cls: 'bg-[rgba(255,202,23,0.2)] text-[#8a6d00] border-[rgba(255,202,23,0.4)]' },
  { value: 'excused', label: 'بعذر', cls: 'bg-[#F0F5FF] text-[#5F6B92] border-[#DFE5F2]' },
];

export function RunsTab({ programs }: { programs: any[] }) {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // create form
  const [programId, setProgramId] = useState(programs[0]?.id || '');
  const [titleAr, setTitleAr] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [weekday, setWeekday] = useState('0');
  const [time, setTime] = useState('17:00');
  const [format, setFormat] = useState('in_person');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('12');
  const [price, setPrice] = useState('1380');

  // drill-down
  const [openRun, setOpenRun] = useState<any | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [openSession, setOpenSession] = useState<any | null>(null);
  const [attStudents, setAttStudents] = useState<any[]>([]);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/svc/admin/runs');
      if (res.status === 401) { window.location.reload(); return; }
      setRuns((await res.json()).runs || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // edit form (run detail)
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eTime, setETime] = useState('');
  const [eCap, setECap] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [eLoc, setELoc] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = (run: any) => {
    setETitle(run.titleAr || '');
    setETime(run.time);
    setECap(String(run.capacity));
    setEPrice(String(run.monthlyPriceSar));
    setELoc(run.location || '');
    setEditing(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/svc/admin/runs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: openRun.id, titleAr: eTitle || null, time: eTime,
        capacity: Number(eCap), monthlyPriceSar: Number(ePrice), location: eLoc || null,
      }),
    });
    if (res.ok) {
      const { run } = await res.json();
      setOpenRun({ ...openRun, ...run });
      setEditing(false);
      fetchRuns();
    } else {
      const err = (await res.json().catch(() => ({}))).error;
      alert(
        err === 'capacity_below_enrolled' ? 'لا يمكن تقليل السعة تحت عدد المسجلين الحالي.' :
        err === 'conflict_retry' ? 'تغيّرت بيانات المقاعد أثناء الحفظ — أعد المحاولة.' :
        'تأكد من صحة البيانات.',
      );
    }
    setSaving(false);
  };

  const openRoster = async (run: any) => {
    setOpenRun(run);
    setOpenSession(null);
    setEditing(false);
    const res = await fetch(`/svc/admin/roster?runId=${run.id}`);
    if (res.ok) {
      const data = await res.json();
      setRoster(data.roster || []);
      setSessions(data.sessions || []);
    }
  };

  const openAttendance = async (session: any) => {
    setOpenSession(session);
    const res = await fetch(`/svc/admin/attendance?sessionId=${session.id}`);
    if (res.ok) setAttStudents((await res.json()).students || []);
  };

  const mark = async (studentId: number, status: string) => {
    setAttStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, status } : s)));
    const res = await fetch('/svc/admin/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: openSession.id, studentId, status }),
    });
    if (!res.ok) openAttendance(openSession);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch('/svc/admin/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programId: Number(programId), titleAr: titleAr || null, startDate, endDate,
        weekday: Number(weekday), time, format,
        location: format === 'in_person' ? location : null,
        capacity: Number(capacity), monthlyPriceSar: Number(price),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setTitleAr('');
      await fetchRuns();
    } else {
      const err = (await res.json().catch(() => ({}))).error;
      alert(err === 'no_sessions_in_range' ? 'لا توجد جلسات ضمن الفترة المحددة — تحقق من التواريخ واليوم.' : 'تأكد من صحة البيانات.');
    }
    setSubmitting(false);
  };

  const toggleActive = async (run: any) => {
    setRuns((prev) => prev.map((r) => (r.id === run.id ? { ...r, active: !run.active } : r)));
    const res = await fetch('/svc/admin/runs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: run.id, active: !run.active }),
    });
    if (!res.ok) fetchRuns();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  /* ——— attendance screen ——— */
  if (openRun && openSession) {
    return (
      <div className="space-y-6">
        <button onClick={() => setOpenSession(null)} className="text-[#1C54CB] font-bold flex items-center gap-2">→ رجوع إلى الدفعة</button>
        <div className="bg-white p-6 rounded-[24px] border border-[#DFE5F2] shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
          <h2 className="text-xl font-display font-bold text-[#101A38]">تحضير جلسة {fmtDate(openSession.date)}</h2>
          <p className="text-sm text-[#5F6B92] mt-1">{openRun.program?.nameAr} · {WEEKDAYS_AR[openRun.weekday]} {openRun.time}</p>
        </div>
        <div className="space-y-3">
          {attStudents.map((s) => (
            <div key={s.id} className="bg-white p-4 rounded-2xl border border-[#DFE5F2] flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="font-display font-bold text-[#101A38] flex-1">{s.firstName}</div>
              <div className="flex gap-2 flex-wrap">
                {ATT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => mark(s.id, o.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                      s.status === o.value ? o.cls + ' scale-105' : 'bg-white text-[#5F6B92] border-[#DFE5F2]'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {attStudents.length === 0 && <div className="text-center py-12 text-[#5F6B92] font-bold bg-white rounded-2xl border border-[#DFE5F2]">لا يوجد طلاب مسجلون في هذه الدفعة.</div>}
        </div>
      </div>
    );
  }

  /* ——— run detail (roster + sessions) ——— */
  if (openRun) {
    return (
      <div className="space-y-6">
        <button onClick={() => setOpenRun(null)} className="text-[#1C54CB] font-bold flex items-center gap-2">→ رجوع إلى الدفعات</button>
        <div className="bg-white p-6 rounded-[24px] border border-[#DFE5F2] shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-display font-bold text-[#101A38]">{openRun.program?.nameAr} — {openRun.titleAr || fmtDate(openRun.startDate)}</h2>
              <p className="text-sm text-[#5F6B92] mt-1">{WEEKDAYS_AR[openRun.weekday]} {openRun.time} · {openRun.format === 'in_person' ? 'حضوري' : 'أونلاين'}{openRun.location ? ` · ${openRun.location}` : ''} · السعة {openRun.capacity} · {openRun.monthlyPriceSar} ر.س/شهر</p>
            </div>
            <button onClick={() => (editing ? setEditing(false) : startEdit(openRun))} className="text-[#1C54CB] font-bold text-sm bg-[#F0F5FF] px-4 py-2 rounded-xl hover:bg-[#E0EBFF] transition-colors">
              {editing ? 'إلغاء' : 'تعديل الدفعة'}
            </button>
          </div>
          {editing && (
            <form onSubmit={saveEdit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#DFE5F2]">
              <div>
                <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">اسم الدفعة</label>
                <input value={eTitle} onChange={(e) => setETitle(e.target.value)} className="input-hq" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">الوقت</label>
                <input type="time" value={eTime} onChange={(e) => setETime(e.target.value)} className="input-hq font-mono text-center" dir="ltr" required />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">السعة</label>
                <input type="number" value={eCap} onChange={(e) => setECap(e.target.value)} className="input-hq font-mono text-center" min="1" max="100" required />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">السعر الشهري (ر.س)</label>
                <input type="number" value={ePrice} onChange={(e) => setEPrice(e.target.value)} className="input-hq font-mono text-center" min="0" required />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">الموقع</label>
                <input value={eLoc} onChange={(e) => setELoc(e.target.value)} className="input-hq" />
              </div>
              <div className="flex items-end">
                <button disabled={saving} type="submit" className="w-full bg-[#1C54CB] text-white px-6 py-3 rounded-xl font-display font-bold shadow-[0_4px_0_#11388E] disabled:opacity-70">
                  {saving ? 'جاري الحفظ…' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-white rounded-[24px] border border-[#DFE5F2] overflow-hidden">
          <div className="p-5 border-b border-[#DFE5F2] font-display font-bold text-[#101A38]">الطلاب المسجلون ({roster.length})</div>
          <table className="data-table">
            <thead><tr><th>الطالب</th><th>ولي الأمر</th><th>الهاتف</th><th>الاشتراك</th><th>الحالة</th></tr></thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.enrollmentId}>
                  <td data-label="الطالب" className="font-display font-bold text-[#101A38]">{r.student.firstName} <span className="text-xs text-[#5F6B92] font-body">({r.student.birthYear})</span></td>
                  <td data-label="ولي الأمر" className="text-sm font-bold text-[#5F6B92]">{r.student.parentName || '-'}</td>
                  <td data-label="الهاتف" className="font-mono text-xs" dir="ltr">{r.student.phone}</td>
                  <td data-label="الاشتراك" className="font-mono text-sm font-bold text-[#101A38]">
                    {Math.round(r.monthlyPriceSar * (100 - r.discountPct)) / 100} ر.س
                    {r.discountPct > 0 && <span className="text-[10px] text-[#8a6d00] bg-[rgba(255,202,23,0.2)] rounded-full px-2 py-0.5 mr-1">-{r.discountPct}٪</span>}
                  </td>
                  <td data-label="الحالة"><span className={`status-badge ${r.status === 'active' ? 'enrolled' : 'new'}`}>{r.status === 'active' ? 'نشط' : r.status === 'paused' ? 'موقوف' : 'معلق'}</span></td>
                </tr>
              ))}
              {roster.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-[#5F6B92] font-bold">لا يوجد مسجلون بعد.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-[24px] border border-[#DFE5F2] overflow-hidden">
          <div className="p-5 border-b border-[#DFE5F2] font-display font-bold text-[#101A38]">الجلسات ({sessions.length}) — اضغط جلسة للتحضير</div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {sessions.map((s, i) => {
              const past = new Date(s.date) <= new Date();
              return (
                <button
                  key={s.id}
                  onClick={() => openAttendance(s)}
                  className={`p-3 rounded-xl border-2 text-center transition-all hover:border-[#1C54CB] ${past ? 'bg-[#F0F5FF] border-[#DFE5F2]' : 'bg-white border-dashed border-[#DFE5F2]'}`}
                >
                  <div className="text-[10px] font-mono text-[#5F6B92]">جلسة {i + 1}</div>
                  <div className="font-mono text-sm font-bold text-[#101A38]" dir="ltr">{fmtDate(s.date)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ——— runs list ——— */
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
        <div>
          <h2 className="text-3xl font-display font-bold text-[#101A38]">الدفعات الشهرية</h2>
          <p className="text-sm text-[#5F6B92] mt-1 font-medium">إنشاء دفعة يولّد جلساتها الأسبوعية تلقائياً</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-[#1C54CB] text-white px-6 py-3 rounded-xl font-display font-bold shadow-[0_4px_0_#11388E] hover:translate-y-[-2px] hover:shadow-[0_6px_0_#11388E] transition-all">
          {showForm ? 'إغلاق' : '+ دفعة جديدة'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 sm:p-8 rounded-[24px] border border-[#DFE5F2] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-2">
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">البرنامج</label>
            <select value={programId} onChange={(e) => setProgramId(e.target.value)} className="input-hq">
              {programs.map((p) => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">اسم الدفعة (اختياري)</label>
            <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} className="input-hq" placeholder="مثال: دفعة يناير ٢٠٢٧" />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">من تاريخ</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-hq font-mono" dir="ltr" required />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">إلى تاريخ</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-hq font-mono" dir="ltr" required />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">اليوم</label>
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className="input-hq">
              {WEEKDAYS_AR.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">الوقت</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-hq font-mono text-center" dir="ltr" required />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">النوع</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="input-hq">
              <option value="in_person">حضوري</option>
              <option value="online">أونلاين</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">السعة</label>
            <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="input-hq font-mono text-center" min="1" max="100" required />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">السعر الشهري (ر.س)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input-hq font-mono text-center" min="0" required />
          </div>
          {format === 'in_person' && (
            <div className="lg:col-span-3">
              <label className="block text-[13px] font-bold text-[#5F6B92] mb-2">الموقع (اختياري)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-hq" placeholder="مثال: مدرسة أطياف، حي الصحافة..." />
            </div>
          )}
          <div className="lg:col-span-4 flex justify-end">
            <button disabled={submitting} type="submit" className="w-full sm:w-auto bg-[#1C54CB] text-white px-8 py-3.5 rounded-xl font-display font-bold text-lg shadow-[0_4px_0_#11388E] disabled:opacity-70">
              {submitting ? 'جاري الإنشاء…' : 'إنشاء الدفعة وتوليد الجلسات'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-[24px] border border-[#DFE5F2] overflow-hidden shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
        <table className="data-table">
          <thead><tr><th>البرنامج / الدفعة</th><th>الجدول</th><th>الفترة</th><th>المسجلون</th><th>المقاعد</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className={!r.active ? 'opacity-60 bg-[#F7FAFF]' : ''}>
                <td data-label="البرنامج">
                  <div className="font-display font-bold text-[15px]" style={{ color: r.program?.color || '#1C54CB' }}>{r.program?.nameAr}</div>
                  <div className="text-xs text-[#5F6B92] mt-0.5">{r.titleAr || '-'}</div>
                </td>
                <td data-label="الجدول" className="text-sm font-bold text-[#101A38]">{WEEKDAYS_AR[r.weekday]} <span className="font-mono">{r.time}</span></td>
                <td data-label="الفترة" className="font-mono text-xs text-[#5F6B92]" dir="ltr">{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                <td data-label="المسجلون" className="font-mono text-sm font-bold text-[#1C54CB]">{r._count?.enrollments ?? 0}</td>
                <td data-label="المقاعد" className="font-mono text-sm font-bold text-[#101A38]">{r.capacity - r.seatsLeft}/{r.capacity}</td>
                <td data-label="السعر" className="font-mono text-sm font-bold text-[#101A38]">{r.monthlyPriceSar}</td>
                <td data-label="الحالة">
                  <button onClick={() => toggleActive(r)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${r.active ? 'bg-[rgba(28,84,203,0.1)] text-[#1C54CB] border-[rgba(28,84,203,0.2)]' : 'bg-[#F7FAFF] text-[#5F6B92] border-[#DFE5F2]'}`}>
                    {r.active ? 'نشطة' : 'موقفة'}
                  </button>
                </td>
                <td data-label="إجراءات">
                  <button onClick={() => openRoster(r)} className="text-[#1C54CB] font-bold text-sm bg-[#F0F5FF] px-4 py-2 rounded-xl hover:bg-[#E0EBFF] transition-colors">
                    الطلاب والتحضير
                  </button>
                </td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={8} className="text-center py-16 text-[#5F6B92] font-bold">لا توجد دفعات.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
