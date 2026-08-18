import Link from 'next/link';
import { KiteMark, Wordmark } from '@/components/brand/FunAdemyMark';
import { YELogo } from '@/components/brand/YELogo';
import { dict } from '@/lib/i18n';
import { PHONE_DISPLAY, WHATSAPP_NUMBER, EMAIL, NELC_LICENSE_NO } from '@/lib/constants';
import { BRAND } from '@/lib/brand';

export function SiteFooter({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];
  const ar = lang === 'ar';
  const p = (path: string) => (ar ? path : `/en${path}`);

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <KiteMark size={44} dark />
              <Wordmark
                lang={lang}
                style={{ fontSize: 26, color: '#fff', ['--wm-fun' as never]: '#FFCA17', ['--wm-ademy' as never]: '#fff' }}
              />
            </div>
            <p className="text-sm mt-2 opacity-80" style={{ maxWidth: '300px' }}>
              {ar ? BRAND.taglineAr : BRAND.taglineEn}
            </p>
            {/* Official e² YE partner logo */}
            <div className="mt-5">
              <YELogo height={30} onDark />
            </div>
          </div>
          <div>
            <h4>{ar ? 'المنصات' : 'Platforms'}</h4>
            <Link href={p('/portal')}>{ar ? 'بوابة الأهالي' : 'Parent portal'}</Link>
            <Link href={p('/book')}>{ar ? 'حجز مقعد' : 'Book a seat'}</Link>
            <Link href={p('/enroll')}>{ar ? 'الاشتراك الشهري' : 'Monthly enrollment'}</Link>
            <Link href={p('/consult')}>{ar ? 'استشارة مجانية' : 'Free consultation'}</Link>
          </div>
          <div>
            <h4>{ar ? 'روابط سريعة' : 'Quick Links'}</h4>
            <Link href={p('/programs')}>{d.navPrograms}</Link>
            <a href="#pricing">{d.navPricing}</a>
            <a href="#faq">FAQ</a>
            <Link href={p('/blog')}>{ar ? 'المدونة' : 'Blog'}</Link>
            <Link href={p('/watanona')}>{ar ? 'حملة وطنّونا' : 'Watanona Campaign'}</Link>
            <Link href={p('/contact')}>{ar ? 'تواصل معنا' : 'Contact us'}</Link>
          </div>
          <div>
            <h4>{ar ? 'تواصل معنا' : 'Contact'}</h4>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`}>WhatsApp: {PHONE_DISPLAY}</a>
            <a href={`mailto:${EMAIL}`}>Email: {EMAIL}</a>
            <h4 style={{ marginTop: 18 }}>{ar ? 'السياسات والامتثال' : 'Policies & Compliance'}</h4>
            <Link href={p('/privacy')}>{ar ? 'سياسة الخصوصية' : 'Privacy policy'}</Link>
            <Link href={p('/terms')}>{ar ? 'الشروط والأحكام' : 'Terms & conditions'}</Link>
            <Link href={p('/nelc')}>
              {ar ? 'الجاهزية للمركز الوطني للتعليم الإلكتروني' : 'NELC readiness'}
            </Link>
          </div>
        </div>
        <div className="fbot">
          <span>{BRAND.creditLine}</span>
          {NELC_LICENSE_NO ? (
            <span>
              {ar ? 'ترخيص المركز الوطني للتعليم الإلكتروني رقم ' : 'NELC license no. '}
              {NELC_LICENSE_NO}
            </span>
          ) : null}
          <span>{BRAND.copyright(new Date().getFullYear())}</span>
          <span>{BRAND.legoDisclaimer}</span>
        </div>
      </div>
    </footer>
  );
}
