'use client';

import { useState, useEffect, useCallback } from 'react';

type CampaignStats = {
  total: number;
  goal: number;
  remaining: number;
  progressPercent: number;
  today: number;
  yesterday: number;
  growthPercent: number | null;
  daysRemaining: number;
  nationalDay: string;
  daily: { date: string; count: number }[];
};

const dayFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' });
const formatDay = (iso: string) => dayFmt.format(new Date(`${iso}T12:00:00+03:00`));

/** Campaign tracking dashboard (ported from the legacy standalone campaign site's /track page). */
function CampaignTracking() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/svc/admin/campaign-stats');
        if (res.status === 401) { window.location.reload(); return; }
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (alive) { setStats(data); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (failed && !stats) {
    return (
      <div className="bg-[#FFF5F5] border border-[#FFE4E6] p-5 rounded-2xl text-sm font-bold text-[#e11d48]">
        تعذّر تحميل إحصاءات الحملة — حاول تحديث الصفحة.
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="bg-white p-8 rounded-[24px] border border-[#DFE5F2] text-center text-[#5F6B92] font-mono font-bold text-sm">
        LOADING CAMPAIGN STATS...
      </div>
    );
  }

  const maxDaily = Math.max(...stats.daily.map((d) => d.count), 1);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-2xl font-display font-bold text-[#101A38]">لوحة تتبّع الحملة</h2>
        <span className="text-xs text-[#5F6B92] font-bold">تُحدَّث تلقائياً كل 30 ثانية · بتوقيت الرياض</span>
      </div>
      <p className="text-sm text-[#5F6B92] font-medium mb-6">نمو حملة «أطفالنا يبنون وطننا» قبل اليوم الوطني</p>

      {/* goal progress */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-sm font-bold">
          <span className="text-[#101A38]">هدف الحملة: {stats.goal.toLocaleString('en-US')} مكعب</span>
          <span className="text-[#1C54CB]">اكتمل {stats.progressPercent}٪</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-[#EEF2FB]">
          <div
            className="h-full rounded-full bg-gradient-to-l from-[#1C54CB] to-[#22DAFF] transition-all duration-700"
            style={{ width: `${Math.min(100, stats.progressPercent)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-[#5F6B92] font-bold">
          {stats.remaining > 0
            ? `متبقٍّ ${stats.remaining.toLocaleString('en-US')} مكعب لتحقيق الهدف`
            : 'تحقّق الهدف — مبروك! 🎉'}
        </div>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-2xl border border-[#DFE5F2]">
          <div className="text-xs font-bold text-[#5F6B92] mb-1 font-mono tracking-widest uppercase">الإجمالي</div>
          <div className="text-3xl font-display font-bold text-[#1C54CB]">{stats.total.toLocaleString('en-US')}</div>
        </div>
        <div className="p-4 rounded-2xl border border-[#DFE5F2]">
          <div className="text-xs font-bold text-[#5F6B92] mb-1 font-mono tracking-widest uppercase">مكعبات اليوم</div>
          <div className="text-3xl font-display font-bold text-[#101A38]">{stats.today.toLocaleString('en-US')}</div>
          <div className="text-[11px] text-[#5F6B92] font-bold mt-1">أمس: {stats.yesterday.toLocaleString('en-US')}</div>
        </div>
        <div className="p-4 rounded-2xl border border-[#DFE5F2]">
          <div className="text-xs font-bold text-[#5F6B92] mb-1 font-mono tracking-widest uppercase">النمو اليومي</div>
          <div className={`text-3xl font-display font-bold ${stats.growthPercent === null ? 'text-[#5F6B92]' : stats.growthPercent >= 0 ? 'text-[#1C54CB]' : 'text-[#e11d48]'}`}>
            {stats.growthPercent === null ? '—' : `${stats.growthPercent > 0 ? '+' : ''}${stats.growthPercent}٪`}
          </div>
          <div className="text-[11px] text-[#5F6B92] font-bold mt-1">مقارنة بالأمس</div>
        </div>
        <div className="p-4 rounded-2xl border border-[#DFE5F2]">
          <div className="text-xs font-bold text-[#5F6B92] mb-1 font-mono tracking-widest uppercase">حتى اليوم الوطني</div>
          <div className="text-3xl font-display font-bold text-[#FFCA17] drop-shadow-[0_2px_8px_rgba(255,202,23,0.35)]">{stats.daysRemaining}</div>
          <div className="text-[11px] text-[#5F6B92] font-bold mt-1">23 سبتمبر</div>
        </div>
      </div>

      {/* daily bars — last 14 days */}
      <div>
        <h3 className="text-sm font-bold text-[#5F6B92] mb-3 font-mono tracking-widest uppercase">المكعبات المضافة يومياً — آخر 14 يوماً</h3>
        <div dir="ltr" className="flex items-end gap-1.5 h-44">
          {stats.daily.map((d, i) => {
            const isToday = i === stats.daily.length - 1;
            const h = d.count === 0 ? 3 : Math.max(6, Math.round((d.count / maxDaily) * 150));
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${formatDay(d.date)}: ${d.count}`}>
                <div className="text-[10px] font-mono font-bold text-[#5F6B92]">{d.count > 0 ? d.count.toLocaleString('en-US') : ''}</div>
                <div
                  className={`w-full max-w-[34px] rounded-t-md transition-all duration-500 ${d.count === 0 ? 'bg-[#EEF2FB]' : isToday ? 'bg-[#FFCA17]' : 'bg-[#1C54CB]'}`}
                  style={{ height: `${h}px` }}
                />
                <div className={`text-[9px] font-bold ${isToday ? 'text-[#101A38]' : 'text-[#5F6B92]'} whitespace-nowrap`}>
                  {formatDay(d.date)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BrickModeration() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [bricks, setBricks] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async (st = status) => {
    const res = await fetch(`/svc/admin/brick-wall?status=${st}`);
    if (res.ok) {
      const data = await res.json();
      setBricks(data.bricks || []);
      setCounts(data.counts || {});
    }
    setLoading(false);
  }, [status]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const moderate = async (id: number, newStatus: 'approved' | 'rejected') => {
    setBricks((prev) => prev.filter((b) => b.id !== id));
    setCounts((prev) => ({ ...prev, [status]: (prev[status] || 1) - 1, [newStatus]: (prev[newStatus] || 0) + 1 }));
    const res = await fetch('/svc/admin/brick-wall', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    if (!res.ok) fetchQueue();
  };

  const tabs: { id: 'pending' | 'approved' | 'rejected'; label: string }[] = [
    { id: 'pending', label: 'بانتظار المراجعة' },
    { id: 'approved', label: 'معتمدة' },
    { id: 'rejected', label: 'مرفوضة' },
  ];

  return (
    <div className="bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
      <h2 className="text-2xl font-display font-bold text-[#101A38] mb-2">مراجعة مكعبات جدار وطنّا</h2>
      <p className="text-sm text-[#5F6B92] font-medium mb-5">المكعبات المعتمدة فقط تظهر على الجدار العام</p>
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setStatus(t.id); setLoading(true); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
              status === t.id ? 'bg-[#101A38] text-white border-[#101A38]' : 'bg-white text-[#5F6B92] border-[#DFE5F2]'
            }`}
          >
            {t.label} ({counts[t.id] || 0})
          </button>
        ))}
      </div>
      {loading ? (
        <div className="py-10 text-center text-[#5F6B92] font-mono font-bold text-sm">LOADING...</div>
      ) : bricks.length === 0 ? (
        <div className="py-10 text-center text-[#5F6B92] font-bold border-2 border-dashed border-[#DFE5F2] rounded-2xl">لا توجد مكعبات في هذه القائمة.</div>
      ) : (
        <div className="space-y-3">
          {bricks.map((b) => (
            <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border border-[#DFE5F2]">
              <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-black/10" style={{ background: b.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[#101A38]">{b.authorName}</div>
                <div className="text-sm text-[#5F6B92] break-words">{b.message}</div>
                <div className="text-[11px] font-mono text-[#5F6B92] mt-1" dir="ltr">{new Date(b.createdAt).toLocaleString('en-GB')}</div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {status !== 'approved' && (
                  <button onClick={() => moderate(b.id, 'approved')} className="px-4 py-2 rounded-xl text-sm font-bold bg-[rgba(28,84,203,0.1)] text-[#1C54CB] border border-[rgba(28,84,203,0.2)] hover:bg-[rgba(28,84,203,0.18)]">
                    اعتماد ✓
                  </button>
                )}
                {status !== 'rejected' && (
                  <button onClick={() => moderate(b.id, 'rejected')} className="px-4 py-2 rounded-xl text-sm font-bold bg-[#FFF5F5] text-[#e11d48] border border-[#e11d48]/20 hover:bg-[#e11d48] hover:text-white">
                    رفض ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BricksTab() {
  const [data, setData] = useState({ count: 0, placedToday: 0, clicks: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [newCount, setNewCount] = useState('');
  const [saved, setSaved] = useState(false);

  const fetchBricks = async () => {
    try {
      const res = await fetch('/svc/admin/bricks');
      if (res.status === 401) { window.location.reload(); return; }
      if (res.ok) setData(await res.json());
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBricks(); }, []);

  const handleUpdate = async (action: 'reset' | 'set', val?: number) => {
    if (action === 'reset' && !confirm('هل أنت متأكد من تصفير العداد لجميع المكعبات؟')) return;
    
    const payload = action === 'reset' ? { action: 'reset' } : { count: val };
    const res = await fetch('/svc/admin/bricks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      setNewCount('');
      fetchBricks();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  return (
    <div className="space-y-8">
      <CampaignTracking />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mission Control Main Stat */}
        <div className="lg:col-span-2 glow-card p-8 sm:p-10 flex flex-col justify-center">
          <svg className="absolute opacity-10 top-[-40px] left-[-40px] w-64 h-64 text-[#22DAFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
            <line x1="6" y1="2" x2="6" y2="10"/>
            <line x1="18" y1="2" x2="18" y2="10"/>
            <line x1="12" y1="14" x2="12" y2="22"/>
          </svg>
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-[#22DAFF] animate-pulse shadow-[0_0_12px_#22DAFF]"></div>
            <h3 className="text-xl font-bold font-display text-[#9FC0FF] tracking-wide uppercase">إجمالي المكعبات</h3>
          </div>
          <div className="text-[80px] sm:text-[100px] leading-none font-display font-bold text-white relative z-10 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            {data.count.toLocaleString('en-US')}
          </div>
          <p className="mt-4 text-[#9FC0FF] font-mono tracking-widest text-sm relative z-10 uppercase">
            مكعبات حملة وطنّا
          </p>
        </div>
        
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2] flex-1 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-[#5F6B92] mb-2 font-mono tracking-widest uppercase">مكعبات اليوم</h3>
            <div className="text-5xl font-display font-bold text-[#1C54CB]">{data.placedToday}</div>
            <p className="mt-2 text-xs text-[#5F6B92] font-bold">تمت إضافتها خلال الـ 24 ساعة الماضية</p>
          </div>

          <div className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2] flex-1 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-[#5F6B92] mb-2 font-mono tracking-widest uppercase">نقرات الواتساب</h3>
            <div className="text-5xl font-display font-bold text-[#FFCA17] drop-shadow-[0_4px_12px_rgba(255,202,23,0.3)]">{data.clicks?.whatsapp || 0}</div>
            <p className="mt-2 text-xs text-[#5F6B92] font-bold">تحويلات من زر الواتساب</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 sm:p-10 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2] max-w-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_top_right,rgba(255,202,23,0.15),transparent_70%)] pointer-events-none"></div>
        <h2 className="text-2xl font-display font-bold text-[#101A38] mb-6 flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#1C54CB]"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          إدارة العداد
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 items-end mb-8 pb-8 border-b border-[#DFE5F2]">
          <div className="flex-1 w-full">
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2 uppercase tracking-wide">تعديل العداد يدوياً</label>
            <input 
              type="number" 
              value={newCount}
              onChange={e => setNewCount(e.target.value)}
              placeholder="أدخل الرقم الجديد..."
              className="input-hq font-mono text-xl"
              dir="ltr"
            />
          </div>
          <button 
            onClick={() => handleUpdate('set', Number(newCount))}
            disabled={!newCount}
            className="w-full sm:w-auto bg-[#FFCA17] text-[#101A38] px-8 py-3.5 rounded-xl font-display font-bold text-lg shadow-[0_4px_0_#D69F00] hover:translate-y-[-2px] hover:shadow-[0_6px_0_#D69F00] active:translate-y-[2px] active:shadow-[0_2px_0_#D69F00] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#D69F00]"
          >
            تحديث
          </button>
        </div>
        
        {saved && (
          <div className="mb-6 text-sm font-bold text-[#1C54CB] bg-[#1C54CB]/10 border border-[#1C54CB]/20 px-4 py-2.5 rounded-xl">
            تم تحديث العداد بنجاح
          </div>
        )}
        
        <div className="bg-[#FFF5F5] border border-[#FFE4E6] p-5 rounded-2xl">
          <h3 className="text-sm font-bold text-[#e11d48] mb-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            منطقة الخطر
          </h3>
          <button 
            onClick={() => handleUpdate('reset')}
            className="bg-white text-[#e11d48] border border-[#e11d48]/20 px-6 py-2.5 rounded-xl font-bold hover:bg-[#e11d48] hover:text-white hover:border-[#e11d48] shadow-sm transition-colors inline-flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
            تصفير العداد بالكامل
          </button>
        </div>
      </div>

      <BrickModeration />
    </div>
  );
}
