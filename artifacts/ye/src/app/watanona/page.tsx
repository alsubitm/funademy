export const revalidate = 300;
import { Metadata } from 'next';
import { WatanonaPage } from './WatanonaPage';

export const metadata: Metadata = {
  title: 'أطفالنا يبنون وطننا | Young Engineers الرياض الشمالية',
  description: 'شارك معنا في أضخم خريطة للمملكة مبنية بمكعبات ليغو®. مبادرة وطنية بمناسبة اليوم الوطني برعاية Young Engineers الرياض الشمالية.',
};

export default function Page() {
  return <WatanonaPage lang="ar" />;
}
