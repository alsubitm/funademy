import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { ConsultFlow } from '@/components/consult/ConsultFlow';
import { consultDict } from './dict';
import '../book/page.css';
import { siteUrl } from '@/lib/site-url';

export const metadata = {
  title: 'حجز موعد استشارة | FunAdemy',
  description: 'احجز موعد استشارة مجانية عبر Google Meet لمساعدتك في اختيار البرنامج الأنسب لطفلك.',
  alternates: {
    canonical: `${siteUrl()}/consult`,
    languages: {
      'ar-SA': `${siteUrl()}/consult`,
      'en': `${siteUrl()}/en/consult`,
      'x-default': `${siteUrl()}/consult`,
    },
  },
};

export default function ConsultPage() {
  const d = consultDict.ar;
  return (
    <>
      <SiteHeader lang="ar" />
      <SandStripe />
      <main className="book-pg">
        <div className="bpgrid light"></div>
        <div className="wrap" style={{ position: 'relative', paddingTop: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>{d.kick}</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.desc}</p>
          </div>
          <ConsultFlow lang="ar" />
        </div>
      </main>
      <WhatsAppFloat lang="ar" />
      <SiteFooter lang="ar" />
    </>
  );
}
