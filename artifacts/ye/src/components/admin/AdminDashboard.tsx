'use client';

import { useState } from 'react';
import { BookingsTab } from './BookingsTab';
import { SlotsTab } from './SlotsTab';
import { ContentTab } from './ContentTab';
import { BlogTab } from './BlogTab';
import { BricksTab } from './BricksTab';
import { RunsTab } from './RunsTab';
import { ProgressTab } from './ProgressTab';
import { KpisTab } from './KpisTab';
import { MakeupTab } from './MakeupTab';
import { PaymentsTab } from './PaymentsTab';
import { KiteMark, Wordmark } from '@/components/brand/FunAdemyMark';
import CurriculumTab from './CurriculumTab';
import { NelcTab } from './NelcTab';
import { SupportTab } from './SupportTab';

export function AdminDashboard({ programs }: { programs: any[] }) {
  const [activeTab, setActiveTab] = useState('bookings');
  
  const handleLogout = async () => {
    await fetch('/svc/admin/login', { method: 'DELETE' });
    window.location.reload();
  };

  const tabs = [
    {
      id: 'kpis',
      label: 'المؤشرات',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    },
    {
      id: 'runs',
      label: 'الدفعات',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    },
    {
      id: 'payments',
      label: 'المدفوعات',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
    },
    {
      id: 'progress',
      label: 'التقدم',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    },
    {
      id: 'makeup',
      label: 'التعويض',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
    },
    { 
      id: 'bookings', 
      label: 'الحجوزات', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> 
    },
    { 
      id: 'slots', 
      label: 'المواعيد', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> 
    },
    { 
      id: 'content', 
      label: 'المحتوى', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 
    },
    {
      id: 'blog',
      label: 'المدونة',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    },
    { 
      id: 'bricks', 
      label: 'الوطن', 
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="2" x2="6" y2="10"/><line x1="18" y1="2" x2="18" y2="10"/><line x1="12" y1="14" x2="12" y2="22"/></svg> 
    },
    {
      id: 'curriculum',
      label: 'المناهج',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    },
    {
      id: 'nelc',
      label: 'نيلك',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
    },
    {
      id: 'support',
      label: 'الدعم',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>
    },
  ];

  return (
    <div className="admin-wrap">
      {/* DESKTOP SIDEBAR */}
      <aside className="admin-sidebar shadow-2xl">
        <div className="p-8 border-b border-white/10 relative z-10">
          <div className="mb-6 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 bg-[#1C54CB] rounded-2xl flex items-center justify-center shadow-lg border border-white/10">
              <KiteMark size={40} dark full={false} />
            </div>
            <Wordmark
              lang="ar"
              style={{ fontSize: 24, color: '#fff', '--wm-fun': '#FFCA17', '--wm-ademy': '#fff' } as React.CSSProperties}
            />
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-[#22DAFF] font-mono font-bold tracking-widest uppercase border border-[#22DAFF]/30 shadow-[0_0_10px_rgba(34,218,255,0.2)]">
              Mission Control
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 relative z-10">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-display font-bold text-lg transition-all ${
                activeTab === t.id 
                  ? 'bg-[#FFCA17] text-[#101A38] shadow-[0_4px_12px_rgba(255,202,23,0.2)] scale-[1.02]' 
                  : 'text-[#9FC0FF] hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={activeTab === t.id ? 'opacity-100' : 'opacity-70'}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-6 border-t border-white/10 relative z-10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-[#FFCA17]/70 hover:bg-white/5 hover:text-[#FFCA17] rounded-xl transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            تسجيل الخروج
          </button>
        </div>
      </aside>
      
      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-bottom-nav">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-center justify-center gap-1.5 w-16 relative z-10 transition-transform ${
              activeTab === t.id ? 'text-[#FFCA17] scale-110' : 'text-[#5F6B92]'
            }`}
          >
            {activeTab === t.id && (
              <div className="absolute -top-3 w-10 h-1 bg-[#FFCA17] rounded-b-lg shadow-[0_2px_8px_rgba(255,202,23,0.5)]"></div>
            )}
            <span className={activeTab === t.id ? 'opacity-100' : 'opacity-70'}>{t.icon}</span>
            <span className="text-[10px] font-bold font-display">{t.label}</span>
          </button>
        ))}
      </nav>
      
      <main className="admin-content">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-8 pb-4 border-b border-[#DFE5F2]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#1C54CB] rounded-xl flex items-center justify-center shadow-md">
              <KiteMark size={24} dark full={false} />
            </div>
            <div>
              <Wordmark lang="ar" style={{ fontSize: 18, color: '#101A38', '--wm-fun': '#FFCA17', '--wm-ademy': '#101A38' } as React.CSSProperties} />
              <div className="text-[10px] text-[#5F6B92] font-mono tracking-wider">MISSION CONTROL</div>
            </div>
          </div>
          <button onClick={handleLogout} aria-label="تسجيل الخروج" className="w-10 h-10 flex items-center justify-center bg-white border border-[#DFE5F2] rounded-xl text-[#5F6B92] shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>

        <div className="max-w-7xl mx-auto">
          {activeTab === 'kpis' && <KpisTab />}
          {activeTab === 'runs' && <RunsTab programs={programs} />}
          {activeTab === 'payments' && <PaymentsTab />}
          {activeTab === 'progress' && <ProgressTab />}
          {activeTab === 'makeup' && <MakeupTab />}
          {activeTab === 'bookings' && <BookingsTab />}
          {activeTab === 'slots' && <SlotsTab programs={programs} />}
          {activeTab === 'content' && <ContentTab />}
          {activeTab === 'blog' && <BlogTab />}
          {activeTab === 'bricks' && <BricksTab />}
          {activeTab === 'curriculum' && <CurriculumTab />}
          {activeTab === 'nelc' && <NelcTab />}
          {activeTab === 'support' && <SupportTab />}
        </div>
      </main>
    </div>
  );
}
