import { Baloo_Bhaijaan_2, IBM_Plex_Sans_Arabic, IBM_Plex_Mono, Space_Grotesk, Manrope, Noto_Sans_Arabic } from 'next/font/google';
import { siteUrl } from '@/lib/site-url';
import { PHONE_DISPLAY } from '@/lib/constants';
import '../globals.css';
import '../v3.css';
import type { Metadata, Viewport } from 'next';
import { PublicChatMount } from '@/components/chat/PublicChatMount';

const baloo = Baloo_Bhaijaan_2({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-baloo',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-arabic',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
});

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-v3-display' });
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-v3-body' });
const notoArabic = Noto_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-v3-arabic' });

const SITE_URL = siteUrl();
const OG_IMAGE = `${SITE_URL}/og-default.jpg`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // userScalable must remain enabled for WCAG 1.4.4 (Resize Text) compliance
};
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'FunAdemy — Where Fun Meets Academy',
    template: '%s | FunAdemy',
  },
  description:
    'STEM education through moving LEGO® models for children ages 4–18 in Riyadh. In-person classes. e² Young Engineers, Falcon Eye license.',
  openGraph: {
    siteName: 'FunAdemy',
    type: 'website',
    locale: 'en_US',
    url: `${SITE_URL}/en`,
    title: 'FunAdemy — Where Fun Meets Academy',
    description:
      'STEM education through moving LEGO® models for children ages 4–18. In-person classes in Riyadh.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'FunAdemy' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@funademy',
    title: 'FunAdemy — Where Fun Meets Academy',
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
          telephone: PHONE_DISPLAY,
          areaServed: 'SA',
          availableLanguage: ['Arabic', 'English'],
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Riyadh',
          addressCountry: 'SA',
        },
        sameAs: [
          'https://www.instagram.com/funademy_sa/',
          'https://twitter.com/funademy',
          'https://www.facebook.com/funademy.sa/',
          'https://www.youtube.com/@funademy',
        ],
      },
      {
        '@type': 'LocalBusiness',
        '@id': `${base}/#localbusiness`,
        name: 'FunAdemy — e² Young Engineers Riyadh',
        telephone: PHONE_DISPLAY,
        url: base,
        image: `${base}/brand/ye-logo.svg`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Riyadh',
          addressRegion: 'Riyadh Province',
          addressCountry: 'SA',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 24.7136,
          longitude: 46.6753,
        },
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            opens: '16:00',
            closes: '21:00',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Friday', 'Saturday'],
            opens: '10:00',
            closes: '20:00',
          },
        ],
        priceRange: '$$',
        currenciesAccepted: 'SAR',
        paymentAccepted: 'Cash, Credit Card',
        areaServed: { '@type': 'City', name: 'Riyadh' },
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/en#website`,
        url: `${base}/en`,
        name: 'FunAdemy',
        inLanguage: 'en',
        publisher: { '@id': `${base}/#organization` },
      },
    ],
  };

  return (
    <html lang="en" dir="ltr" className={`${baloo.variable} ${plexArabic.variable} ${plexMono.variable} ${spaceGrotesk.variable} ${manrope.variable} ${notoArabic.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body>
        {children}
        <PublicChatMount lang="en" />
      </body>
    </html>
  );
}
