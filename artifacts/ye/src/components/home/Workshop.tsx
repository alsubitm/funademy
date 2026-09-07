import { dict } from '@/lib/i18n';
import { ScrollReveal } from '@/components/ScrollReveal';
import Image from 'next/image';

export function Workshop({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <section className="sec shop" id="workshop">
      <div className="wrap shop-in">
        <ScrollReveal>
          <span className="kick" style={{ color: 'var(--yellow)', borderColor: 'rgba(255,202,23,0.3)', background: 'rgba(255,202,23,0.1)' }}>
            SOFTWARE ENGINEERING · ALGO-C
          </span>
          {lang === 'ar' ? (
            <>
              <h2 style={{ color: '#fff' }}>{d.workshopTitle}</h2>
              <div className="arsub" style={{ color: '#9FC0FF' }}>{d.workshopSub}</div>
            </>
          ) : (
            <>
              <h2 style={{ color: '#fff' }}>{d.workshopTitle}</h2>
              <div className="arsub" style={{ color: '#9FC0FF' }}>لا نستخدم الشاشات للاستهلاك، بل للابتكار. نعلّم لغات البرمجة الحقيقية وهندسة البرمجيات.</div>
            </>
          )}

          <ul style={{ padding: 0 }}>
            <li>
               <div className="fi" style={{ background: 'rgba(34, 218, 255, 0.1)', color: 'var(--cyan)', borderColor: 'rgba(34, 218, 255, 0.2)' }}>01</div>
              {lang === 'ar' ? 'نتجاوز السحب والإفلات (Scratch) إلى البرمجة النصية الحقيقية.' : 'Moving past block-coding (Scratch) into real syntax.'}
            </li>
            <li>
               <div className="fi" style={{ background: 'rgba(255, 202, 23, 0.1)', color: 'var(--yellow)', borderColor: 'rgba(255, 202, 23, 0.2)' }}>02</div>
              {lang === 'ar' ? 'يتعلم الأطفال كتابة الأكواد بلغات تستخدم في العالم الحقيقي مثل C.' : 'Kids learn to write code in real-world languages like C.'}
            </li>
            <li>
               <div className="fi" style={{ background: 'rgba(235, 182, 72, 0.1)', color: 'var(--green)', borderColor: 'rgba(235, 182, 72, 0.2)' }}>03</div>
              {lang === 'ar' ? 'أكوادهم تتحكم في روبوتات ملموسة قاموا ببنائها بأيديهم.' : 'Their code controls physical robots they built with their own hands.'}
            </li>
          </ul>
          <div style={{ marginTop: '32px' }}>
            <a className="btn y" href="#pricing">
              {d.navTrial}
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal className="shop-media">
          <div className="shop-photo">
            <Image src="/workshop-coding.jpg" alt="Child coding robot" fill style={{ objectFit: 'cover' }} />
            <div className="glow"></div>
          </div>
          <div className="term" dir="ltr">
            <div className="bar">
              <i style={{ background: '#FF5F56' }}></i>
              <i style={{ background: '#FFBD2E' }}></i>
              <i style={{ background: '#27C93F' }}></i>
            </div>
            <pre>
              <span className="c1">#include</span> &lt;stdio.h&gt;{'\n'}
              <span className="c1">#include</span> &lt;robotics.h&gt;{'\n'}
              {'\n'}
              <span className="c1">int</span> <span className="c2">main</span>() {'{\n'}
              {'  '}Motor left = init_motor(1);{'\n'}
              {'  '}Motor right = init_motor(2);{'\n'}
              {'  '}Sensor eye = init_sensor(A);{'\n'}
              {'\n'}
              {'  '}<span className="c4">while</span> (true) {'{\n'}
              {'    '}<span className="c4">if</span> (eye.read() &lt; <span className="c3">10</span>) {'{\n'}
              {'      '}turn_right(left, right);{'\n'}
              {'    '}else {'{\n'}
              {'      '}move_forward(left, right);{'\n'}
              {'    }'}{'\n'}
              {'  }'}{'\n'}
              {'  '}<span className="c4">return</span> <span className="c3">0</span>;{'\n'}
              {'}'}<span className="cursor"></span>
            </pre>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}