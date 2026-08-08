import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { AccountFlow } from '@/components/account/AccountFlow';
import { accountDict } from '@/app/account/dict';
import '@/app/account/page.css';

export const metadata = {
  title: 'Family Account | FunAdemy',
  description: 'Sign in with your mobile number to manage your children and enrollments at FunAdemy.',
};

export default function AccountPageEn() {
  const d = accountDict.en;
  return (
    <>
      <SiteHeader lang="en" />
      <SandStripe />
      <main className="acct-pg">
        <div className="wrap" style={{ position: 'relative', paddingTop: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>{d.kick}</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.sub}</p>
          </div>
          <AccountFlow lang="en" />
        </div>
      </main>
      <SiteFooter lang="en" />
    </>
  );
}
