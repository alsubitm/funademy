import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { TrackedWaLink } from '@/components/contact/TrackedWaLink';
import { contactDict } from './dict';
import { PHONE_DISPLAY, EMAIL, LICENSE_NO, WHATSAPP_NUMBER } from '@/lib/constants';
import './page.css';

export const metadata = {
  title: 'تواصل معنا | Funademy',
  description: 'تواصل مع فريق المهندس الصغير للإجابة على جميع استفساراتك.',
};

export default function ContactPage() {
  const d = contactDict.ar;

  return (
    <>
      <SiteHeader lang="ar" />
      <SandStripe />
      
      <main className="contact-pg">
        <div className="bpgrid light"></div>
        
        <div className="c-hero">
          <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>CONTACT US</span>
          <h1>{d.title}</h1>
          <p>{d.desc}</p>
        </div>

        <div className="c-grid">
          <div className="c-card primary">
            <div className="icon">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                <path d="M12.031 0C5.385 0 .003 5.383.003 12.03c0 2.124.553 4.195 1.605 6.02L0 24l6.096-1.597c1.765.952 3.753 1.454 5.932 1.454h.005c6.643 0 12.025-5.383 12.025-12.03S18.675 0 12.031 0zm0 21.84c-1.802 0-3.56-.484-5.1-1.4l-.365-.216-3.791.993.993-3.791-.216-.365c-.917-1.54-1.4-3.298-1.4-5.1 0-5.46 4.442-9.902 9.902-9.902s9.902 4.442 9.902 9.902-4.442 9.902-9.902 9.902z" />
                <path d="M17.472 14.37c-.297-.15-1.763-.872-2.036-.971-.274-.1-.472-.15-.67.15-.198.298-.767.971-.94 1.17-.174.198-.348.223-.646.075-.297-.15-1.258-.464-2.395-1.302-.885-.653-1.482-1.46-1.656-1.758-.174-.298-.019-.46.13-.608.134-.134.297-.348.446-.522.15-.174.198-.298.297-.496.1-.198.05-.373-.025-.522-.075-.15-.67-1.614-.917-2.21-.241-.582-.486-.503-.67-.512-.174-.008-.372-.008-.57-.008s-.521.074-.794.373c-.273.298-1.042 1.02-1.042 2.485s1.066 2.882 1.215 3.081c.15.198 2.102 3.208 5.093 4.498.712.308 1.266.492 1.698.63.714.228 1.365.195 1.879.118.576-.086 1.763-.72 2.012-1.416.248-.696.248-1.29.174-1.416-.075-.124-.273-.198-.57-.348z" />
              </svg>
            </div>
            <h3>{d.whatsappCta}</h3>
            <p>أسرع طريقة للتواصل معنا. فريقنا متاح للرد على رسائلك خلال أوقات العمل.</p>
            <TrackedWaLink msg={d.contactWaDefault} className="btn wa">{d.whatsappCta}</TrackedWaLink>
          </div>

          <div className="c-card">
            <div className="icon">📞</div>
            <h3>{d.phoneLabel}</h3>
            <p>يمكنك أيضاً الاتصال بنا مباشرة على رقم الهاتف الموحد.</p>
            <a href={`tel:+${WHATSAPP_NUMBER}`} className="link" dir="ltr">{PHONE_DISPLAY}</a>
          </div>

          <div className="c-card">
            <div className="icon">✉️</div>
            <h3>{d.emailLabel}</h3>
            <p>للمراسلات الرسمية والشراكات، يمكنك مراسلتنا عبر البريد الإلكتروني.</p>
            <a href={`mailto:${EMAIL}`} className="link">{EMAIL}</a>
          </div>
        </div>

        <div className="terr-box wrap">
          <h3>{d.territoryTitle}</h3>
          <p>{d.territoryDesc}</p>
          <div className="terr-tags">
            <span className="terr-tag">الياسمين</span>
            <span className="terr-tag">النرجس</span>
            <span className="terr-tag">الصحافة</span>
            <span className="terr-tag">الندى</span>
            <span className="terr-tag">النفل</span>
            <span className="terr-tag">الفلاح</span>
            <span className="terr-tag">الغدير</span>
            <span className="terr-tag">التعاون</span>
            <span className="terr-tag">حي الملك سلمان</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '30px', borderTop: '1px solid var(--line)', paddingTop: '30px' }}>
            <div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏫</div>
              <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>{d.venueTitle}</h4>
              <p style={{ color: 'var(--mut)', fontSize: '14px', marginTop: '4px' }}>{d.venueDesc}</p>
            </div>
            <div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>💻</div>
              <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>{d.onlineTitle}</h4>
              <p style={{ color: 'var(--mut)', fontSize: '14px', marginTop: '4px' }}>{d.onlineDesc}</p>
            </div>
          </div>
          
          <div className="lic-box">
            {d.licenseTitle} - {d.licenseDesc}<br />
            <span>{d.licenseNo} {LICENSE_NO}</span>
          </div>
        </div>

      </main>

      <SandStripe />
      <SiteFooter lang="ar" />
      <WhatsAppFloat lang="ar" />
    </>
  );
}
