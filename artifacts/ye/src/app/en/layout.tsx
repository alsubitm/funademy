import type { Metadata } from 'next';
import { Baloo_Bhaijaan_2, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'FunAdemy — e² Young Engineers',
  description:
    'FunAdemy — Where fun meets academia. STEM education through moving LEGO® models for children ages 4–18 — online classes from anywhere. e² Young Engineers, Falcon Eye license.',
};

export default function EnglishRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${baloo.variable} ${plexArabic.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
