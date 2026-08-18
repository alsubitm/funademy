import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { AccountFlow } from '@/components/account/AccountFlow';
import { accountDict } from './dict';
import './page.css';

export const metadata = {
  title: 'حساب العائلة | FunAdemy',
  description: 'سجّل دخولك برقم جوالك لإدارة أطفالك وتسجيلاتهم في FunAdemy.',
};

export default function AccountPage() {
  const d = accountDict.ar;
  return (
    <>
      <SiteHeader lang="ar" />
      <SandStripe />
      <main id="main-content" className="acct-pg">
        <div className="wrap" style={{ position: 'relative', paddingTop: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>{d.kick}</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.sub}</p>
          </div>
          <AccountFlow lang="ar" />
        </div>
      </main>
      <SiteFooter lang="ar" />
    </>
  );
}
