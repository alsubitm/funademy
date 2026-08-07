import { ScrollReveal } from '@/components/ScrollReveal';

export function Stats({ lang }: { lang: 'ar' | 'en' }) {
  return (
    <div className="stats">
      <ScrollReveal className="wrap">
        <div>
          <div className="n">7</div>
          <div className="l">{lang === 'ar' ? 'برامج معتمدة' : 'Official programs'}</div>
        </div>
        <div>
          <div className="n">4–18</div>
          <div className="l">{lang === 'ar' ? 'سنوات العمر' : 'Ages covered'}</div>
        </div>
        <div>
          <div className="n">8–16</div>
          <div className="l">{lang === 'ar' ? 'مجموعات صغيرة' : 'Small groups'}</div>
        </div>
        <div>
          <div className="n">1<small>st</small></div>
          <div className="l">{lang === 'ar' ? 'الحصة الأولى مجانية دائماً' : 'First class always free'}</div>
        </div>
      </ScrollReveal>
    </div>
  );
}
