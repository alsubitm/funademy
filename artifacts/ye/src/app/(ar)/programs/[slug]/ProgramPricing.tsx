import type { ProgramPricingRun } from '@/lib/program-pricing';
import { arabicDigits, WEEKDAYS_AR, WEEKDAYS_EN } from '@/lib/constants';
import { programDict } from './dict';

export function ProgramPricing({ runs, lang }: {
  runs: ProgramPricingRun[] | null;
  lang: 'ar' | 'en';
}) {
  const d = programDict[lang];
  const isAr = lang === 'ar';
  const digits = (value: string | number) => isAr ? arabicDigits(value) : String(value);
  return (
    <div className="prog-price mb-6">
      {runs?.length ? (
        <>
          <p className="note">{d.pricingPerRun}</p>
          {runs.map(run => (
            <div key={run.id} data-course-run-id={run.id} style={{ marginBlock: 16 }}>
              <div className="note">
                {(isAr ? run.titleAr : run.titleEn) || ''}
                {' · '}{(isAr ? WEEKDAYS_AR : WEEKDAYS_EN)[run.weekday]} {digits(run.time)}
                {' · '}{digits(run.startDate.toISOString().slice(0, 10))}
                {' · '}{run.format === 'online' ? d.online : d.inPerson}
                {run.location ? ` · ${run.location}` : ''}
              </div>
              <div className="amt">
                {digits(run.monthlyPriceSar)} <small>{d.pricingMonthly}</small>
              </div>
            </div>
          ))}
          <div className="note">{d.pricingFamily}</div>
        </>
      ) : (
        <p className="note">{runs === null ? d.pricingContact : d.pricingUnavailable}</p>
      )}
    </div>
  );
}
