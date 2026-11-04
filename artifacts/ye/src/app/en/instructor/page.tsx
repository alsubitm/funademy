import type { Metadata } from 'next';
import { InstructorPanel } from '@/components/instructor/InstructorPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Instructor panel | FunAdemy',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function InstructorPageEn() {
  return <InstructorPanel lang="en" />;
}
