import type { Metadata } from 'next';
import { ChatAssistant } from '@/components/chat/ChatAssistant';
import { SandStripe } from '@/components/SandStripe';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'المساعدة والمحادثة',
  description: 'تحدث مع مساعد فناديمي عن البرامج والمواعيد والحجز، أو انتقل إلى فريقنا عبر واتساب.',
  alternates: {
    canonical: `${siteUrl()}/help`,
    languages: { 'ar-SA': `${siteUrl()}/help`, 'en-SA': `${siteUrl()}/en/help` },
  },
};

export default function HelpPage() {
  return (
    <>
      <SiteHeader lang="ar" />
      <SandStripe />
      <main id="main-content" className="chat-help sec">
        <div className="chat-help__heading">
          <span className="kick">FUNADEMY ASSISTANT</span>
          <h1>كيف نقدر نساعدك؟</h1>
          <p>اسأل عن البرنامج المناسب لطفلك أو المواعيد أو خطوات الحجز. لا تُدخل بيانات بطاقة الدفع في المحادثة.</p>
        </div>
        <ChatAssistant lang="ar" mode="page" />
      </main>
      <SandStripe />
      <SiteFooter lang="ar" />
    </>
  );
}