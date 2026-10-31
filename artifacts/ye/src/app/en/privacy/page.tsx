import { LegalShell } from '@/components/legal/LegalShell';
import { EMAIL, PHONE_DISPLAY, WHATSAPP_NUMBER } from '@/lib/constants';
import { siteUrl } from '@/lib/site-url';

const _privacyBase = siteUrl();
export const metadata = {
  title: 'Privacy Policy | FunAdemy',
  description:
    'Learn how FunAdemy collects, protects and uses family and child data in line with the Saudi Personal Data Protection Law (PDPL).',
  openGraph: {
    type: 'website',
    locale: 'en_SA',
    title: 'Privacy Policy | FunAdemy',
    description: 'How FunAdemy collects, protects and uses family and child data.',
    images: [{ url: `${_privacyBase}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@funademy',
    title: 'Privacy Policy | FunAdemy',
    description: 'How FunAdemy collects, protects and uses family and child data.',
    images: [`${_privacyBase}/og-default.jpg`],
  },
  alternates: {
    canonical: `${_privacyBase}/en/privacy`,
    languages: {
      'ar-SA': `${_privacyBase}/privacy`,
      'en-SA': `${_privacyBase}/en/privacy`,
      'x-default': `${_privacyBase}/privacy`,
    },
  },
};

export default function PrivacyPageEn() {
  return (
    <LegalShell
      lang="en"
      kick="PRIVACY POLICY"
      title="Privacy Policy"
      intro="Your family's privacy matters to us. This policy explains what we collect, why, and how we protect it."
      updated="Last updated: August 2026"
    >
      <h2>What we collect</h2>
      <ul>
        <li><strong>Parent data:</strong> name, mobile number (for OTP login) and email if you provide it.</li>
        <li><strong>Child data:</strong> name and age group to pick the right program, plus learning progress (completed lessons, XP, badges).</li>
        <li><strong>Booking & payment data:</strong> booked courses, subscriptions and invoices. Payments are processed by licensed providers (Moyasar and Tamara) — <strong>we never store card numbers</strong>.</li>
        <li><strong>Technical data:</strong> essential cookies for secure login sessions only — no advertising cookies.</li>
        <li><strong>Assistant chats:</strong> if you consent to using the assistant, we process your message text and store chat history to answer and follow up on your request. Do not send card numbers or sensitive payment details in chat.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>Managing bookings, subscriptions, attendance and make-up sessions.</li>
        <li>Showing your children's learning progress in the parent portal and learning platform.</li>
        <li>Contacting you about class times, reminders and renewals.</li>
        <li>Creating Google Calendar invites for consultations you book.</li>
        <li>Answering questions through the assistant, and carrying out an action only after showing a clear confirmation card and receiving your confirmation.</li>
      </ul>

      <h2>Children's data protection</h2>
      <p>
        The kids learning platform is designed so children never enter personal contact details. Kids sign in
        with a PIN created and managed by the parent from the parent portal. Child data is never shown to other
        users and children are never shown ads.
      </p>

      <h2>Sharing</h2>
      <p>
        We do not sell your data or share it with marketers. We share only the minimum needed with operational
        providers: licensed payment gateways (Moyasar, Tamara) and the calendar service for consultations. We may
        disclose data where Saudi law requires it.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the Saudi Personal Data Protection Law (PDPL) you may request access to, correction of, or deletion
        of your data. Contact us and we will respond within a reasonable time.
      </p>

      <div className="card-note">
        <strong>Privacy contact:</strong>
        <br />
        WhatsApp: <a href={`https://wa.me/${WHATSAPP_NUMBER}`} dir="ltr">{PHONE_DISPLAY}</a> · Email:{' '}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </div>
    </LegalShell>
  );
}
