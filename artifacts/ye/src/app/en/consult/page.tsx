import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { ConsultFlow } from '@/components/consult/ConsultFlow';
import { consultDict } from '@/app/(ar)/consult/dict';
import '../../(ar)/book/page.css';
import { siteUrl } from '@/lib/site-url';

const _consultBase = siteUrl();
export const metadata = {
  title: 'Book a Consultation | FunAdemy',
  description: 'Book a free Google Meet consultation to help choose the right program for your child.',
  openGraph: {
    type: 'website',
    locale: 'en_SA',
    title: 'Book a Consultation | FunAdemy',
    description: 'Book a free Google Meet consultation to help choose the right program for your child.',
    images: [{ url: `${_consultBase}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@YEYoungEngineers',
    title: 'Book a Consultation | FunAdemy',
    description: 'Book a free Google Meet consultation to help choose the right program for your child.',
    images: [`${_consultBase}/og-default.jpg`],
  },
  alternates: {
    canonical: `${_consultBase}/en/consult`,
    languages: {
      'ar-SA': `${_consultBase}/consult`,
      'en-SA': `${_consultBase}/en/consult`,
      'x-default': `${_consultBase}/consult`,
    },
  },
};

export default function ConsultPageEn() {
  const d = consultDict.en;
  return (
    <>
      <SiteHeader lang="en" />
      <SandStripe />
      <main id="main-content" className="book-pg">
        <div className="bpgrid light"></div>
        <div className="wrap" style={{ position: 'relative', paddingTop: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>{d.kick}</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.desc}</p>
          </div>
          <ConsultFlow lang="en" />
        </div>
      </main>
      <WhatsAppFloat lang="en" />
      <SiteFooter lang="en" />
    </>
  );
}
