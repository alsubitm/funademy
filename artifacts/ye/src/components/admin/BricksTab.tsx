'use client';

import { useState, useEffect } from 'react';

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
    </div>
  );
}
