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
              <KiteMark size={44} />
              <Wordmark
                lang={lang}
                style={{ fontSize: 26, color: '#101a38', ['--wm-fun' as never]: '#101a38', ['--wm-ademy' as never]: '#1c54cb' }}
              />
            </div>
            <p className="text-sm mt-2 opacity-80" style={{ maxWidth: '300px' }}>
              {ar ? BRAND.taglineAr : BRAND.taglineEn}
            </p>
            {/* Official e² YE partner logo */}
            <div className="mt-5">
              <YELogo height={30} />
            </div>
          </div>
          <nav aria-labelledby="footer-platforms">
            <h4 id="footer-platforms">{ar ? 'المنصات' : 'Platforms'}</h4>
            <ul>
              <li><Link href={p('/portal')}>{ar ? 'بوابة الأهالي' : 'Parent portal'}</Link></li>
              <li><Link href={p('/book')}>{ar ? 'حجز مقعد' : 'Book a seat'}</Link></li>
              <li><Link href={p('/enroll')}>{ar ? 'الاشتراك الشهري' : 'Monthly enrollment'}</Link></li>
              <li><Link href={p('/consult')}>{ar ? 'استشارة مجانية' : 'Free consultation'}</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-quicklinks">
            <h4 id="footer-quicklinks">{ar ? 'روابط سريعة' : 'Quick Links'}</h4>
            <ul>
              <li><Link href={p('/programs')}>{d.navPrograms}</Link></li>
              <li><a href="#pricing">{d.navPricing}</a></li>
              <li><a href="#faq">FAQ</a></li>
              <li><Link href={p('/blog')}>{ar ? 'المدونة' : 'Blog'}</Link></li>
              <li><Link href={p('/watanona')}>{ar ? 'حملة وطنّونا' : 'Watanona Campaign'}</Link></li>
              <li><Link href={p('/contact')}>{ar ? 'تواصل معنا' : 'Contact us'}</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-contact">
            <h4 id="footer-contact">{ar ? 'تواصل معنا' : 'Contact'}</h4>
            <ul>
              <li><a href={`https://wa.me/${WHATSAPP_NUMBER}`}>WhatsApp: {PHONE_DISPLAY}</a></li>
              <li><a href={`mailto:${EMAIL}`}>Email: {EMAIL}</a></li>
            </ul>
            <h4 style={{ marginTop: 18 }} id="footer-policies">{ar ? 'السياسات والامتثال' : 'Policies & Compliance'}</h4>
            <ul aria-labelledby="footer-policies">
              <li><Link href={p('/privacy')}>{ar ? 'سياسة الخصوصية' : 'Privacy policy'}</Link></li>
              <li><Link href={p('/terms')}>{ar ? 'الشروط والأحكام' : 'Terms & conditions'}</Link></li>
              <li><Link href={p('/nelc')}>
                {ar ? 'الجاهزية للمركز الوطني للتعليم الإلكتروني' : 'NELC readiness'}
              </Link></li>
            </ul>
          </nav>
        </div>
        <div className="v3-footer-big" aria-hidden="true">Fun<span>Ademy</span><b>✳</b></div>
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
