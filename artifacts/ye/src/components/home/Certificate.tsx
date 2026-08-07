import { ScrollReveal } from '@/components/ScrollReveal';
import { CapMark } from '@/components/brand/FunAdemyMark';

/** Certificate mockup — paper #F7EFDD, cap-mode logo seal (Master Spec §3.11). */
export function Certificate({ lang }: { lang: 'ar' | 'en' }) {
  return (
    <section className="cert-sec">
      <div className="wrap split">
        <ScrollReveal>
          <span className="kick">OFFICIAL CERTIFICATES</span>
          {lang === 'ar' ? (
            <>
              <h2>شهادة يفتخر بها طفلك</h2>
              <p className="sub">
                في نهاية كل فصل يتسلّم طفلك شهادة FunAdemy الرسمية بمنهج e² Young Engineers — إنجاز حقيقي يوثّق رحلته الهندسية.
              </p>
            </>
          ) : (
            <>
              <h2>A certificate your child is proud of</h2>
              <p className="sub">
                At the end of every term your child receives the official FunAdemy certificate on the e² Young Engineers curriculum — a real milestone in their engineering journey.
              </p>
            </>
          )}
        </ScrollReveal>

        <ScrollReveal className="cert paper" dir="ltr">
          <div className="ch">FunAdemy</div>
          <h3>CERTIFICATE OF ACHIEVEMENT</h3>
          <p>proudly awarded to</p>
          <div className="nm">{lang === 'ar' ? 'اسم المهندس الصغير' : 'Young Engineer Name'}</div>
          <p>for completing the term with excellence</p>
          <div className="foot2">
            <span>FUNADEMY · e² YOUNG ENGINEERS</span>
            <span>RIYADH</span>
          </div>
          <div className="cert-seal">
            <CapMark size={64} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
