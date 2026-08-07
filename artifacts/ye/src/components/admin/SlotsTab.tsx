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
    const res = await fetch('/svc/admin/slots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !currentActive })
    });
    if (res.ok) {
      setSlots(prev => prev.map(s => s.id === id ? { ...s, active: !currentActive } : s));
    }
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

  if (loading) return <div className="p-8 text-center text-[#54618C] font-bold">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E4E9F5]">
        <h2 className="text-xl font-display font-bold text-[#101A38] mb-4">إضافة موعد جديد</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-[#54618C] mb-1">البرنامج</label>
            <select value={programId} onChange={e => setProgramId(e.target.value)} className="w-full bg-[#F5F8FF] border border-[#E4E9F5] rounded-xl px-3 py-2 text-sm outline-none font-medium text-[#101A38]">
              {programs.map(p => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#54618C] mb-1">اليوم</label>
            <select value={weekday} onChange={e => setWeekday(e.target.value)} className="w-full bg-[#F5F8FF] border border-[#E4E9F5] rounded-xl px-3 py-2 text-sm outline-none font-medium text-[#101A38]">
              {WEEKDAYS_AR.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#54618C] mb-1">الوقت</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-[#F5F8FF] border border-[#E4E9F5] rounded-xl px-3 py-2 text-sm outline-none font-mono text-[#101A38] dir-ltr text-right" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#54618C] mb-1">النوع</label>
            <select value={format} onChange={e => setFormat(e.target.value)} className="w-full bg-[#F5F8FF] border border-[#E4E9F5] rounded-xl px-3 py-2 text-sm outline-none font-medium text-[#101A38]">
              <option value="in_person">حضوري</option>
              <option value="online">أونلاين</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#54618C] mb-1">السعة</label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full bg-[#F5F8FF] border border-[#E4E9F5] rounded-xl px-3 py-2 text-sm outline-none font-mono text-[#101A38]" min="1" max="100" required />
          </div>
          {format === 'in_person' && (
            <div className="lg:col-span-6">
              <label className="block text-xs font-bold text-[#54618C] mb-1">الموقع / المدرسة (اختياري)</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-[#F5F8FF] border border-[#E4E9F5] rounded-xl px-3 py-2 text-sm outline-none text-[#101A38] font-medium" placeholder="مثال: مدرسة أطياف..." />
            </div>
          )}
          <div className="lg:col-span-6 flex justify-end mt-2">
            <button disabled={isSubmitting} type="submit" className="bg-[#2764D6] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_0_#17408F] hover:translate-y-[-2px] hover:shadow-[0_6px_0_#17408F] transition-all disabled:opacity-70 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة الموعد'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E4E9F5] overflow-hidden">
        <table className="admin-table">
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
              <tr key={s.id} className={!s.active ? 'opacity-60 bg-[#F5F8FF]' : ''}>
                <td className="font-bold text-[#2764D6]">{s.program?.nameAr}</td>
                <td>
                  <span className="font-bold">{WEEKDAYS_AR[s.weekday]}</span>
                  <span className="mx-2 font-mono text-sm text-[#54618C]">{s.time}</span>
                </td>
                <td className="text-sm font-medium">{s.format === 'in_person' ? 'حضوري' : 'أونلاين'}</td>
                <td className="text-sm font-medium text-[#54618C]">{s.location || '-'}</td>
                <td className="font-mono text-sm font-bold text-[#54618C]">{s.capacity}</td>
                <td className="font-mono text-sm font-bold text-[#0E6B3A]">{s.seatsLeft}</td>
                <td>
                  <button 
                    onClick={() => toggleActive(s.id, s.active)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${s.active ? 'bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]' : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'}`}
                  >
                    {s.active ? 'نشط' : 'موقف'}
                  </button>
                </td>
                <td>
                  <button onClick={() => deleteSlot(s.id)} className="text-[#FF7B74] hover:bg-[#ffe4e6] p-2 rounded-lg transition-colors flex items-center justify-center" title="حذف">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>
              </tr>
            ))}
            {slots.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-[#54618C] font-medium">لا توجد مواعيد مضافة.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}