export const revalidate = 300;
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  return {
    title: { absolute: 'FunAdemy | Live online engineering classes for children in Riyadh' },
    description:
      'FunAdemy is preparing a live, tutor-led online course for January 2027: small-group engineering, coding and robotics adventures for Riyadh families. See the enrolment page for current groups and prices.',
    alternates: {
      canonical: `${base}/en`,
      languages: {
        'x-default': `${base}/`,
        'ar-SA': `${base}/`,
        'en-SA': `${base}/en`,
      },
    },
  };
}

import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { FunHome } from '@/components/home3/FunHome';
import { copy } from '@/components/home3/data';

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: ([1, 2, 3, 4] as const).map((n) => ({
    '@type': 'Question',
    name: copy.en[`faqQ${n}`],
    acceptedAnswer: { '@type': 'Answer', text: copy.en[`faqA${n}`] },
  })),
};

export default function EnglishHomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <FunHome lang="en" />
      <WhatsAppFloat lang="en" />
    </>
  );
}
