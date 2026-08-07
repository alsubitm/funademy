import { ScrollReveal } from '@/components/ScrollReveal';
import Link from 'next/link';
import { CATALOG, FIELDS, PATH_ORDER, type FieldId } from '@/lib/catalog';

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

const FIELD_ORDER: FieldId[] = ['world', 'mech', 'code'];

export function Kits({ programs, lang }: { programs: Program[]; lang: 'ar' | 'en' }) {
  const getIcon = (slug: string) => {
    if (slug.includes('builder')) return '🧱';
    if (slug.includes('smart')) return '🎮';
    if (slug.includes('challenge')) return '⚙️';
    if (slug.includes('robo')) return '🦾';
    if (slug.includes('play')) return '🤖';
    if (slug.includes('algoc')) return '💻';
    if (slug.includes('galileo')) return '🔭';
    return '⚙️';
  };

  const bySlug = new Map(programs.map((p) => [p.slug, p]));
  const groups = FIELD_ORDER.map((fid) => ({
    fid,
    field: FIELDS[fid],
    items: PATH_ORDER.map((slug) => bySlug.get(slug)).filter(
      (p): p is Program => !!p && CATALOG[p.slug]?.field === fid,
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="bg-white" id="programs">
      <div className="wrap">
        <ScrollReveal style={{ textAlign: 'center' }}>
          <span className="kick">THE PROGRAMS</span>
          {lang === 'ar' ? (
            <>
              <h2>برامجنا المعتمدة</h2>
              <div className="arsub">ثلاثة مجالات · سبعة برامج · أعمار ٤–١٨</div>
            </>
          ) : (
            <>
              <h2>Our Official Programs</h2>
              <div className="arsub">Three fields · seven programs · ages 4–18</div>
            </>
          )}
        </ScrollReveal>

        {groups.map((g) => (
          <div key={g.fid} style={{ marginTop: '38px' }}>
            <ScrollReveal>
              <div className="field-head" style={{ ['--tint' as never]: g.field.tint }}>
                <span className="dot" style={{ background: g.field.tint }}></span>
                <h3 style={{ margin: 0 }}>{lang === 'ar' ? g.field.ar : g.field.en}</h3>
                <span className="field-sub">{lang === 'ar' ? g.field.en : g.field.ar}</span>
              </div>
            </ScrollReveal>
            <div className="kits">
              {g.items.map((p, i) => {
                const meta = CATALOG[p.slug];
                return (
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
                        {meta ? (lang === 'ar' ? ` · ${meta.lessonMin} دقيقة` : ` · ${meta.lessonMin} MIN`) : null}
                      </div>
                      <p>{lang === 'ar' ? p.taglineAr : p.taglineEn}</p>
                      <div className="row2">
                        <div className="fmt" style={{ background: `${p.color}20`, color: p.color }}>
                          {meta ? (lang === 'ar' ? meta.formatAr : meta.formatEn.toUpperCase()) : p.format}
                        </div>
                        <Link href={`/book?program=${p.slug}`}>
                          {lang === 'ar' ? 'احجز تجربة >' : 'Book trial >'}
                        </Link>
                      </div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
