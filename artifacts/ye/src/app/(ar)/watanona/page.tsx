export const revalidate = 300;
import { Metadata } from 'next';
import { WatanonaPage } from './WatanonaPage';

import { siteUrl } from '@/lib/site-url';
import { EXHIBITION_DATE_ISO } from '@/lib/constants';
const _siteUrl = siteUrl();
export const metadata: Metadata = {
  title: 'أطفالنا يبنون وطننا | FunAdemy',
  description: 'شارك معنا في أضخم خريطة للمملكة مبنية بمكعبات ليغو®. مبادرة وطنية بمناسبة اليوم الوطني برعاية Young Engineers الرياض.',
  alternates: {
    canonical: `${siteUrl()}/watanona`,
    languages: {
      'ar-SA': `${siteUrl()}/watanona`,
      'en-SA': `${siteUrl()}/en/watanona`,
      'x-default': `${siteUrl()}/watanona`,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    title: 'أطفالنا يبنون وطننا | FunAdemy',
    description: 'شارك معنا في أضخم خريطة للمملكة مبنية بمكعبات ليغو®. مبادرة وطنية بمناسبة اليوم الوطني.',
    images: [{ url: `${_siteUrl}/og-default.jpg`, width: 1200, height: 630, alt: 'وطنونا — FunAdemy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'أطفالنا يبنون وطننا | FunAdemy',
    description: 'شارك معنا في أضخم خريطة للمملكة مبنية بمكعبات ليغو®. مبادرة وطنية بمناسبة اليوم الوطني.',
    images: [`${_siteUrl}/og-default.jpg`],
  },
};

const _base = siteUrl();
const campaignSchemaAr = {
  '@context': 'https://schema.org',
  '@type': 'EducationalEvent',
  name: 'أطفالنا يبنون وطننا',
  description: 'شارك معنا في أضخم خريطة للمملكة مبنية بمكعبات ليغو®. مبادرة وطنية بمناسبة اليوم الوطني برعاية Young Engineers الرياض.',
  url: `${_base}/watanona`,
  inLanguage: 'ar',
  organizer: { '@id': `${_base}/#organization` },
  startDate: EXHIBITION_DATE_ISO,
  endDate: EXHIBITION_DATE_ISO,
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  location: {
    '@type': 'Place',
    name: 'الرياض',
    address: { '@type': 'PostalAddress', addressLocality: 'Riyadh', addressCountry: 'SA' },
  },
  image: `${_base}/og-default.jpg`,
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(campaignSchemaAr) }}
      />
      <WatanonaPage lang="ar" />
    </>
  );
}
