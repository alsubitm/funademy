import Link from 'next/link';
import { ScrollReveal } from '@/components/ScrollReveal';
import { CountdownChip } from '@/components/home/CountdownChip';

/** وطننا campaign teaser — Sand-Stripe framed banner (Master Spec §3.9). */
export function WatanTeaser({ lang }: { lang: 'ar' | 'en' }) {
  return (
    <section className="sec watan-teaser">
      <div className="wrap">
        <ScrollReveal className="wt-frame">
          <div className="wt-stripe" aria-hidden="true"></div>
          <div className="wt-body">
            <span className="kick">{lang === 'ar' ? 'حملة وطنية' : 'NATIONAL CAMPAIGN'}</span>
            <h2>{lang === 'ar' ? 'أطفالنا يبنون وطننا' : 'Our Kids Build Our Homeland'}</h2>
            <p className="sub">
              {lang === 'ar'
                ? 'مبادرة FunAdemy الوطنية — كل طفل يضع مكعّبه في جدار الوطن، وصولاً إلى معرض «وطن مصغّر».'
                : 'The FunAdemy national initiative — every child places a brick in the homeland wall, all the way to the Mini Watan exhibition.'}
            </p>
            <div className="wt-row">
              <CountdownChip lang={lang} />
              <Link href="/watanona" className="btn y">
                {lang === 'ar' ? 'شارك بمكعّبك' : 'Place your brick'}
              </Link>
            </div>
          </div>
          <div className="wt-stripe" aria-hidden="true"></div>
        </ScrollReveal>
      </div>
    </section>
  );
}
