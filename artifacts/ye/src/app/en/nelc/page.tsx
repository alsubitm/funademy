import { LegalShell } from '@/components/legal/LegalShell';
import { EMAIL, PHONE_DISPLAY, WHATSAPP_NUMBER, NELC_LICENSE_NO } from '@/lib/constants';
import { siteUrl } from '@/lib/site-url';

// Dynamically rendered so the env var NELC_LICENSE_NO is not statically baked
// in at build time. In practice, license number changes require a new
// deployment (which Replit triggers automatically when a secret is added or
// updated) — no code change is needed.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'NELC Readiness | FunAdemy',
  description:
    'FunAdemy readiness for licensing and integration with the Saudi National eLearning Center (NELC) and the FutureX national platform.',
  alternates: {
    canonical: `${siteUrl()}/en/nelc`,
    languages: {
      'ar-SA': `${siteUrl()}/nelc`,
      'en': `${siteUrl()}/en/nelc`,
      'x-default': `${siteUrl()}/nelc`,
    },
  },
};

export default function NelcPageEn() {
  return (
    <LegalShell
      lang="en"
      kick="NELC READINESS"
      title="National eLearning Center Readiness"
      intro="We are working to meet the e-training licensing requirements and integrate with the national platform. This page shows our status transparently."
      updated="Last updated: August 2026"
    >
      <h2>What is NELC?</h2>
      <p>
        The National eLearning Center (NELC) is the regulator of e-learning and e-training in Saudi Arabia.
        Together with TVTC it issues a unified license for e-training platforms, and licensed platforms can
        technically integrate with the national e-learning platform (FutureX) to publish their programs
        kingdom-wide.
      </p>

      <h2>License status</h2>
      <div className="card-note">
        {NELC_LICENSE_NO ? (
          <>
            <strong>Licensed ✅</strong> — NELC license no.: <span dir="ltr">{NELC_LICENSE_NO}</span>
          </>
        ) : (
          <>
            <strong>In preparation 🟡</strong> — the core requirements below are in place and we are preparing
            the unified license application. The license number will appear here and in the site footer once issued.
          </>
        )}
      </div>

      <h2>Readiness requirements we meet</h2>
      <ul className="nelc-check">
        <li>Clear Saudi commercial identity with the CR number published on the site.</li>
        <li>Published privacy policy aligned with the Saudi PDPL, with special protection for children's data.</li>
        <li>Published terms including payment, refund and support/complaints policies.</li>
        <li>Online payments via licensed Saudi providers (Moyasar, Tamara) with no card data stored.</li>
        <li>Secure OTP login and HTTPS-encrypted sessions.</li>
        <li>Original Arabic educational content with a global methodology (e² Young Engineers partnership).</li>
        <li>Learner progress tracking: attendance, completed lessons, XP/badges and parent reports.</li>
        <li>Program completion certificates and published support channels with response targets.</li>
      </ul>

      <h2>Next steps toward integration</h2>
      <ol className="nelc-steps">
        <li>Apply for the unified e-training platform license via the NELC portal.</li>
        <li>Complete any technical or administrative requirements from the licensing team.</li>
        <li>Once licensed: apply for technical integration with the FutureX national platform.</li>
        <li>Enable exchange of program, enrollment and certificate data per the national e-learning standards.</li>
      </ol>

      <h2>For institutions & partners</h2>
      <p>
        NELC team or partners can reach us officially at <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or WhatsApp{' '}
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`} dir="ltr">{PHONE_DISPLAY}</a>.
      </p>
    </LegalShell>
  );
}
