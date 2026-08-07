'use client';

import { useState } from 'react';
import { BookingsTab } from './BookingsTab';
import { SlotsTab } from './SlotsTab';
import { ContentTab } from './ContentTab';
import { BricksTab } from './BricksTab';
import { KiteMark, Wordmark } from '@/components/brand/FunAdemyMark';

export function AdminDashboard({ programs }: { programs: any[] }) {
  const [activeTab, setActiveTab] = useState('bookings');
  
  const handleLogout = async () => {
    await fetch('/svc/admin/login', { method: 'DELETE' });
    window.location.reload();
  };

  const tabs = [
    { 
      id: 'bookings', 
      label: 'الحجوزات', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> 
    },
    { 
      id: 'slots', 
      label: 'المواعيد', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> 
    },
    { 
      id: 'content', 
      label: 'المحتوى', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 
    },
    { 
      id: 'bricks', 
      label: 'حملة وطنّا', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="2" x2="6" y2="10"/><line x1="18" y1="2" x2="18" y2="10"/><line x1="12" y1="14" x2="12" y2="22"/></svg> 
    },
  ];

  return (
    <div className="admin-wrap" dir="rtl">
      <aside className="admin-sidebar">
        <div className="p-6 border-b border-[#26325C]">
          <div className="mb-4 w-full h-12 flex items-center justify-center gap-2">
            <KiteMark size={34} dark full={false} />
            <Wordmark
              lang="ar"
              style={{ fontSize: 22, color: '#fff', ['--wm-fun' as never]: '#FFCA17', ['--wm-ademy' as never]: '#fff' }}
            />
          </div>
          <h2 className="font-display font-bold text-lg text-[#FFC400]">لوحة التحكم</h2>
          <div className="text-xs text-[#9DA9CF] font-mono mt-1">v2.0 Admin Panel</div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
                activeTab === t.id 
                  ? 'bg-[#2764D6] text-white shadow-md' 
                  : 'text-[#9DA9CF] hover:bg-[#1A2855] hover:text-white'
              }`}
            >
              <span className="opacity-80">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-[#26325C]">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-[#FF7B74] hover:bg-[#1A2855] rounded-lg transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>
      
      <main className="admin-content">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'bookings' && <BookingsTab />}
          {activeTab === 'slots' && <SlotsTab programs={programs} />}
          {activeTab === 'content' && <ContentTab />}
          {activeTab === 'bricks' && <BricksTab />}
        </div>
      </main>
    </div>
  );
}