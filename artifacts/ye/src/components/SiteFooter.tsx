import { KiteMark, Wordmark } from '@/components/brand/FunAdemyMark';
import { YELogo } from '@/components/brand/YELogo';
import { dict } from '@/lib/i18n';
import { PHONE_DISPLAY, WHATSAPP_NUMBER, EMAIL } from '@/lib/constants';

export function SiteFooter({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <footer>
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
              {lang === 'ar' ? 'FunAdemy — حيث تلتقي المتعة بالأكاديمية' : 'FunAdemy — WHERE FUN MEETS ACADEMY'}
            </p>
            {/* Official e² YE partner logo */}
            <div className="mt-5">
              <YELogo height={30} onDark />
            </div>
          </div>
          <div>
            <h4>{lang === 'ar' ? 'تواصل معنا' : 'Contact'}</h4>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`}>WhatsApp: {PHONE_DISPLAY}</a>
            <a href={`mailto:${EMAIL}`}>Email: {EMAIL}</a>
          </div>
          <div>
            <h4>{lang === 'ar' ? 'روابط سريعة' : 'Quick Links'}</h4>
            <a href="#programs">{d.navPrograms}</a>
            <a href="#pricing">{d.navPricing}</a>
            <a href="#faq">FAQ</a>
            <a href="/watanona">Watanona Campaign</a>
          </div>
        </div>
        <div className="fbot">
          <span>FunAdemy · e² Young Engineers · Falcon Eye Ltd — License 4030388340</span>
          <span>© {new Date().getFullYear()} Falcon Eye Ltd. All rights reserved.</span>
          <span>LEGO® is a trademark of the LEGO Group of companies which does not sponsor, authorize or endorse this site.</span>
        </div>
      </div>
    </footer>
  );
}
