'use client';

import { useState, useEffect } from 'react';

export function KpisTab() {
  const [kpis, setKpis] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Current month in Asia/Riyadh (UTC+3): shift then read the UTC date fields.
  const [month, setMonth] = useState(() => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 7));

  useEffect(() => {
    (async () => {
      const [k, r] = await Promise.all([fetch('/svc/admin/kpis'), fetch(`/svc/admin/report?month=${month}`)]);
      if (k.status === 401) { window.location.reload(); return; }
      if (k.ok) setKpis(await k.json());
      if (r.ok) setRows((await r.json()).rows || []);
      setLoading(false);
    })();
  }, [month]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  const cards = [
    { label: 'طلاب نشطون', value: kpis?.activeStudents ?? 0, icon: '🎓' },
    { label: 'الإيراد الشهري (ر.س)', value: (kpis?.monthlyRevenueSar ?? 0).toLocaleString('en-US'), icon: '💰' },
    { label: 'نسبة امتلاء المقاعد', value: `${kpis?.seatsFilledPct ?? 0}٪`, icon: '📊' },
    { label: 'دفعات نشطة', value: kpis?.activeRuns ?? 0, icon: '📅' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
        <div>
          <h2 className="text-3xl font-display font-bold text-[#101A38]">المؤشرات والتقارير</h2>
          <p className="text-sm text-[#5F6B92] mt-1 font-medium">نظرة شهرية على الأكاديمية — قابلة للتنزيل بضغطة واحدة</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
        <input
          type="month"
          value={month}
          onChange={(e) => { if (e.target.value) { setMonth(e.target.value); setLoading(true); } }}
          className="input-hq font-mono !w-auto"
          dir="ltr"
        />
        <a
          href={`/svc/admin/report?month=${month}&format=csv`}
          className="bg-[#101A38] text-white px-6 py-3 rounded-xl font-display font-bold shadow-[0_4px_0_#051036] hover:translate-y-[-2px] hover:shadow-[0_6px_0_#051036] transition-all inline-flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          تقرير شهري CSV
        </a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white p-6 rounded-[20px] border border-[#DFE5F2] shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
            <div className="text-2xl">{c.icon}</div>
            <div className="font-display font-bold text-3xl text-[#101A38] mt-2 font-mono">{c.value}</div>
            <div className="text-xs font-bold text-[#5F6B92] mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[24px] border border-[#DFE5F2] overflow-hidden shadow-[0_8px_30px_rgba(7,17,42,0.04)]">
        <div className="p-5 border-b border-[#DFE5F2] font-display font-bold text-[#101A38]">تفصيل حسب الدفعة — شهر {month}</div>
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>البرنامج / الدفعة</th><th>المسجلون</th><th>الامتلاء</th><th>الإيراد الشهري</th><th>الجلسات المنعقدة</th><th>نسبة الحضور</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.runId} className={!r.active ? 'opacity-60 bg-[#F7FAFF]' : ''}>
                <td data-label="البرنامج">
                  <div className="font-display font-bold text-[15px] text-[#1C54CB]">{r.programAr}</div>
                  <div className="text-xs text-[#5F6B92]">{r.title || '-'}</div>
                </td>
                <td data-label="المسجلون" className="font-mono text-sm font-bold text-[#101A38]">{r.enrollments}/{r.capacity}</td>
                <td data-label="الامتلاء" className="font-mono text-sm font-bold text-[#1C54CB]">{r.seatsFilledPct}٪</td>
                <td data-label="الإيراد" className="font-mono text-sm font-bold text-[#101A38]">{r.monthlyRevenueSar.toLocaleString('en-US')} ر.س</td>
                <td data-label="الجلسات" className="font-mono text-sm text-[#5F6B92]">{r.sessionsHeld}/{r.sessionsInMonth}</td>
                <td data-label="الحضور" className="font-mono text-sm font-bold text-[#101A38]">{r.attendanceRatePct === null ? '—' : `${r.attendanceRatePct}٪`}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-16 text-[#5F6B92] font-bold">لا توجد بيانات بعد.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
