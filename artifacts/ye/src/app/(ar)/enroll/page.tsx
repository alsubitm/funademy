import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { EnrollFlow } from '@/components/enroll/EnrollFlow';
import { enrollDict } from './dict';
import '@/app/(ar)/account/page.css';
import './page.css';
import { siteUrl } from '@/lib/site-url';

const _enrollBase = siteUrl();
export const metadata = {
  title: 'التسجيل الشهري | FunAdemy',
  description:
    'سجّل أطفالك في برامج FunAdemy الشهرية لتعلم STEM والهندسة والروبوتكس بالليغو® في الرياض. خصم ١٠٪ تلقائي للأشقاء — حصص حضورية وأونلاين للأطفال من ٤ إلى ١٨ سنة.',
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    title: 'التسجيل الشهري | FunAdemy',
    description: 'سجّل أطفالك في برامج FunAdemy الشهرية — خصم ١٠٪ تلقائي للأشقاء.',
    images: [{ url: `${_enrollBase}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@YEYoungEngineers',
    title: 'التسجيل الشهري | FunAdemy',
    description: 'سجّل أطفالك في برامج FunAdemy الشهرية — خصم ١٠٪ تلقائي للأشقاء.',
    images: [`${_enrollBase}/og-default.jpg`],
  },
  alternates: {
    canonical: `${_enrollBase}/enroll`,
    languages: {
      'ar-SA': `${_enrollBase}/enroll`,
      'en-SA': `${_enrollBase}/en/enroll`,
      'x-default': `${_enrollBase}/enroll`,
    },
  },
};

export default async function EnrollPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const program = typeof sp.program === 'string' ? sp.program : undefined;
  const d = enrollDict.ar;
  return (
    <>
      <SiteHeader lang="ar" />
      <SandStripe />
      <main id="main-content" className="enr-pg">
        <div className="wrap" style={{ position: 'relative', paddingTop: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>{d.kick}</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.sub}</p>
          </div>
          <EnrollFlow lang="ar" preselectProgramSlug={program} />
        </div>
      </main>
      <SiteFooter lang="ar" />
    </>
  );
}
