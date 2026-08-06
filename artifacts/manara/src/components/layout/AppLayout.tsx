import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetMe, logout } from '@workspace/api-client-react';
import { Link, useLocation, useRoute } from 'wouter';
import { Users, CreditCard, Settings, LogOut, LayoutDashboard, Menu, X, BookOpen, PlaySquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

function NavItem({ href, icon: Icon, label, onClick }: { href: string; icon: any; label: string; onClick?: () => void }) {
  const [isActive] = useRoute(href);
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
        isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`} onClick={onClick}>
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { data: user, isLoading } = useGetMe();
  const [, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && (!user || user.role !== 'parent')) {
      setLocation('/login');
    }
  }, [user, isLoading, setLocation]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  if (isLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse w-8 h-8 rounded-full bg-primary" /></div>;

  const navItems = [
    { href: '/app', icon: LayoutDashboard, label: t('لوحة التحكم', 'Dashboard') },
    { href: '/app/children', icon: Users, label: t('الأبناء', 'Children') },
    { href: '/app/subscription', icon: CreditCard, label: t('الاشتراك', 'Subscription') },
    { href: '/app/settings', icon: Settings, label: t('الإعدادات', 'Settings') },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-background border-b sticky top-0 z-50">
        <Link href="/app" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-primary">{t('منارة', 'Manara')}</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 start-0 z-40 w-64 bg-background border-e transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : 'rtl:translate-x-full ltr:-translate-x-full'}
      `}>
        <div className="p-6 hidden md:flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-primary">{t('منارة', 'Manara')}</span>
        </div>

        <nav className="flex-1 px-4 py-6 md:py-0 space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} onClick={() => setIsSidebarOpen(false)} />
          ))}

          <div className="pt-4 mt-4 border-t border-border">
            <Button variant="default" className="w-full justify-start mb-4" asChild>
              <Link href="/app/profiles" onClick={() => setIsSidebarOpen(false)}>
                <PlaySquare className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('دخول وضع الطفل', 'Enter Child Mode')}
              </Link>
            </Button>

            <button 
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
              onClick={() => { setLang(lang === 'ar' ? 'en' : 'ar'); setIsSidebarOpen(false); }}
            >
              <span className="w-5 h-5 flex items-center justify-center font-bold">A</span>
              <span>{t('English', 'عربي')}</span>
            </button>
            <button 
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors w-full mt-2"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              <span>{t('تسجيل خروج', 'Logout')}</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 w-full max-w-5xl mx-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
