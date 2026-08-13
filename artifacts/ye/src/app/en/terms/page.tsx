import { LegalShell } from '@/components/legal/LegalShell';
import { EMAIL, PHONE_DISPLAY, WHATSAPP_NUMBER } from '@/lib/constants';
import { siteUrl } from '@/lib/site-url';

export const metadata = {
  title: 'Terms & Conditions | FunAdemy',
  description: 'FunAdemy terms of use, payment, refund and support policies.',
  alternates: {
    canonical: `${siteUrl()}/en/terms`,
    languages: {
      'ar-SA': `${siteUrl()}/terms`,
      'en': `${siteUrl()}/en/terms`,
      'x-default': `${siteUrl()}/terms`,
    },
  },
};

export default function TermsPageEn() {
  return (
    <LegalShell
      lang="en"
      kick="TERMS & CONDITIONS"
      title="Terms & Conditions"
      intro="By using the FunAdemy website and services you agree to the following terms."
      updated="Last updated: August 2026"
    >
      <h2>About the service</h2>
      <p>
        FunAdemy is a Saudi platform teaching kids engineering, coding and robotics (official partner of
        e² Young Engineers). We offer in-person classes in Riyadh and live online classes, plus an interactive
        learning platform for enrolled kids and a parent portal.
      </p>

      <h2>Accounts & login</h2>
      <ul>
        <li>Parents sign in with their mobile number and a one-time code (OTP) — no stored passwords.</li>
        <li>Parents are responsible for keeping their children's learning PIN confidential.</li>
        <li>The kids learning platform is available to families with an active enrollment.</li>
      </ul>

      <h2>Booking & payment</h2>
      <ul>
        <li>Prices are in Saudi Riyal and include applicable taxes unless stated otherwise.</li>
        <li>Payments are processed by licensed providers: Moyasar (mada/cards/Apple Pay) and Tamara (buy-now-pay-later).</li>
        <li>A seat is confirmed once payment completes successfully and you receive a confirmation.</li>
      </ul>

      <h2>Refunds & cancellation</h2>
      <ul>
        <li>Before the program starts: cancel for a full refund.</li>
        <li>After the program starts: the value of delivered classes is deducted and the remainder refunded.</li>
        <li>If a class is missed, make-up sessions are available per the policy shown in the parent portal.</li>
        <li>Refund requests go through WhatsApp or email and are processed within 5–10 business days to the original payment method.</li>
      </ul>

      <h2>Intellectual property</h2>
      <p>
        All educational content, curricula and materials on the platform are owned by or licensed to FunAdemy and
        may not be copied or redistributed without written permission. LEGO® is a trademark of the LEGO Group,
        which does not sponsor or endorse this site.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Users must not misuse the platform, attempt unauthorized access to other accounts, or disrupt the service.
        We reserve the right to suspend violating accounts.
      </p>

      <h2>Support & complaints</h2>
      <p>
        Support is available via WhatsApp <a href={`https://wa.me/${WHATSAPP_NUMBER}`} dir="ltr">{PHONE_DISPLAY}</a>{' '}
        and email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> on business days; we aim to reply within 24–48 hours.
      </p>

      <h2>General</h2>
      <ul>
        <li>We may update these terms from time to time; updates apply from the date published on this page.</li>
        <li>These terms are governed by the laws of the Kingdom of Saudi Arabia.</li>
      </ul>
    </LegalShell>
  );
}
