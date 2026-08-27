import type { Metadata } from 'next';
import { ChatAssistant } from '@/components/chat/ChatAssistant';
import { SandStripe } from '@/components/SandStripe';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Help and chat',
  description: 'Chat with the FunAdemy assistant about programs, schedules and booking, or continue with our team on WhatsApp.',
  alternates: {
    canonical: `${siteUrl()}/en/help`,
    languages: { 'ar-SA': `${siteUrl()}/help`, 'en-SA': `${siteUrl()}/en/help` },
  },
};

export default function HelpPageEn() {
  return (
    <>
      <SiteHeader lang="en" />
      <SandStripe />
      <main id="main-content" className="chat-help sec">
        <div className="chat-help__heading">
          <span className="kick">FUNADEMY ASSISTANT</span>
          <h1>How can we help?</h1>
          <p>Ask about the right program, schedules or booking steps. Never enter payment card details in chat.</p>
        </div>
        <ChatAssistant lang="en" mode="page" />
      </main>
      <SandStripe />
      <SiteFooter lang="en" />
    </>
  );
}