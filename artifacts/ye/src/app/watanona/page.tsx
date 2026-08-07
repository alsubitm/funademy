export const revalidate = 300;
import { Metadata } from 'next';
import { WatanonaPage } from './WatanonaPage';

export const metadata: Metadata = {
  title: 'أطفالنا يبنون وطننا | فناديمي Funademy',
  description: 'شارك معنا في أضخم خريطة للمملكة مبنية بمكعبات ليغو®. مبادرة وطنية بمناسبة اليوم الوطني برعاية Young Engineers الرياض.',
};

export default function Page() {
  return <WatanonaPage lang="ar" />;
}
