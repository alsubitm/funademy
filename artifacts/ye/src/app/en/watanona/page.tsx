export const revalidate = 300;
import { Metadata } from 'next';
import { WatanonaPage } from '../../(ar)/watanona/WatanonaPage';

const _siteUrl = `https://${(process.env.REPLIT_DOMAINS ?? '').split(',')[0] || 'funademy.sa'}`;
export const metadata: Metadata = {
  title: 'Our Children Build Our Homeland | FunAdemy',
  description: 'Join us in building the largest LEGO® map of the Kingdom. A national initiative for Saudi National Day by FunAdemy · e² Young Engineers Riyadh.',
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

export default function Page() {
  return <WatanonaPage lang="en" />;
}
