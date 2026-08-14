import type { Metadata } from 'next';
import { Baloo_Bhaijaan_2, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from 'next/font/google';
import { siteUrl } from '@/lib/site-url';
import '../globals.css';

const baloo = Baloo_Bhaijaan_2({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

const SITE_URL = siteUrl();
const OG_IMAGE = `${SITE_URL}/og-default.jpg`;

export const metadata: Metadata = {
  title: {
    default: 'FunAdemy — e² Young Engineers',
    template: '%s | FunAdemy',
  },
  description:
    'FunAdemy — Where fun meets academia. STEM education through moving LEGO® models for children ages 4–18 — online classes from anywhere. e² Young Engineers, Falcon Eye license.',
  openGraph: {
    siteName: 'FunAdemy',
    type: 'website',
    locale: 'en_US',
    url: `${SITE_URL}/en`,
    title: 'FunAdemy — e² Young Engineers',
    description:
      'STEM education through moving LEGO® models for children ages 4–18. Online and in-person classes in Riyadh.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'FunAdemy — e² Young Engineers Riyadh' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@YEYoungEngineers',
    title: 'FunAdemy — e² Young Engineers',
    description:
      'STEM education through moving LEGO® models for children ages 4–18.',
    images: [OG_IMAGE],
  },
};

export default function EnglishRootLayout({ children }: { children: React.ReactNode }) {
  const base = siteUrl();

  const orgSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'FunAdemy — e² Young Engineers Riyadh',
        alternateName: 'فناديمي — يونج إنجنيرز الرياض',
        url: base,
        logo: {
          '@type': 'ImageObject',
          url: `${base}/brand/ye-logo.svg`,
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          areaServed: 'SA',
          availableLanguage: ['Arabic', 'English'],
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Riyadh',
          addressCountry: 'SA',
        },
        sameAs: [],
      },
      {
        '@type': 'LocalBusiness',
        '@id': `${base}/#localbusiness`,
        name: 'FunAdemy — e² Young Engineers Riyadh',
        url: base,
        image: `${base}/brand/ye-logo.svg`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Riyadh',
          addressRegion: 'Riyadh Province',
          addressCountry: 'SA',
        },
        priceRange: '$$',
        currenciesAccepted: 'SAR',
        paymentAccepted: 'Cash, Credit Card',
        areaServed: { '@type': 'City', name: 'Riyadh' },
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: base,
        name: 'FunAdemy',
        inLanguage: ['ar', 'en'],
        publisher: { '@id': `${base}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${base}/en/blog?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <html lang="en" dir="ltr" className={`${baloo.variable} ${plexArabic.variable} ${plexMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
