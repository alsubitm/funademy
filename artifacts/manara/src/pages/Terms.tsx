import React from 'react';
import { useI18n } from '@/lib/i18n';

import { useSeo } from '@/hooks/use-seo';

export default function Terms() {
  const { t } = useI18n();

  useSeo(
    'الشروط والأحكام',
    'الشروط والأحكام لاستخدام منصة منارة.',
    'Terms of Service',
    'Terms and conditions for using the Manara platform.'
  );

  return (
    <div className="py-24 bg-background min-h-screen">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-black mb-8 text-foreground">{t('الشروط والأحكام', 'Terms of Service')}</h1>
        <p className="text-muted-foreground mb-8">
          {t('آخر تحديث: ١٥ أكتوبر ٢٠٢٣', 'Last updated: October 15, 2023')}
        </p>

        <div className="prose prose-lg dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground max-w-none">
          <h3>{t('١. قبول الشروط', '1. Acceptance of Terms')}</h3>
          <p>
            {t(
              'باستخدامك لمنصة منارة (يشار إليها بـ "نحن" أو "المنصة")، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام خدماتنا.',
              'By using the Manara platform (referred to as "we" or "the platform"), you agree to be bound by these terms and conditions. If you do not agree with any part of these terms, please do not use our services.'
            )}
          </p>

          <h3>{t('٢. الحسابات والاشتراكات', '2. Accounts and Subscriptions')}</h3>
          <p>
            {t(
              'أنت مسؤول عن الحفاظ على سرية حسابك وكلمة المرور الخاصة بك. يغطي الاشتراك العائلي الواحد أفراد الأسرة المباشرين فقط ولا يُسمح بمشاركة الحساب مع عائلات أخرى.',
              'You are responsible for maintaining the confidentiality of your account and password. A single family subscription covers direct family members only and sharing the account with other families is not permitted.'
            )}
          </p>

          <h3>{t('٣. المحتوى التعليمي والاستخدام المسموح', '3. Educational Content and Permitted Use')}</h3>
          <p>
            {t(
              'جميع حقوق الملكية الفكرية للمحتوى التعليمي (مقاطع فيديو، نصوص، صور، تمارين) مملوكة لمنارة أو مرخصة لها. يُسمح باستخدام المحتوى للأغراض التعليمية الشخصية فقط ويُمنع نسخه أو إعادة توزيعه.',
              'All intellectual property rights for educational content (videos, texts, images, exercises) are owned by or licensed to Manara. Content may be used for personal educational purposes only and copying or redistributing it is prohibited.'
            )}
          </p>

          <h3>{t('٤. سياسة الإلغاء والاسترداد', '4. Cancellation and Refund Policy')}</h3>
          <p>
            {t(
              'يمكنك إلغاء اشتراكك في أي وقت من خلال إعدادات الحساب. عند الإلغاء، سيظل بإمكانك الوصول إلى الخدمة حتى نهاية فترة الفوترة الحالية. لا نقدم استرداداً جزئياً للفترات غير المستخدمة.',
              'You can cancel your subscription at any time through your account settings. Upon cancellation, you will retain access to the service until the end of your current billing period. We do not offer partial refunds for unused periods.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
