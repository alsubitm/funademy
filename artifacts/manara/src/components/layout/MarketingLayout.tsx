import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetMe, logout } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { BookOpen, User, Menu, X, LogOut, LayoutDashboard, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t, dir } = useI18n();
  const { data: user } = useGetMe();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const navLinks = [
    { href: '/', label: t('الرئيسية', 'Home') },
    { href: '/curriculum', label: t('المناهج', 'Curriculum') },
    { href: '/pricing', label: t('الأسعار', 'Pricing') },
    { href: '/about', label: t('عن منارة', 'About') },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-primary tracking-tight">
                {t('منارة', 'Manara')}
              </span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              title={t('English', 'عربي')}
            >
              <Globe className="w-5 h-5" />
            </Button>

            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  <Button variant="ghost" asChild>
                    <Link href={user.role === 'parent' ? '/app' : '/admin'}>
                      {t('لوحة التحكم', 'Dashboard')}
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={handleLogout}>
                    {t('تسجيل خروج', 'Logout')}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">{t('تسجيل الدخول', 'Log In')}</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/signup">{t('ابدأ مجاناً', 'Start Free Trial')}</Link>
                  </Button>
                </>
              )}
            </div>

            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t p-4 bg-background flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-base font-medium" onClick={() => setIsMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            <hr className="my-2" />
            {user ? (
              <>
                <Button variant="outline" className="w-full justify-start" asChild onClick={() => setIsMenuOpen(false)}>
                  <Link href={user.role === 'parent' ? '/app' : '/admin'}>
                    <LayoutDashboard className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                    {t('لوحة التحكم', 'Dashboard')}
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('تسجيل خروج', 'Logout')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="w-full justify-start" asChild onClick={() => setIsMenuOpen(false)}>
                  <Link href="/login">{t('تسجيل الدخول', 'Log In')}</Link>
                </Button>
                <Button className="w-full justify-start" asChild onClick={() => setIsMenuOpen(false)}>
                  <Link href="/signup">{t('ابدأ مجاناً', 'Start Free Trial')}</Link>
                </Button>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-muted py-12 mt-20">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-primary tracking-tight">
                {t('منارة', 'Manara')}
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t('الرفيق الموثوق لتعليم أبنائك المنهج السعودي بشغف ومتعة.', 'The trusted companion for your children to learn the Saudi curriculum with passion and joy.')}
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">{t('روابط سريعة', 'Quick Links')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/curriculum" className="hover:text-primary">{t('المناهج', 'Curriculum')}</Link></li>
              <li><Link href="/pricing" className="hover:text-primary">{t('الأسعار', 'Pricing')}</Link></li>
              <li><Link href="/about" className="hover:text-primary">{t('عن منارة', 'About')}</Link></li>
              <li><Link href="/blog" className="hover:text-primary">{t('المدونة', 'Blog')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">{t('قانوني', 'Legal')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-primary">{t('الشروط والأحكام', 'Terms of Service')}</Link></li>
              <li><Link href="/privacy" className="hover:text-primary">{t('سياسة الخصوصية', 'Privacy Policy')}</Link></li>
              <li><Link href="/child-safety" className="hover:text-primary">{t('حماية الطفل', 'Child Safety')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">{t('تواصل معنا', 'Contact Us')}</h4>
            <p className="text-sm text-muted-foreground mb-2">support@manara.sa</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/contact">{t('اتصل بنا', 'Contact Us')}</Link>
            </Button>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-8 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {t('أكاديمية منارة. جميع الحقوق محفوظة.', 'Manara Academy. All rights reserved.')}
        </div>
      </footer>
    </div>
  );
}
