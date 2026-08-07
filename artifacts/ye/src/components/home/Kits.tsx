import { ScrollReveal } from '@/components/ScrollReveal';
import Link from 'next/link';

interface Program {
  id: number;
  slug: string;
  kitCode: string;
  nameEn: string;
  nameAr: string;
  ageMin: number;
  ageMax: number;
  format: string;
  color: string;
  level: number;
  taglineEn: string;
  taglineAr: string;
}

export function Kits({ programs, lang }: { programs: Program[]; lang: 'ar' | 'en' }) {
  const getIcon = (slug: string) => {
    if (slug.includes('builder')) return '🧱';
    if (slug.includes('smart')) return '🎮';
    if (slug.includes('challenge')) return '⚙️';
    if (slug.includes('robo') || slug.includes('play')) return '🤖';
    if (slug.includes('algo')) return '💻';
    if (slug.includes('galileo')) return '🔭';
    return '⚙️';
  };

  return (
    <section className="bg-white" id="programs">
      <div className="wrap">
        <ScrollReveal style={{ textAlign: 'center' }}>
          <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>THE KITS</span>
          {lang === 'ar' ? (
            <>
              <h2>برامجنا المعتمدة</h2>
              <div className="arsub">صُممت بعناية لتناسب كل مرحلة عمرية</div>
            </>
          ) : (
            <>
              <h2>Our Official Programs</h2>
              <div className="arsub">برامجنا المعتمدة</div>
            </>
          )}
        </ScrollReveal>

        <div className="kits">
          {programs.map((p, i) => (
            <ScrollReveal className="kit" key={p.id} style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="studrow">
                <div className="stud" style={{ background: p.color }}></div>
                <div className="stud" style={{ background: p.color }}></div>
                <div className="stud" style={{ background: p.color }}></div>
              </div>
              <div className="kh" style={{ background: p.color }}>
                <div className="big">{getIcon(p.slug)}</div>
                <div className="code">{p.kitCode}</div>
              </div>
              <div className="kb">
                <h3>{lang === 'ar' ? p.nameAr : p.nameEn}</h3>
                <div className="age">
                  {lang === 'ar' ? `الأعمار ${p.ageMin}–${p.ageMax}` : `AGES ${p.ageMin}–${p.ageMax}`}
                </div>
                <p>{lang === 'ar' ? p.taglineAr : p.taglineEn}</p>
                <div className="meter">
                  <span className="lbl">{lang === 'ar' ? 'المستوى' : 'LEVEL'}</span>
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <i key={lvl} style={{ background: lvl <= p.level ? p.color : '' }}></i>
                  ))}
                </div>
                <div className="row2">
                  <div className="fmt" style={{ background: `${p.color}20`, color: p.color }}>
                    {p.format === 'online'
                      ? lang === 'ar' ? 'أونلاين' : 'ONLINE'
                      : lang === 'ar' ? 'حضوري' : 'IN-PERSON'}
                  </div>
                  <Link href={`/book?program=${p.slug}`}>
                    {lang === 'ar' ? 'احجز حصة >' : 'Book trial >'}
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
