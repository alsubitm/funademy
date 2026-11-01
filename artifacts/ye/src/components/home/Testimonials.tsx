import { ScrollReveal } from '@/components/ScrollReveal';
import Image from 'next/image';
import type { Testimonial } from '@prisma/client';

export function Testimonials({ lang, testimonials }: { lang: 'ar' | 'en'; testimonials: Testimonial[] }) {
  return (
    <section className="sec proof" id="testimonials">
      <div className="wrap proof-in">
        <ScrollReveal className="qs">
          <span className="kick" style={{ color: 'var(--blue)', borderColor: 'rgba(28, 84, 203, 0.3)', background: 'rgba(28, 84, 203, 0.08)' }}>
            TRUSTED BY PARENTS
          </span>
          {lang === 'ar' ? (
            <>
              <h2>ماذا يقول الآباء؟</h2>
              <div className="arsub">شهادات حقيقية من آباء وأمهات أطفالنا</div>
            </>
          ) : (
            <>
              <h2>What parents say</h2>
              <div className="arsub">ماذا يقول الآباء؟</div>
            </>
          )}

          <div className="mt-8">
            {testimonials.map((t) => (
              <div className="q" key={t.id}>
                <p>{lang === 'ar' ? t.quoteAr : t.quoteEn}</p>
                <div className="w">
                  {lang === 'ar' ? t.nameAr : t.name} <span>— {t.programEn}</span>
                  <div className="stars">{'★'.repeat(t.stars)}</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal className="polas" dir="ltr">
          <div className="pola po1">
            <div className="tape"></div>
            <div className="ph2" style={{ padding: 0, overflow: 'hidden' }}>
              <Image src="/hero-kids.jpg" alt="Children building LEGO mechanics in a FunAdemy engineering class" fill sizes="(max-width: 640px) 50vw, 33vw" style={{ objectFit: 'cover' }} />
            </div>
            <div className="cap2">Bricks Challenge</div>
          </div>
          <div className="pola po2">
            <div className="tape"></div>
            <div className="ph2" style={{ padding: 0, overflow: 'hidden' }}>
              <Image src="/workshop-coding.jpg" alt="Student coding in AlgoPlay Code workshop — FunAdemy in-person class" fill sizes="(max-width: 640px) 50vw, 33vw" style={{ objectFit: 'cover' }} />
            </div>
            <div className="cap2">AlgoPlay Code</div>
          </div>
          <div className="pola po3">
            <div className="tape"></div>
            <div className="ph2" style={{ padding: 0, overflow: 'hidden' }}>
              <Image src="/group-class.jpg" alt="Group of kids attending e² Young Engineers in-person class 2026" fill sizes="(max-width: 640px) 50vw, 33vw" style={{ objectFit: 'cover' }} />
            </div>
            <div className="cap2">Class of 2026</div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}