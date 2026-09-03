import Link from 'next/link';
import { Wordmark } from '@/components/brand/FunAdemyMark';
import { FlipMark } from '@/components/brand/FlipMark';
import { YELogo } from '@/components/brand/YELogo';
import { dict } from '@/lib/i18n';
import { PHONE_DISPLAY, WHATSAPP_NUMBER } from '@/lib/constants';
import { LangSwitcher } from '@/components/LangSwitcher';
import { Phone, GraduationCap } from 'lucide-react';

export function SiteHeader({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-700 focus:rounded focus:shadow-lg">
        {lang === 'ar' ? 'تخطى إلى المحتوى الرئيسي' : 'Skip to main content'}
      </a>
      <div className="top" role="navigation" aria-label={lang === 'ar' ? 'معلومات التواصل' : 'Contact info'}>
        <div className="wrap">
          <span className="flex items-center gap-2"><GraduationCap size={16} /> {d.topBanner}</span>
          <span dir="ltr">
            <Phone size={14} className="inline-block mr-1" /> <a href={`tel:+${WHATSAPP_NUMBER}`}>{PHONE_DISPLAY}</a> ·{' '}
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`}>{d.whatsapp}</a>
          </span>
        </div>
      </div>

      <nav className="site-nav" aria-label={lang === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}>
        <div className="wrap nav-in">
          <Link href={lang === 'ar' ? '/' : '/en'} className="brand" aria-label={lang === 'ar' ? 'FunAdemy — الصفحة الرئيسية' : 'FunAdemy — Home'}>
            <FlipMark size={42} />
            <Wordmark lang={lang} style={{ fontSize: 26, lineHeight: 1 }} />
            <YELogo height={28} className="opacity-70 hover:opacity-100 transition-opacity" />
          </Link>
          <div className="links">
            <a href="#path">{d.navPath}</a>
            <Link href={lang === 'ar' ? '/programs' : '/en/programs'}>{d.navPrograms}</Link>
            <a href="#workshop">{d.navWorkshop}</a>
            <a href="#pricing">{d.navPricing}</a>
            <Link href={lang === 'ar' ? '/blog' : '/en/blog'}>{d.navBlog}</Link>
            <Link href={lang === 'ar' ? '/portal' : '/en/portal'}>{d.navPortal}</Link>
            <LangSwitcher lang={lang} />
            <Link className="btn y" href={lang === 'ar' ? '/book' : '/en/book'}>
              {d.navTrial}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
