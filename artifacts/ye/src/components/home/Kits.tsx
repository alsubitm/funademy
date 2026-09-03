'use client';

import { useEffect, useState } from 'react';
import { ScrollReveal } from '@/components/ScrollReveal';
import Link from 'next/link';
import { CATALOG, FIELDS, PATH_ORDER, type FieldId } from '@/lib/catalog';
import { arabicDigits } from '@/lib/constants';
import { getSavedAge, saveAge } from '@/lib/savedAge';
import { Blocks, Gamepad2, Settings, Cpu, Bot, Laptop, Telescope } from 'lucide-react';

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

const AGE_CHOICES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function Kits({ programs, lang }: { programs: Program[]; lang: 'ar' | 'en' }) {
  const [age, setAgeState] = useState<number | null>(null);

  useEffect(() => {
    setAgeState(getSavedAge());
  }, []);

  const setAge = (a: number | null) => {
    setAgeState(a);
    saveAge(a);
  };

  const getIcon = (slug: string) => {
    if (slug.includes('builder')) return <Blocks size={48} className="drop-shadow-lg" />;
    if (slug.includes('smart')) return <Gamepad2 size={48} className="drop-shadow-lg" />;
    if (slug.includes('challenge')) return <Settings size={48} className="drop-shadow-lg" />;
    if (slug.includes('robo')) return <Cpu size={48} className="drop-shadow-lg" />;
    if (slug.includes('play')) return <Bot size={48} className="drop-shadow-lg" />;
    if (slug.includes('algoc')) return <Laptop size={48} className="drop-shadow-lg" />;
    if (slug.includes('galileo')) return <Telescope size={48} className="drop-shadow-lg" />;
    return <Settings size={48} className="drop-shadow-lg" />;
  };

  const fitsAge = (p: Program) => age === null || (age >= p.ageMin && age <= p.ageMax);
  const bySlug = new Map(programs.map((p) => [p.slug, p]));
  const groups = FIELD_ORDER.map((fid) => ({
    fid,
    field: FIELDS[fid],
    items: PATH_ORDER.map((slug) => bySlug.get(slug)).filter(
      (p): p is Program => !!p && CATALOG[p.slug]?.field === fid && fitsAge(p),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="sec bg-transparent" id="programs">
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

        {/* Age filter — "How old is your child?" */}
        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12, color: 'var(--ink)' }}>
            {lang === 'ar' ? 'كم عمر طفلك؟' : 'How old is your child?'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '640px', margin: '0 auto' }}>
            <button
              type="button"
              onClick={() => setAge(null)}
              style={{
                padding: '8px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                border: '1px solid ' + (age === null ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'),
                background: age === null ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.02)',
                color: age === null ? 'var(--cyan)' : 'var(--mut)',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
              }}
            >
              {lang === 'ar' ? 'كل الأعمار' : 'All ages'}
            </button>
            {AGE_CHOICES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAge(a)}
                aria-pressed={age === a}
                style={{
                  width: 40, height: 40, fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  border: '1px solid ' + (age === a ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'),
                  background: age === a ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.02)',
                  color: age === a ? 'var(--cyan)' : 'var(--mut)',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'
                }}
              >
                {lang === 'ar' ? arabicDigits(a) : a}
              </button>
            ))}
          </div>
          {age !== null && (
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>
              {lang === 'ar'
                ? `البرامج المناسبة لعمر ${arabicDigits(age)} سنوات`
                : `Programs suitable for age ${age}`}
            </div>
          )}
        </div>

        {age !== null && groups.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 30, padding: 30, border: '1px dashed rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}>
            {lang === 'ar' ? 'لا يوجد برنامج مطابق لهذا العمر حالياً — تواصل معنا لنرشح الأنسب.' : 'No matching program for this age yet — contact us for a recommendation.'}
          </div>
        )}

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
                        <Link
                          href={lang === 'ar' ? `/programs/${p.slug}` : `/en/programs/${p.slug}`}
                          style={{ fontSize: 13, color: 'var(--cyan)', fontWeight: 700 }}
                        >
                          {lang === 'ar' ? 'تفاصيل البرنامج' : 'Learn more'}
                        </Link>
                        <Link href={`${lang === 'ar' ? '' : '/en'}/book?program=${p.slug}${age !== null ? `&age=${age}` : ''}`}>
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
