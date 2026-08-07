import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { waLink, WEEKDAYS_AR, WEEKDAYS_EN, arabicDigits } from '@/lib/constants';
import { programDict } from './dict';
import Link from 'next/link';
import './page.css';
import { Program, ScheduleSlot } from '@prisma/client';

type ProgWithSlots = Program & { slots: ScheduleSlot[] };

export function ProgramDetail({
  program,
  prevProg,
  nextProg,
  lang
}: {
  program: ProgWithSlots;
  prevProg: Program | null;
  nextProg: Program | null;
  lang: 'ar' | 'en';
}) {
  const d = programDict[lang];
  const isAr = lang === 'ar';
  
  const getIcon = (slug: string) => {
    if (slug.includes('builder')) return '🧱';
    if (slug.includes('smart')) return '🎮';
    if (slug.includes('challenge')) return '⚙️';
    if (slug.includes('robo') || slug.includes('play')) return '🤖';
    if (slug.includes('algo')) return '💻';
    if (slug.includes('galileo')) return '🔭';
    return '⚙️';
  };

  const name = isAr ? program.nameAr : program.nameEn;
  const tagline = isAr ? program.taglineAr : program.taglineEn;
  const desc = isAr ? program.descAr : program.descEn;
  const builds = isAr ? program.buildsAr : program.buildsEn;
  const terms = isAr ? program.termsAr : program.termsEn;
  const weekdays = isAr ? WEEKDAYS_AR : WEEKDAYS_EN;

  const waMessage = isAr 
    ? `مرحباً! أريد الاستفسار عن برنامج ${name}.` 
    : `Hello! I'd like to ask about the ${name} program.`;

  return (
    <>
      <SiteHeader lang={lang} />
      
      <header className="prog-hero" style={{ '--kit-color': program.color } as React.CSSProperties}>
        <div className="bpgrid"></div>
        <div className="wrap prog-hero-in">
          <div>
            <div className="lic">LICENSE № 4030388340 · OFFICIAL PROGRAM</div>
            <h1>{name}</h1>
            <p className="lead">{tagline}</p>
            
            <div className="prog-meta">
              <span className="pm-badge"><i>{d.ages}</i> {isAr ? arabicDigits(program.ageMin) : program.ageMin}–{isAr ? arabicDigits(program.ageMax) : program.ageMax}</span>
              <span className="pm-badge">
                <i>{d.level}</i> 
                <span className="meter">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <span key={lvl} style={{ 
                      background: lvl <= program.level ? 'var(--yellow)' : 'rgba(255,255,255,0.2)'
                    }}></span>
                  ))}
                </span>
              </span>
              <span className="pm-badge"><i>{d.format}</i> {program.format === 'online' ? d.online : d.inPerson}</span>
            </div>

            <div className="hcta">
              <Link href={lang === 'ar' ? `/book?program=${program.slug}` : `/en/book?program=${program.slug}`} className="btn y">
                {d.bookTrial}
              </Link>
            </div>
          </div>

          <div className="prog-spec">
            <div className="corner c1" style={{borderColor: program.color}}></div>
            <div className="corner c2" style={{borderColor: program.color}}></div>
            <div className="corner c3" style={{borderColor: program.color}}></div>
            <div className="corner c4" style={{borderColor: program.color}}></div>
            <div className="head" style={{color: program.color, borderColor: `${program.color}55`}}>
              <span>KIT: {program.kitCode}</span>
              <span>SCALE 1:1</span>
            </div>
            <div className="kit-render">
              <div className="icon">{getIcon(program.slug)}</div>
            </div>
            <svg className="stamp" viewBox="0 0 120 120">
              <defs><path id="circ" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs>
              <circle cx="60" cy="60" r="56" fill={program.color}/>
              <circle cx="60" cy="60" r="56" fill="none" stroke="var(--ink)" strokeWidth="3"/>
              <circle cx="60" cy="60" r="34" fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3"/>
              <text fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="600" fill="var(--ink)" letterSpacing="2"><textPath href="#circ">OFFICIAL LICENSEE • YE RIYADH • </textPath></text>
              <text x="60" y="66" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="22" fill="var(--ink)">✓</text>
            </svg>
          </div>
        </div>
      </header>

      <div className="bricks">
        <i style={{background: '#F7E3B2'}}></i>
        <i style={{background: '#F2CD7E'}}></i>
        <i style={{background: '#E5AE4A'}}></i>
        <i style={{background: '#C98A1E'}}></i>
        <i style={{background: '#F7E3B2'}}></i>
        <i style={{background: '#F2CD7E'}}></i>
        <i style={{background: '#E5AE4A'}}></i>
        <i style={{background: '#C98A1E'}}></i>
      </div>

      <section className="prog-body">
        <div className="wrap prog-grid">
          
          <div className="prog-main">
            <div className="prog-content mb-8">
              <h3>{d.descTitle}</h3>
              <p className="prog-desc">{desc}</p>
            </div>

            {builds && builds.length > 0 && (
              <div className="prog-content mb-8">
                <h3>{d.whatTheyBuild}</h3>
                <ul className="checklist">
                  {builds.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}

            {terms && terms.length > 0 && (
              <div className="prog-content">
                <h3>{d.termStructure}</h3>
                <ul className="checklist">
                  {terms.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="prog-sidebar">
            <div className="prog-book">
              <h4>{d.pricingTitle}</h4>
              <div className="prog-price mb-6">
                <div className="amt">
                  {program.format === 'online' ? d.pricingOnline : d.pricingInPerson}
                  <small className="block" style={{marginTop: '-4px'}}>{isAr ? '/ شهرياً' : '/ mo'}</small>
                </div>
                <div className="note">{d.pricingFamily}</div>
              </div>
              
              <Link href={lang === 'ar' ? `/book?program=${program.slug}` : `/en/book?program=${program.slug}`} className="btn y" style={{width: '100%', justifyContent: 'center', boxShadow: 'none'}}>
                {d.bookTrial}
              </Link>
              <a href={waLink(waMessage)} className="btn-ghost-dark mt-3">
                {d.whatsappQA}
              </a>
            </div>

            <div className="prog-slots">
              <h4>{d.scheduleTitle}</h4>
              {program.slots.length === 0 ? (
                <div className="text-center text-sm opacity-60 py-4" style={{fontFamily: 'var(--font-mono)'}}>
                  {isAr ? 'لا توجد مواعيد متاحة حالياً.' : 'No slots currently available.'}
                </div>
              ) : (
                <div className="sched-list">
                  {program.slots.map(slot => {
                    const isFull = slot.seatsLeft <= 0;
                    return (
                      <div key={slot.id} className={`sched-item ${isFull ? 'full' : ''}`}>
                        <div>
                          <div className="sched-time">{weekdays[slot.weekday]} — {isAr ? arabicDigits(slot.time) : slot.time}</div>
                          {slot.location && <div className="sched-loc">{slot.location}</div>}
                        </div>
                        <div className={`sched-seats ${isFull ? 'full' : ''}`}>
                          {isFull ? d.fullWaitlist : `${isAr ? arabicDigits(slot.seatsLeft) : slot.seatsLeft} ${d.seatsLeft}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="wrap">
          <div className="prog-nav">
            {prevProg ? (
              <Link href={lang === 'ar' ? `/programs/${prevProg.slug}` : `/en/programs/${prevProg.slug}`} className="p-nav-link" style={{marginInlineEnd: 'auto'}}>
                <div className="icon">{getIcon(prevProg.slug)}</div>
                <div>
                  <div className="lbl">{d.prevProgram}</div>
                  <div className="nm">{isAr ? prevProg.nameAr : prevProg.nameEn}</div>
                </div>
              </Link>
            ) : <div />}
            
            {nextProg ? (
              <Link href={lang === 'ar' ? `/programs/${nextProg.slug}` : `/en/programs/${nextProg.slug}`} className="p-nav-link" style={{flexDirection: 'row-reverse', textAlign: isAr ? 'left' : 'right', marginInlineStart: 'auto'}}>
                <div className="icon">{getIcon(nextProg.slug)}</div>
                <div>
                  <div className="lbl">{d.nextProgram}</div>
                  <div className="nm">{isAr ? nextProg.nameAr : nextProg.nameEn}</div>
                </div>
              </Link>
            ) : <div />}
          </div>
        </div>

      </section>

      <SandStripe />
      <SiteFooter lang={lang} />
      <WhatsAppFloat lang={lang} />
    </>
  );
}