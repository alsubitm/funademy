export const revalidate = 300;
import { Metadata } from 'next';
import { WatanonaPage } from './WatanonaPage';

const _siteUrl = `https://${(process.env.REPLIT_DOMAINS ?? '').split(',')[0] || 'funademy.sa'}`;
export const metadata: Metadata = {
  title: 'أطفالنا يبنون وطننا | FunAdemy',
  description: 'شارك معنا في أضخم خريطة للمملكة مبنية بمكعبات ليغو®. مبادرة وطنية بمناسبة اليوم الوطني برعاية Young Engineers الرياض.',
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

export default function Page() {
  return <WatanonaPage lang="ar" />;
}
