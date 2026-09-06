import React from 'react';
import { useGetMe, logout } from '@workspace/api-client-react';
import { Link, useLocation, useRoute } from 'wouter';
import { LayoutDashboard, Users, BookOpen, FileText, LogOut, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const [isActive] = useRoute(href);
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
        isActive ? 'bg-primary text-white font-medium shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
      }`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </Link>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'admin' && user.role !== 'teacher'))) {
      setLocation('/login');
    }
  }, [user, isLoading, setLocation]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  if (isLoading || !user) return null;

  const navItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Overview' },
    { href: '/admin/users', icon: Users, label: 'Parents & Users' },
    { href: '/admin/curriculum', icon: BookOpen, label: 'Curriculum Manager' },
    { href: '/admin/blog', icon: FileText, label: 'Blog CMS' },
  ];

  return (
    <div className="min-h-screen bg-muted/20 flex font-sans" dir="ltr">
      <aside className="w-64 bg-slate-950 text-slate-100 flex flex-col fixed inset-y-0 left-0 z-10">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white font-bold">M</div>
          <span className="font-bold tracking-tight">Manara Admin</span>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1">
          {navItems.map(item => (
            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-500 mb-4 px-2">{user.email}</div>
          <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-900" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8 overflow-x-hidden min-h-screen">
        {children}
      </main>
    </div>
  );
}
