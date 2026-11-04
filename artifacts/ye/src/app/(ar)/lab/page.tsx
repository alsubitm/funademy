import type { Metadata } from 'next';
import { LabApp } from '@/components/lab/LabApp';
import { gearFanLesson } from '@/lib/lab/gear-fan';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'مختبر التروس — مروحة تدور بالتروس',
  description: 'نشاط تدريبي من FunAdemy: ركّب مروحة تدور بالتروس على طاولة رقمية واختبرها.',
  alternates: { canonical: `${siteUrl()}/lab`, languages: { 'ar-SA': `${siteUrl()}/lab`, 'en-SA': `${siteUrl()}/en/lab` } },
};

export default function LabPageAr() {
  return <main id="main-content"><LabApp lesson={gearFanLesson} lang="ar" /></main>;
}
