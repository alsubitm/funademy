export const revalidate = 300;
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const ogImage = `${base}/og-default.jpg`;
  return {
    title: { absolute: 'FunAdemy — حيث المتعة تلتقي بالأكاديمية | برامج STEM مباشرة للأطفال' },
    description:
      'FunAdemy: تعليم STEM عبر نماذج LEGO® للأطفال من ٤ إلى ١٨ سنة في الرياض. سجّل تجربتك المجانية اليوم مع e² Young Engineers — ترخيص فالكون آي.',
    openGraph: {
      siteName: 'FunAdemy',
      type: 'website',
      locale: 'ar_SA',
      url: `${base}/`,
      title: 'FunAdemy — حيث المتعة تلتقي بالأكاديمية',
      description: 'برامج STEM بالليغو للأطفال في الرياض. احجز تجربة مجانية.',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'FunAdemy — حيث المتعة تلتقي بالأكاديمية' }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@funademy',
      title: 'FunAdemy — حيث المتعة تلتقي بالأكاديمية',
      description: 'برامج STEM بالليغو للأطفال في الرياض. احجز تجربة مجانية.',
      images: [ogImage],
    },
    alternates: {
      canonical: `${base}/`,
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
    name: copy.ar[`faqQ${n}`],
    acceptedAnswer: { '@type': 'Answer', text: copy.ar[`faqA${n}`] },
  })),
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <FunHome lang="ar" />
      <WhatsAppFloat lang="ar" />
    </>
  );
}
