'use client';

import { useEffect, useState } from 'react';
import { useAdminSearch, pick, setAdminParams } from './useAdminQuery';

export const ADMIN_TABS = ['kpis', 'runs', 'instructors', 'payments', 'progress', 'makeup', 'bookings', 'slots', 'content', 'blog', 'bricks', 'curriculum', 'nelc', 'support'] as const;
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
import { InstructorsTab } from './InstructorsTab';

export function AdminDashboard({ programs }: { programs: any[] }) {
  const params = useAdminSearch();
  const activeTab = pick(params, 'tab', ADMIN_TABS, 'bookings');
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    if (!drawer) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawer(false);
        document.querySelector<HTMLButtonElement>('[data-testid="button-admin-menu"]')?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawer]);
  const selectTab = (id: string) => {
    setDrawer(false);
    if (id !== activeTab) {
      setAdminParams({ tab: id === 'bookings' ? null : id }, 'push');
      window.scrollTo({ top: 0 });
    }
  };
  
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
      id: 'instructors',
      label: 'المدرّبون',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 16v5"/><circle cx="12" cy="9" r="3"/></svg>
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

  const groups: { id: string; label: string; ids: string[] }[] = [
    { id: 'ops', label: 'العمليات', ids: ['bookings', 'runs', 'makeup', 'payments', 'instructors'] },
    { id: 'learning', label: 'التعلّم', ids: ['progress', 'curriculum', 'nelc', 'content'] },
    { id: 'site', label: 'الموقع والتقارير', ids: ['kpis', 'slots', 'blog', 'bricks', 'support'] },
  ];
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const current = byId.get(activeTab)!;

  const navList = (where: 'side' | 'drawer') => groups.map((g) => (
    <div key={g.id} className="adm-group" role="group" aria-labelledby={`adm-g-${where}-${g.id}`}>
      <div id={`adm-g-${where}-${g.id}`} className="adm-group-label">{g.label}</div>
      {g.ids.map((id) => {
        const t = byId.get(id)!;
        const on = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => selectTab(id)}
            className="adm-nav-btn"
            data-testid={`${where === 'side' ? 'nav' : 'drawer'}-admin-${id}`}
          >
            <span className="adm-nav-ico" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  ));

  return (
    <div className="admin-wrap adm-bp">
      <a href="#admin-main" className="adm-skip">تخطَّ إلى المحتوى</a>
      <aside className="admin-sidebar" aria-label="أقسام لوحة الإدارة">
        <div className="adm-brand">
          <div className="adm-brand-mark"><KiteMark size={30} dark full={false} /></div>
          <div>
            <Wordmark lang="ar" style={{ fontSize: 20, color: '#101A38', '--wm-fun': '#6B3FD1', '--wm-ademy': '#101A38' } as React.CSSProperties} />
            <div className="adm-brand-sub">لوحة الإدارة</div>
          </div>
        </div>
        <nav className="adm-nav">{navList('side')}</nav>
        <div className="adm-side-foot">
          <button type="button" onClick={handleLogout} className="adm-logout" data-testid="button-admin-logout">تسجيل الخروج</button>
        </div>
      </aside>

      <main className="admin-content" id="admin-main">
        <div className="adm-mobile-bar">
          <div className="adm-brand-mark sm"><KiteMark size={22} dark full={false} /></div>
          <div className="adm-mobile-title">
            <small>لوحة الإدارة</small>
            <b data-testid="text-admin-current-mobile">{current.label}</b>
          </div>
          <button
            type="button"
            className="adm-drawer-btn"
            aria-expanded={drawer}
            aria-controls="adm-drawer"
            onClick={() => setDrawer((v) => !v)}
            data-testid="button-admin-menu"
          >
            {drawer ? 'إغلاق' : 'الأقسام'}
          </button>
        </div>
        {drawer && (
          <div id="adm-drawer" className="adm-drawer" data-testid="panel-admin-drawer"
            onKeyDown={(e) => { if (e.key === 'Escape') setDrawer(false); }}>
            <nav aria-label="أقسام لوحة الإدارة">{navList('drawer')}</nav>
            <button type="button" onClick={handleLogout} className="adm-logout" data-testid="button-admin-logout-mobile">تسجيل الخروج</button>
          </div>
        )}

        <div className="adm-crumb" data-testid="text-admin-current">
          <span>{groups.find((g) => g.ids.includes(activeTab))?.label}</span>
          <span aria-hidden="true">/</span>
          <b>{current.label}</b>
        </div>

        <div className="max-w-7xl mx-auto adm-view" key={activeTab}>
          {activeTab === 'kpis' && <KpisTab />}
          {activeTab === 'runs' && <RunsTab programs={programs} />}
          {activeTab === 'instructors' && <InstructorsTab />}
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
