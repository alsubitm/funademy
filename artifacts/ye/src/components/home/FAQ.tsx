import { ScrollReveal } from '@/components/ScrollReveal';

interface FaqEntry {
  id: number;
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
}

export function FAQ({ faqs, lang }: { faqs: FaqEntry[]; lang: 'ar' | 'en' }) {
  if (faqs.length === 0) return null;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: lang === 'ar' ? faq.questionAr : faq.questionEn,
      acceptedAnswer: {
        '@type': 'Answer',
        text: lang === 'ar' ? faq.answerAr : faq.answerEn,
      },
    })),
  };

  return (
    <section className="sec faq" id="faq">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="wrap" style={{ maxWidth: '800px' }}>
        <ScrollReveal style={{ textAlign: 'center' }}>
          <span className="kick">FAQ</span>
          <h2>{lang === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}</h2>
        </ScrollReveal>
        
        <ScrollReveal className="mt-8">
          {faqs.map((faq) => (
            <details key={faq.id}>
              <summary>{lang === 'ar' ? faq.questionAr : faq.questionEn}</summary>
              <div className="a">{lang === 'ar' ? faq.answerAr : faq.answerEn}</div>
            </details>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
