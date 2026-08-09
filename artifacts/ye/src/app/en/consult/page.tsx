import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { ConsultFlow } from '@/components/consult/ConsultFlow';
import { consultDict } from '@/app/consult/dict';
import '../../book/page.css';

export const metadata = {
  title: 'Book a Consultation | FunAdemy',
  description: 'Book a free Google Meet consultation to help choose the right program for your child.',
};

export default function ConsultPageEn() {
  const d = consultDict.en;
  return (
    <>
      <SiteHeader lang="en" />
      <SandStripe />
      <main className="book-pg">
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
