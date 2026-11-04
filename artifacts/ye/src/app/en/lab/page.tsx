import type { Metadata } from 'next';
import { LabApp } from '@/components/lab/LabApp';
import { gearFanLesson } from '@/lib/lab/gear-fan';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Gear lab — Gear-Driven Fan',
  description: 'A FunAdemy practice activity: build a gear-driven fan on a digital workbench and test it.',
  alternates: { canonical: `${siteUrl()}/en/lab`, languages: { 'ar-SA': `${siteUrl()}/lab`, 'en-SA': `${siteUrl()}/en/lab` } },
};

export default function LabPageEn() {
  return <main id="main-content"><LabApp lesson={gearFanLesson} lang="en" /></main>;
}
