import Link from 'next/link';
import { Wordmark } from '@/components/brand/FunAdemyMark';
import { FlipMark } from '@/components/brand/FlipMark';
import { YELogo } from '@/components/brand/YELogo';
import { dict } from '@/lib/i18n';
import { PHONE_DISPLAY, WHATSAPP_NUMBER } from '@/lib/constants';
import { LangSwitcher } from '@/components/LangSwitcher';

export function SiteHeader({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <>
      <div className="top">
        <div className="wrap">
          <span>{d.topBanner}</span>
          <span dir="ltr">
            📞 <a href={`tel:+${WHATSAPP_NUMBER}`}>{PHONE_DISPLAY}</a> ·{' '}
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`}>{d.whatsapp}</a>
          </span>
        </div>
      </div>

      <nav>
        <div className="wrap nav-in">
          <Link href={lang === 'ar' ? '/' : '/en'} className="brand">
            <FlipMark size={42} />
            <Wordmark lang={lang} style={{ fontSize: 26, lineHeight: 1 }} />
            <YELogo height={28} className="opacity-70 hover:opacity-100 transition-opacity" />
          </Link>
          <div className="links">
            <a href="#path">{d.navPath}</a>
            <a href="#programs">{d.navPrograms}</a>
            <a href="#workshop">{d.navWorkshop}</a>
            <a href="#pricing">{d.navPricing}</a>
            <LangSwitcher lang={lang} />
            <a className="btn y" href="#pricing">
              {d.navTrial}
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
