export const revalidate = 300;
import { Metadata } from 'next';
import { WatanonaPage } from '../../(ar)/watanona/WatanonaPage';

import { siteUrl } from '@/lib/site-url';
import { EXHIBITION_DATE_ISO } from '@/lib/constants';
const _siteUrl = siteUrl();
export const metadata: Metadata = {
  title: 'Our Children Build Our Homeland | FunAdemy',
  description: 'Join us in building the largest LEGO® map of the Kingdom. A national initiative for Saudi National Day by FunAdemy · e² Young Engineers Riyadh.',
  alternates: {
    canonical: `${siteUrl()}/en/watanona`,
    languages: {
      'ar-SA': `${siteUrl()}/watanona`,
      'en': `${siteUrl()}/en/watanona`,
      'x-default': `${siteUrl()}/watanona`,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Our Children Build Our Homeland | FunAdemy',
    description: 'Join us in building the largest LEGO® map of the Kingdom. A national initiative for Saudi National Day.',
    images: [{ url: `${_siteUrl}/og-default.jpg`, width: 1200, height: 630, alt: 'Watanona — FunAdemy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Our Children Build Our Homeland | FunAdemy',
    description: 'Join us in building the largest LEGO® map of the Kingdom. A national initiative for Saudi National Day.',
    images: [`${_siteUrl}/og-default.jpg`],
  },
};

const _base = siteUrl();
const campaignSchemaEn = {
  '@context': 'https://schema.org',
  '@type': 'EducationalEvent',
  name: 'Our Children Build Our Homeland',
  description: 'Join us in building the largest LEGO® map of the Kingdom. A national initiative for Saudi National Day by FunAdemy · e² Young Engineers Riyadh.',
  url: `${_base}/en/watanona`,
  inLanguage: 'en',
  organizer: { '@id': `${_base}/#organization` },
  startDate: EXHIBITION_DATE_ISO,
  endDate: EXHIBITION_DATE_ISO,
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  location: {
    '@type': 'Place',
    name: 'Riyadh',
    address: { '@type': 'PostalAddress', addressLocality: 'Riyadh', addressCountry: 'SA' },
  },
  image: `${_base}/og-default.jpg`,
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(campaignSchemaEn) }}
      />
      <WatanonaPage lang="en" />
    </>
  );
}
