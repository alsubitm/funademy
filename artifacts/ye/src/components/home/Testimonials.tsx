import { ScrollReveal } from '@/components/ScrollReveal';

export function Testimonials({ lang }: { lang: 'ar' | 'en' }) {
  // Using static for testimonials & polaroids as it's heavily design-driven in HTML
  return (
    <section className="proof" id="testimonials">
      <div className="wrap proof-in">
        <ScrollReveal className="qs">
          <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>
            TRUSTED BY PARENTS
          </span>
          {lang === 'ar' ? (
            <>
              <h2>ماذا يقول الآباء؟</h2>
              <div className="arsub">شهادات حقيقية من آباء وأمهات في الرياض</div>
            </>
          ) : (
            <>
              <h2>What parents say</h2>
              <div className="arsub">ماذا يقول الآباء؟</div>
            </>
          )}

          <div className="mt-8">
            <div className="q">
              <p>{lang === 'ar' ? 'ابني كان يقضي وقته على الآيباد، الآن ينتظر حصة المهندسين الصغار بفارغ الصبر. يبني النماذج ويشرح لي كيف تعمل.' : 'My son used to spend his time on the iPad, now he eagerly waits for his Young Engineers class. He builds models and explains to me how they work.'}</p>
              <div className="w">
                {lang === 'ar' ? 'أم خالد' : 'Um Khalid'} <span>— {lang === 'ar' ? 'الياسمين' : 'Al Yasmin'}</span>
                <div className="stars">★★★★★</div>
              </div>
            </div>
            <div className="q">
              <p>{lang === 'ar' ? 'فريق رائع ومحترف. التطور الذي رأيته في طريقة تفكير ابنتي وحلها للمشكلات ملحوظ جداً.' : 'A wonderful and professional team. The development I have seen in my daughter\'s thinking and problem solving is very noticeable.'}</p>
              <div className="w">
                {lang === 'ar' ? 'أبو ريما' : 'Abu Rima'} <span>— {lang === 'ar' ? 'النرجس' : 'An Narjis'}</span>
                <div className="stars">★★★★★</div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="polas" dir="ltr">
          <div className="pola po1">
            <div className="tape"></div>
            <div className="ph2">[ PHOTO OF KID BUILDING ]</div>
            <div className="cap2">Bricks Challenge</div>
          </div>
          <div className="pola po2">
            <div className="tape"></div>
            <div className="ph2">[ PHOTO OF LAPTOP ]</div>
            <div className="cap2">AlgoPlay Code</div>
          </div>
          <div className="pola po3">
            <div className="tape"></div>
            <div className="ph2">[ PHOTO OF GROUP ]</div>
            <div className="cap2">Class of 2024</div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
