export const revalidate = 300;
import { Metadata } from 'next';
import { WatanonaPage } from '../../watanona/WatanonaPage';

export const metadata: Metadata = {
  title: 'Our Children Build Our Homeland | FunAdemy',
  description: 'Join us in building the largest LEGO® map of the Kingdom. A national initiative for Saudi National Day by FunAdemy · e² Young Engineers Riyadh.',
};

export default function Page() {
  return <WatanonaPage lang="en" />;
}
