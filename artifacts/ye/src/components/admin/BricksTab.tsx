'use client';

import { useState, useEffect } from 'react';

export function BricksTab() {
  const [data, setData] = useState({ count: 0, placedToday: 0, clicks: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [newCount, setNewCount] = useState('');

  const fetchBricks = async () => {
    try {
      const res = await fetch('/svc/admin/bricks');
      if (res.status === 401) { window.location.reload(); return; }
      if (res.ok) setData(await res.json());
    } catch {
      // keep previous data; user can retry by switching tabs
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
    }
  };

  if (loading) return <div className="p-8 text-center text-[#54618C] font-bold">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-[#0E6B3A] to-[#0A4A28] text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
          <svg className="absolute opacity-10 top-[-30px] left-[-30px] w-48 h-48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
            <line x1="6" y1="2" x2="6" y2="10"/>
            <line x1="18" y1="2" x2="18" y2="10"/>
            <line x1="12" y1="14" x2="12" y2="22"/>
          </svg>
          <h3 className="text-lg font-bold mb-2 opacity-90 relative z-10">إجمالي المكعبات (الهدف)</h3>
          <div className="text-5xl font-display font-bold relative z-10">{data.count}</div>
          <p className="mt-4 text-sm opacity-80 font-medium relative z-10">عدد المكعبات في جدار "وطنّا"</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E4E9F5]">
          <h3 className="text-lg font-bold text-[#54618C] mb-2">مكعبات اليوم</h3>
          <div className="text-5xl font-display font-bold text-[#101A38]">{data.placedToday}</div>
          <p className="mt-4 text-sm text-[#9DA9CF] font-medium">المكعبات المضافة خلال هذا اليوم</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E4E9F5]">
          <h3 className="text-lg font-bold text-[#54618C] mb-2">نقرات الواتساب</h3>
          <div className="text-5xl font-display font-bold text-[#25D366]">{data.clicks?.whatsapp || 0}</div>
          <p className="mt-4 text-sm text-[#9DA9CF] font-medium">تحويلات من زر الواتساب</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E4E9F5] mt-8 max-w-2xl">
        <h2 className="text-xl font-display font-bold text-[#101A38] mb-4">إدارة العداد</h2>
        
        <div className="flex gap-4 items-end mb-6 pb-6 border-b border-[#E4E9F5]">
          <div className="flex-1">
            <label className="block text-sm font-bold text-[#54618C] mb-2">تعديل العداد يدوياً</label>
            <input 
              type="number" 
              value={newCount}
              onChange={e => setNewCount(e.target.value)}
              placeholder="أدخل الرقم الجديد..."
              className="w-full bg-[#F5F8FF] border border-[#E4E9F5] rounded-xl px-4 py-3 text-lg outline-none font-mono text-[#101A38] focus:border-[#2764D6] transition-colors"
            />
          </div>
          <button 
            onClick={() => handleUpdate('set', Number(newCount))}
            disabled={!newCount}
            className="bg-[#2764D6] text-white px-8 py-3 rounded-xl font-bold shadow-[0_4px_0_#17408F] hover:translate-y-[-2px] hover:shadow-[0_6px_0_#17408F] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#17408F]"
          >
            تحديث
          </button>
        </div>
        
        <div>
          <h3 className="text-sm font-bold text-[#FF7B74] mb-2">منطقة الخطر</h3>
          <button 
            onClick={() => handleUpdate('reset')}
            className="bg-[#ffe4e6] text-[#e11d48] px-6 py-2.5 rounded-xl font-bold hover:bg-[#fecdd3] transition-colors inline-flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
            تصفير العداد بالكامل
          </button>
        </div>
      </div>
    </div>
  );
}