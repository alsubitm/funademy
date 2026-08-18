import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { EnrollFlow } from '@/components/enroll/EnrollFlow';
import { enrollDict } from '@/app/(ar)/enroll/dict';
import '@/app/(ar)/account/page.css';
import '@/app/(ar)/enroll/page.css';
import { siteUrl } from '@/lib/site-url';

const _enrollBase = siteUrl();
export const metadata = {
  title: 'Monthly Enrollment | FunAdemy',
  description:
    'Enroll your children in FunAdemy monthly STEM programs — LEGO® engineering, coding and robotics in Riyadh. Automatic 10% sibling discount. In-person and online for ages 4–18.',
  openGraph: {
    type: 'website',
    locale: 'en_SA',
    title: 'Monthly Enrollment | FunAdemy',
    description: 'Enroll your children in FunAdemy monthly programs — automatic 10% sibling discount.',
    images: [{ url: `${_enrollBase}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@YEYoungEngineers',
    title: 'Monthly Enrollment | FunAdemy',
    description: 'Enroll your children in FunAdemy monthly programs — automatic 10% sibling discount.',
    images: [`${_enrollBase}/og-default.jpg`],
  },
  alternates: {
    canonical: `${_enrollBase}/en/enroll`,
    languages: {
      'ar-SA': `${_enrollBase}/enroll`,
      'en-SA': `${_enrollBase}/en/enroll`,
      'x-default': `${_enrollBase}/enroll`,
    },
  },
};

export default async function EnrollPageEn({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const program = typeof sp.program === 'string' ? sp.program : undefined;
  const d = enrollDict.en;
  return (
    <>
      <SiteHeader lang="en" />
      <SandStripe />
      <main className="enr-pg">
        <div className="wrap" style={{ position: 'relative', paddingTop: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>{d.kick}</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.sub}</p>
          </div>
          <EnrollFlow lang="en" preselectProgramSlug={program} />
        </div>
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
