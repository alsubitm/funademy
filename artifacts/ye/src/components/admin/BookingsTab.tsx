'use client';

import { useState, useEffect } from 'react';
import { WEEKDAYS_AR } from '@/lib/constants';

export function BookingsTab() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/svc/admin/bookings');
      if (res.status === 401) window.location.reload();
      const data = await res.json();
      setBookings(data.bookings || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const updateStatus = async (id: number, status: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    const res = await fetch('/svc/admin/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
    if (!res.ok) {
       fetchBookings();
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 sm:p-8 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2]">
        <div>
          <h2 className="text-3xl font-display font-bold text-[#101A38]">الحجوزات</h2>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[#5F6B92] text-sm font-medium">إجمالي التسجيلات</span>
            <div className="bg-[#F0F5FF] text-[#1C54CB] px-3 py-1 rounded-full font-mono font-bold text-sm border border-[#1C54CB]/20">
              {bookings.length}
            </div>
          </div>
        </div>
        <a 
          href="/svc/admin/bookings?format=csv"
          className="bg-[#101A38] text-white px-6 py-3 rounded-xl font-display font-bold shadow-[0_4px_0_#051036] hover:translate-y-[-2px] hover:shadow-[0_6px_0_#051036] active:translate-y-[2px] active:shadow-[0_2px_0_#051036] transition-all inline-flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          تصدير CSV
        </a>
      </div>

      <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2] overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>التاريخ</th>
              <th>ولي الأمر / الهاتف</th>
              <th>الطفل / العمر</th>
              <th>المدينة</th>
              <th>البرنامج / الموعد</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id}>
                <td data-label="#" className="font-mono text-xs text-[#5F6B92] font-bold">
                  <div className="bg-[#F7FAFF] px-2 py-1 rounded-md border border-[#DFE5F2] inline-block">#{b.id}</div>
                </td>
                <td data-label="التاريخ" className="text-sm font-medium text-[#101A38]">
                  {new Date(b.createdAt).toLocaleDateString('ar-SA')}
                </td>
                <td data-label="ولي الأمر">
                  <div className="font-bold text-[#101A38]">{b.parentName}</div>
                  <div className="font-mono text-xs text-[#5F6B92] mt-1 bg-[#F7FAFF] px-2 py-1 rounded-md inline-block" dir="ltr">{b.phone}</div>
                </td>
                <td data-label="الطفل">
                  <div className="font-bold text-[#101A38]">{b.childFirstName}</div>
                  <div className="text-xs text-[#1C54CB] font-bold mt-1 bg-[#F0F5FF] px-2 py-1 rounded-md inline-block">
                    {new Date().getFullYear() - b.childBirthYear} سنوات
                  </div>
                </td>
                <td data-label="المدينة" className="text-sm font-bold text-[#5F6B92]">{b.neighborhood}</td>
                <td data-label="البرنامج">
                  <div className="font-display font-bold text-[15px] text-[#1C54CB] leading-tight">{b.program?.nameAr}</div>
                  <div className="text-xs text-[#5F6B92] mt-1.5 font-bold flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {b.slot ? `${WEEKDAYS_AR[b.slot.weekday]} - ${b.slot.time}` : 'لم يحدد'}
                  </div>
                </td>
                <td data-label="الحالة">
                  <span className={`status-badge ${b.status}`}>
                    {b.status === 'new' ? 'جديد' : b.status === 'contacted' ? 'تم التواصل' : 'مسجل'}
                  </span>
                </td>
                <td data-label="إجراءات">
                  <select 
                    value={b.status}
                    onChange={(e) => updateStatus(b.id, e.target.value)}
                    className="bg-[#F7FAFF] border-2 border-[#DFE5F2] rounded-xl px-3 py-2 text-sm font-bold text-[#101A38] outline-none w-full max-w-[120px] focus:border-[#1C54CB] cursor-pointer appearance-none transition-colors"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23101A38' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundPosition: 'left 8px center', backgroundRepeat: 'no-repeat', paddingLeft: '32px' }}
                  >
                    <option value="new">جديد</option>
                    <option value="contacted">تم التواصل</option>
                    <option value="enrolled">مسجل</option>
                  </select>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <div className="w-16 h-16 bg-[#F0F5FF] rounded-full flex items-center justify-center mx-auto mb-4 text-[#1C54CB]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div className="text-lg font-display font-bold text-[#101A38]">لا توجد حجوزات</div>
                  <div className="text-sm text-[#5F6B92] mt-1">لم يتم تسجيل أي طلبات حتى الآن.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
