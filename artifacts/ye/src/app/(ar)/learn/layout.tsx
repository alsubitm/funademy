import './learn.css';
import { Suspense } from 'react';
import { LearningLocaleBar } from '@/components/learning/locale';
export const dynamic = 'force-dynamic';

export default function LearnRootLayout({ children }: { children: React.ReactNode }) {
  return <><Suspense><LearningLocaleBar /></Suspense>{children}</>;
}
