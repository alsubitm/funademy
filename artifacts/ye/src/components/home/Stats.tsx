import { ScrollReveal } from '@/components/ScrollReveal';

export function Stats({ lang }: { lang: 'ar' | 'en' }) {
  return (
    <div className="stats">
      <ScrollReveal className="wrap">
        <div>
          <div className="n">6</div>
          <div className="l">{lang === 'ar' ? 'برامج معتمدة' : 'Official programs'}</div>
        </div>
        <div>
          <div className="n">4–18</div>
          <div className="l">{lang === 'ar' ? 'سنوات العمر' : 'Ages covered'}</div>
        </div>
        <div>
          <div className="n">750<small>K</small></div>
          <div className="l">{lang === 'ar' ? 'نطاق التغطية (الرياض)' : 'Residents in territory'}</div>
        </div>
        <div>
          <div className="n">8–12</div>
          <div className="l">{lang === 'ar' ? 'طفل لكل مجموعة' : 'Kids per group'}</div>
        </div>
        <div>
          <div className="n">1<small>{lang === 'ar' ? 'st' : 'st'}</small></div>
          <div className="l">{lang === 'ar' ? 'الحصة الأولى مجانية دائماً' : 'Class always free'}</div>
        </div>
      </ScrollReveal>
    </div>
  );
}
