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

const SITE_URL = `https://${(process.env.REPLIT_DOMAINS ?? '').split(',')[0] || 'funademy.sa'}`;
const OG_IMAGE = `${SITE_URL}/og-default.jpg`;

export const metadata: Metadata = {
  title: {
    default: 'FunAdemy — e² Young Engineers',
    template: '%s | FunAdemy',
  },
  description:
    'FunAdemy — حيث المتعة تلتقي بالأكاديمية. تعليم STEM عبر نماذج LEGO® المتحركة للأطفال من ٤ إلى ١٨ سنة — حصص أونلاين من أي مكان. e² Young Engineers، ترخيص فالكون آي.',
  openGraph: {
    siteName: 'FunAdemy',
    type: 'website',
    locale: 'ar_SA',
    url: SITE_URL,
    title: 'FunAdemy — e² Young Engineers',
    description:
      'تعليم STEM عبر نماذج LEGO® المتحركة للأطفال من ٤ إلى ١٨ سنة — حصص أونلاين من أي مكان.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'FunAdemy — e² Young Engineers Riyadh' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@YEYoungEngineers',
    title: 'FunAdemy — e² Young Engineers',
    description:
      'تعليم STEM عبر نماذج LEGO® المتحركة للأطفال من ٤ إلى ١٨ سنة — حصص أونلاين من أي مكان.',
    images: [OG_IMAGE],
  },
};

export default function ArabicRootLayout({ children }: { children: React.ReactNode }) {
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
            urlTemplate: `${base}/blog?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <html lang="ar" dir="rtl" className={`${baloo.variable} ${plexArabic.variable} ${plexMono.variable}`}>
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
