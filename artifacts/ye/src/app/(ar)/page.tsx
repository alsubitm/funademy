export const revalidate = 300;
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const ogImage = `${base}/og-default.jpg`;
  return {
    title: { absolute: 'FunAdemy | حصص هندسة وبرمجة مباشرة أونلاين للأطفال في الرياض' },
    description:
      'FunAdemy تجهّز دورة أونلاين مباشرة مع مدرّب لشهر يناير 2027: مغامرات في الهندسة والبرمجة والروبوتات لأطفال الرياض ضمن مجموعات صغيرة. للمجموعات والأسعار الحالية زر صفحة التسجيل.',
    openGraph: {
      siteName: 'FunAdemy',
      type: 'website',
      locale: 'ar_SA',
      url: `${base}/`,
      title: 'FunAdemy | حصص مباشرة أونلاين للأطفال',
      description: 'دورة أونلاين مباشرة مع مدرّب، قيد التجهيز لشهر يناير 2027. المجموعات والأسعار الحالية في صفحة التسجيل.',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'FunAdemy | حصص مباشرة أونلاين للأطفال' }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@funademy',
      title: 'FunAdemy | حصص مباشرة أونلاين للأطفال',
      description: 'دورة أونلاين مباشرة مع مدرّب، قيد التجهيز لشهر يناير 2027. المجموعات والأسعار الحالية في صفحة التسجيل.',
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
