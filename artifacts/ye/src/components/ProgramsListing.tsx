import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { CATALOG, FIELDS } from '@/lib/catalog';

type Program = {
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
};

const getIcon = (slug: string) => {
  if (slug.includes('builder')) return '🧱';
  if (slug.includes('smart')) return '🎮';
  if (slug.includes('challenge')) return '⚙️';
  if (slug.includes('robo') || slug.includes('play')) return '🤖';
  if (slug.includes('algo')) return '💻';
  if (slug.includes('galileo')) return '🔭';
  return '⚙️';
};

export function ProgramsListing({
  programs,
  lang,
}: {
  programs: Program[];
  lang: 'ar' | 'en';
}) {
  const ar = lang === 'ar';
  const p = (path: string) => (ar ? path : `/en${path}`);

  // Group by field
  const fieldOrder: Array<'world' | 'mech' | 'code'> = ['world', 'mech', 'code'];
  const groups = fieldOrder
    .map((fid) => ({
      fid,
      field: FIELDS[fid],
      items: programs.filter((prog) => CATALOG[prog.slug]?.field === fid),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <SiteHeader lang={lang} />
      <SandStripe />
      <main>
        <section className="sec bg-white">
          <div className="wrap">
            {/* Page header */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <span className="kick">THE PROGRAMS</span>
              {ar ? (
                <>
                  <h1 style={{ marginTop: 8 }}>برامجنا المعتمدة</h1>
                  <p style={{ color: '#5F6B92', maxWidth: 560, margin: '12px auto 0' }}>
                    ثلاثة مجالات تعليمية · سبعة برامج معتمدة من e² Young Engineers · للأعمار ٤–١٨
                  </p>
                </>
              ) : (
                <>
                  <h1 style={{ marginTop: 8 }}>Our Official Programs</h1>
                  <p style={{ color: '#5F6B92', maxWidth: 560, margin: '12px auto 0' }}>
                    Three educational fields · seven e² Young Engineers certified programs · ages 4–18
                  </p>
                </>
              )}
            </div>

            {groups.map((g) => (
              <div key={g.fid} style={{ marginTop: 48 }}>
                <div
                  className="field-head"
                  style={{ ['--tint' as never]: g.field.tint }}
                >
                  <span className="dot" style={{ background: g.field.tint }}></span>
                  <h2 style={{ margin: 0, fontSize: 22 }}>
                    {ar ? g.field.ar : g.field.en}
                  </h2>
                  <span className="field-sub">{ar ? g.field.en : g.field.ar}</span>
                </div>

                <div className="kits">
                  {g.items.map((prog) => {
                    const meta = CATALOG[prog.slug];
                    return (
                      <div className="kit" key={prog.id}>
                        <div className="studrow">
                          <div className="stud" style={{ background: prog.color }}></div>
                          <div className="stud" style={{ background: prog.color }}></div>
                          <div className="stud" style={{ background: prog.color }}></div>
                        </div>
                        <div className="kh" style={{ background: prog.color }}>
                          <div className="big">{getIcon(prog.slug)}</div>
                          <div className="code">{prog.kitCode}</div>
                        </div>
                        <div className="kb">
                          <h3>{ar ? prog.nameAr : prog.nameEn}</h3>
                          <div className="age">
                            {ar
                              ? `الأعمار ${prog.ageMin}–${prog.ageMax}`
                              : `AGES ${prog.ageMin}–${prog.ageMax}`}
                            {meta
                              ? ar
                                ? ` · ${meta.lessonMin} دقيقة`
                                : ` · ${meta.lessonMin} MIN`
                              : null}
                          </div>
                          <p>{ar ? prog.taglineAr : prog.taglineEn}</p>
                          <div className="row2">
                            <div
                              className="fmt"
                              style={{ background: `${prog.color}20`, color: prog.color }}
                            >
                              {meta
                                ? ar
                                  ? meta.formatAr
                                  : meta.formatEn.toUpperCase()
                                : prog.format}
                            </div>
                            <Link
                              href={p(`/programs/${prog.slug}`)}
                              style={{ fontSize: 14, color: '#1C54CB', fontWeight: 700 }}
                            >
                              {ar ? 'تفاصيل البرنامج' : 'Learn more'}
                            </Link>
                            <Link href={p(`/book?program=${prog.slug}`)}>
                              {ar ? 'احجز تجربة >' : 'Book trial >'}
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Bottom CTA */}
            <div style={{ textAlign: 'center', marginTop: 60, padding: '40px 24px', background: '#F5F8FF', borderRadius: 20 }}>
              <h2 style={{ marginBottom: 12 }}>
                {ar ? 'غير متأكد من البرنامج المناسب؟' : 'Not sure which program fits?'}
              </h2>
              <p style={{ color: '#5F6B92', marginBottom: 24 }}>
                {ar
                  ? 'احجز حصة تجريبية مجانية أو تواصل معنا للحصول على توصية مناسبة لعمر طفلك.'
                  : "Book a free trial class or contact us for a recommendation tailored to your child\u2019s age."}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href={p('/book')} className="btn y">
                  {ar ? 'احجز حصة تجريبية مجانية' : 'Book a free trial class'}
                </Link>
                <Link href={p('/consult')} className="btn b">
                  {ar ? 'استشارة مجانية' : 'Free consultation'}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SandStripe />
      <SiteFooter lang={lang} />
      <WhatsAppFloat lang={lang} />
    </>
  );
}
