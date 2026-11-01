export const revalidate = 300;
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  return {
    title: { absolute: 'FunAdemy — Where Fun Meets Academy | Live STEM for Kids' },
    description:
      'STEM education through moving LEGO® models for children aged 4–18. Online and in-person classes in Riyadh. e² Young Engineers, Falcon Eye license.',
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
