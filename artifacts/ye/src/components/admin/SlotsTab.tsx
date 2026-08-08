'use client';

import { useState, useEffect } from 'react';
import { WEEKDAYS_AR } from '@/lib/constants';

export function SlotsTab({ programs }: { programs: any[] }) {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [programId, setProgramId] = useState(programs[0]?.id || '');
  const [weekday, setWeekday] = useState('0');
  const [time, setTime] = useState('17:00');
  const [format, setFormat] = useState('in_person');
  const [capacity, setCapacity] = useState('12');
  const [location, setLocation] = useState('');

  const fetchSlots = async () => {
    try {
      const res = await fetch('/svc/admin/slots');
      if (res.status === 401) window.location.reload();
      const data = await res.json();
      setSlots(data.slots || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlots(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload = {
      programId: Number(programId),
      weekday: Number(weekday),
      time,
      format,
      capacity: Number(capacity),
      location: format === 'in_person' ? location : null
    };

    const res = await fetch('/svc/admin/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      await fetchSlots();
      setLocation('');
    } else {
      alert('حدث خطأ في الإضافة، تأكد من صحة البيانات.');
    }
    setIsSubmitting(false);
  };

  const toggleActive = async (id: number, currentActive: boolean) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, active: !currentActive } : s));
    const res = await fetch('/svc/admin/slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !currentActive })
    });
    if (!res.ok) fetchSlots();
  };

  const deleteSlot = async (id: number) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    const res = await fetch(`/svc/admin/slots?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      if (data.deactivated) {
        alert('تم إيقاف الموعد بدلاً من حذفه لوجود حجوزات مرتبطة به.');
        fetchSlots();
      } else {
        setSlots(prev => prev.filter(s => s.id !== id));
      }
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
      <div className="bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[#DFE5F2]">
          <div className="w-12 h-12 bg-[#F0F5FF] rounded-2xl flex items-center justify-center text-[#1C54CB]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-[#101A38]">إضافة موعد جديد</h2>
            <p className="text-sm text-[#5F6B92] mt-1 font-medium">قم بجدولة الجلسات لتظهر في صفحة التسجيل</p>
          </div>
        </div>
        
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
          <div className="lg:col-span-2">
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2 uppercase tracking-wide">البرنامج</label>
            <select value={programId} onChange={e => setProgramId(e.target.value)} className="input-hq">
              {programs.map(p => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2 uppercase tracking-wide">اليوم</label>
            <select value={weekday} onChange={e => setWeekday(e.target.value)} className="input-hq">
              {WEEKDAYS_AR.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2 uppercase tracking-wide">الوقت</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input-hq font-mono text-center" dir="ltr" required />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2 uppercase tracking-wide">النوع</label>
            <select value={format} onChange={e => setFormat(e.target.value)} className="input-hq">
              <option value="in_person">حضوري</option>
              <option value="online">أونلاين</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#5F6B92] mb-2 uppercase tracking-wide">السعة</label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} className="input-hq font-mono text-center" min="1" max="100" required />
          </div>
          {format === 'in_person' && (
            <div className="lg:col-span-6">
              <label className="block text-[13px] font-bold text-[#5F6B92] mb-2 uppercase tracking-wide">الموقع / المدرسة (اختياري)</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="input-hq" placeholder="مثال: مدرسة أطياف، حي الصحافة..." />
            </div>
          )}
          <div className="lg:col-span-6 flex justify-end mt-4">
            <button disabled={isSubmitting} type="submit" className="w-full sm:w-auto bg-[#1C54CB] text-white px-8 py-3.5 rounded-xl font-display font-bold text-lg shadow-[0_4px_0_#11388E] hover:translate-y-[-2px] hover:shadow-[0_6px_0_#11388E] active:translate-y-[2px] active:shadow-[0_2px_0_#11388E] transition-all disabled:opacity-70 flex items-center justify-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {isSubmitting ? 'جاري الإضافة...' : 'اعتماد الموعد'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2] overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>البرنامج</th>
              <th>اليوم والوقت</th>
              <th>النوع</th>
              <th>الموقع</th>
              <th>السعة</th>
              <th>متاح</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {slots.map(s => (
              <tr key={s.id} className={!s.active ? 'opacity-60 bg-[#F7FAFF]' : ''}>
                <td data-label="البرنامج" className="font-display font-bold text-[15px] text-[#1C54CB]">{s.program?.nameAr}</td>
                <td data-label="اليوم والوقت">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#101A38] bg-[#F7FAFF] px-2 py-1 rounded-md border border-[#DFE5F2]">{WEEKDAYS_AR[s.weekday]}</span>
                    <span className="font-mono text-sm font-bold text-[#5F6B92] bg-[#F7FAFF] px-2 py-1 rounded-md border border-[#DFE5F2]">{s.time}</span>
                  </div>
                </td>
                <td data-label="النوع" className="text-sm font-bold text-[#5F6B92]">
                  {s.format === 'in_person' ? 'حضوري' : 'أونلاين'}
                </td>
                <td data-label="الموقع" className="text-sm font-bold text-[#5F6B92] truncate max-w-[150px]" title={s.location || '-'}>
                  {s.location || '-'}
                </td>
                <td data-label="السعة" className="font-mono text-sm font-bold text-[#101A38]">{s.capacity}</td>
                <td data-label="متاح">
                  <span className={`font-mono text-sm font-bold px-2 py-1 rounded-md border ${s.seatsLeft > 0 ? 'bg-[rgba(34,218,255,0.1)] text-[#0C85A3] border-[rgba(34,218,255,0.2)]' : 'bg-[#F7FAFF] text-[#5F6B92] border-[#DFE5F2]'}`}>
                    {s.seatsLeft}
                  </span>
                </td>
                <td data-label="الحالة">
                  <button 
                    onClick={() => toggleActive(s.id, s.active)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border ${s.active ? 'bg-[rgba(28,84,203,0.1)] text-[#1C54CB] border-[rgba(28,84,203,0.2)] hover:bg-[rgba(28,84,203,0.15)]' : 'bg-[#F7FAFF] text-[#5F6B92] border-[#DFE5F2] hover:bg-[#F0F5FF]'}`}
                  >
                    {s.active ? 'نشط' : 'موقف'}
                  </button>
                </td>
                <td data-label="إجراءات">
                  <button onClick={() => deleteSlot(s.id)} className="text-[#e11d48] hover:bg-[#ffe4e6] p-2.5 rounded-xl transition-colors flex items-center justify-center border border-transparent hover:border-[#fecdd3]" title="حذف" aria-label="حذف الموعد">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>
              </tr>
            ))}
            {slots.length === 0 && (
              <tr><td colSpan={8} className="text-center py-16 text-[#5F6B92] font-bold">لا توجد مواعيد مضافة.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
