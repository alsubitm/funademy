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
    const res = await fetch('/svc/admin/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    }
  };

  if (loading) return <div className="p-8 text-center text-[#54618C] font-bold">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-[#E4E9F5]">
        <div>
          <h2 className="text-2xl font-display font-bold text-[#101A38]">الحجوزات</h2>
          <p className="text-[#54618C] text-sm mt-1">إجمالي الحجوزات: <span className="font-mono font-bold text-[#2764D6]">{bookings.length}</span></p>
        </div>
        <a 
          href="/svc/admin/bookings?format=csv"
          className="bg-[#101A38] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#2764D6] transition-colors inline-flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          تصدير CSV
        </a>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E4E9F5] overflow-x-auto">
        <table className="admin-table">
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
                <td className="font-mono text-xs text-[#54618C]">{b.id}</td>
                <td className="text-sm font-medium">{new Date(b.createdAt).toLocaleDateString('ar-SA')}</td>
                <td>
                  <div className="font-bold">{b.parentName}</div>
                  <div className="font-mono text-xs text-[#54618C] dir-ltr text-right mt-1">{b.phone}</div>
                </td>
                <td>
                  <div className="font-bold">{b.childFirstName}</div>
                  <div className="text-xs text-[#54618C] mt-1">{new Date().getFullYear() - b.childBirthYear} سنوات</div>
                </td>
                <td className="text-sm font-medium">{b.neighborhood}</td>
                <td>
                  <div className="font-bold text-sm text-[#2764D6]">{b.program?.nameAr}</div>
                  <div className="text-xs text-[#54618C] mt-1 font-medium">
                    {b.slot ? `${WEEKDAYS_AR[b.slot.weekday]} - ${b.slot.time}` : '-'}
                  </div>
                </td>
                <td>
                  <span className={`badge ${b.status}`}>
                    {b.status === 'new' ? 'جديد' : b.status === 'contacted' ? 'تم التواصل' : 'مسجل'}
                  </span>
                </td>
                <td>
                  <select 
                    value={b.status}
                    onChange={(e) => updateStatus(b.id, e.target.value)}
                    className="bg-[#F5F8FF] border border-[#E4E9F5] rounded-lg px-2 py-1 text-sm font-bold text-[#101A38] outline-none w-full"
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
                <td colSpan={8} className="text-center py-8 text-[#54618C] font-medium">لا توجد حجوزات بعد.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}