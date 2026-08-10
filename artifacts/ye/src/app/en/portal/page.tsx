import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { getFamilyId } from '@/lib/family-auth';
import { PortalView } from '@/components/portal/PortalView';
import { portalDict } from '@/app/(ar)/portal/dict';
import '@/app/(ar)/portal/page.css';

export const metadata = {
  title: 'Parent Portal | FunAdemy',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PortalPageEn({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const child = typeof sp.child === 'string' ? Number(sp.child) : undefined;
  const payNotice = sp.paid ? ('paid' as const) : sp.paypending ? ('pending' as const) : sp.payfail ? ('fail' as const) : undefined;
  const familyId = await getFamilyId();
  const d = portalDict.en;

  return (
    <>
      <SiteHeader lang="en" />
      <SandStripe />
      <main className="ptl-pg">
        <div className="ptl-wrap" style={{ paddingTop: '50px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick">{d.kick}</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '30px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.sub}</p>
          </div>
          {!familyId ? (
            <div className="ptl-card" style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: 14, color: 'var(--mut)' }}>{d.loginNeeded}</p>
              <Link className="btn b" style={{ padding: '12px 26px', fontSize: 15 }} href="/en/account">{d.goLogin}</Link>
            </div>
          ) : (
            <PortalView lang="en" familyId={familyId} selectedChild={Number.isInteger(child) ? child : undefined} payNotice={payNotice} />
          )}
        </div>
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
