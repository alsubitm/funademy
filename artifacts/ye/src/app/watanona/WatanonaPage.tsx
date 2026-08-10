import { getBrickCount } from '@/lib/bricks';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { ClientBricks } from './ClientBricks';
import { WatanScrolly } from './WatanScrolly';
import { Countdown } from './Countdown';
import { watanonaDict } from './dictionary';
import { waLink } from '@/lib/constants';
import Link from 'next/link';

import './page.css';

export async function WatanonaPage({ lang }: { lang: 'ar' | 'en' }) {
  const d = watanonaDict[lang];
  const initialCount = await getBrickCount();

  return (
    <>
      <SiteHeader lang={lang} />
      
      {/* Hero */}
      <section className="sec watanona-hero">
        <div className="bpgrid"></div>
        <div className="wrap relative z-10">
          <span className="kick" style={{ color: 'var(--color-sand-1)', borderColor: 'var(--color-sand-1)' }}>
            {d.heroKick}
          </span>
          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            fontWeight: 800, 
            fontSize: 'clamp(40px, 6vw, 72px)', 
            lineHeight: 1.1,
            marginBottom: '20px'
          }}>
            {d.heroTitle}
          </h1>
          <p style={{ fontSize: '20px', maxWidth: '700px', margin: '0 auto', color: '#D6E0FF' }}>
            {d.heroLead}
          </p>
          <Countdown lang={lang} />
          <div style={{ marginTop: '40px' }}>
             <a href="#wall" className="btn y">{d.wallPlaceBtn}</a>
          </div>
        </div>
      </section>

      <SandStripe />

      {/* Scrollytelling journey: بيتي → حيّي → مدينتي → وطننا */}
      <WatanScrolly lang={lang} />

      {/* Interactive Bricks */}
      <ClientBricks initialCount={initialCount} lang={lang} />

      {/* Campaign Journey */}
      <section className="sec journey-sec">
        <div className="wrap">
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--color-bp)', borderColor: 'var(--color-bp)' }}>
              {d.journeyKick}
            </span>
            <h2>{d.journeyTitle}</h2>
          </div>
          <div className="journey-grid">
            {d.jSteps.map((s, i) => (
              <div key={i} className="j-step">
                <div className="num">{lang === 'ar' ? ['١','٢','٣','٤'][i] : i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Exhibition Info */}
      <section className="sec exhib-sec">
        <div className="wrap">
          <span className="kick" style={{ color: 'var(--color-sand-4)', borderColor: 'var(--color-sand-4)' }}>
            {d.exhibKick}
          </span>
          <div className="exhib-card">
            <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>{d.exhibTitle}</h2>
            <p style={{ color: 'var(--color-mut)' }}>{d.exhibDesc}</p>
            <a 
              href={waLink(lang === 'ar' ? 'أريد حجز تذكرة لمعرض وطننا الصغير' : 'I want to book a ticket for Mini Watan exhibition')} 
              className="btn y" 
              style={{ marginTop: '16px' }}
            >
              {d.exhibBtn}
            </a>
          </div>
        </div>
      </section>

      {/* Sponsors */}
      <section className="sec sponsors-sec">
        <div className="bpgrid light" style={{ opacity: 0.2 }}></div>
        <div className="wrap relative z-10">
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--color-sand-2)', borderColor: 'var(--color-sand-2)' }}>
              {d.sponsorsKick}
            </span>
            <h2>{d.sponsorsTitle}</h2>
            <p style={{ color: '#9FC0FF', marginTop: '10px' }}>{d.sponsorsSub}</p>
          </div>
          
          <div className="sponsor-tiers">
            {/* Silver */}
            <div className="stier silver">
              <h3 style={{ color: 'var(--color-mut)' }}>{d.tiers.silver.name}</h3>
              <p style={{ fontSize: '14px', margin: '20px 0', minHeight: '60px' }}>{d.tiers.silver.desc}</p>
              <a 
                href={waLink(lang === 'ar' ? 'الاستفسار عن الرعاية الفضية' : 'Inquire about Silver Sponsorship')} 
                className="btn ghost" 
                style={{ color: 'var(--color-mut)', borderColor: 'var(--color-line)' }}
              >
                {d.sponsorBtn}
              </a>
            </div>
            {/* Diamond */}
            <div className="stier diamond" style={{ background: 'var(--color-ink)', color: '#fff', border: 'none' }}>
              <div className="vip-badge">VIP</div>
              <h3 style={{ color: 'var(--color-cyan)' }}>{d.tiers.diamond.name}</h3>
              <p style={{ fontSize: '14px', margin: '20px 0', minHeight: '60px', color: '#D6E0FF' }}>{d.tiers.diamond.desc}</p>
              <a 
                href={waLink(lang === 'ar' ? 'الاستفسار عن الرعاية الماسية' : 'Inquire about Diamond Sponsorship')} 
                className="btn b" 
                style={{ background: 'var(--color-cyan)', color: 'var(--color-ink)', boxShadow: '0 6px 0 #1A8CB0' }}
              >
                {d.sponsorBtn}
              </a>
            </div>
            {/* Gold */}
            <div className="stier gold">
              <h3 style={{ color: 'var(--color-gold)' }}>{d.tiers.gold.name}</h3>
              <p style={{ fontSize: '14px', margin: '20px 0', minHeight: '60px' }}>{d.tiers.gold.desc}</p>
              <a 
                href={waLink(lang === 'ar' ? 'الاستفسار عن الرعاية الذهبية' : 'Inquire about Gold Sponsorship')} 
                className="btn y"
              >
                {d.sponsorBtn}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ textAlign: 'center' }}>
        <div className="wrap">
          <h2 style={{ marginBottom: '30px', color: 'var(--color-bp)' }}>{d.enrollTitle}</h2>
          <Link href="/book" className="btn b" style={{ fontSize: '20px', padding: '20px 40px' }}>
            {d.enrollBtn}
          </Link>
        </div>
      </section>

      <SandStripe />
      <SiteFooter lang={lang} />
      <WhatsAppFloat lang={lang} />
    </>
  );
}
