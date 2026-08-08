import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { EnrollFlow } from '@/components/enroll/EnrollFlow';
import { enrollDict } from '@/app/enroll/dict';
import '@/app/account/page.css';
import '@/app/enroll/page.css';

export const metadata = {
  title: 'Monthly Enrollment | FunAdemy',
  description: 'Enroll your children in FunAdemy monthly programs — automatic 10% sibling discount.',
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
