import React from 'react';
import { useI18n } from '@/lib/i18n';

export default function Privacy() {
  const { t } = useI18n();

  return (
    <div className="py-24 bg-background min-h-screen">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-black mb-8 text-foreground">{t('سياسة الخصوصية', 'Privacy Policy')}</h1>
        <p className="text-muted-foreground mb-8">
          {t('نحن نأخذ خصوصية عائلتك على محمل الجد.', 'We take your family\'s privacy very seriously.')}
        </p>

        <div className="prose prose-lg dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground max-w-none">
          <h3>{t('١. جمع البيانات بشكل مصغر للأطفال', '1. Minimal Child Data Collection')}</h3>
          <p>
            {t(
              'نحن نجمع الحد الأدنى المطلق من بيانات الأطفال اللازمة لعمل المنصة (الاسم الأول، سنة الميلاد لتقديم المحتوى المناسب، وتاريخ التعلم). لا نطلب أبداً صوراً شخصية للأطفال، بل نستخدم شخصيات رمزية (Avatars).',
              'We collect the absolute minimum child data necessary for the platform to function (first name, birth year to serve appropriate content, and learning history). We never ask for personal photos of children; we use illustrative avatars instead.'
            )}
          </p>

          <h3>{t('٢. بوابة الآباء والـ PIN', '2. Parent Gate and PIN')}</h3>
          <p>
            {t(
              'نستخدم رمز أمان مكون من 4 أرقام (PIN) لضمان عدم وصول الأطفال إلى إعدادات الحساب أو الفوترة، والتأكد من بقائهم ضمن البيئة الآمنة المخصصة لهم.',
              'We use a 4-digit PIN code to ensure children cannot access account or billing settings, and to ensure they remain within their designated safe environment.'
            )}
          </p>

          <h3>{t('٣. مشاركة البيانات والإعلانات', '3. Data Sharing and Advertising')}</h3>
          <p>
            {t(
              'منصة منارة خالية تماماً من الإعلانات. نحن لا نبيع أو نشارك بيانات العائلة أو الأطفال مع أي أطراف ثالثة لأغراض تسويقية أو إعلانية. بياناتك تستخدم فقط لتحسين تجربتك التعليمية.',
              'Manara is completely ad-free. We do not sell or share family or child data with any third parties for marketing or advertising purposes. Your data is strictly used to improve your educational experience.'
            )}
          </p>

          <h3>{t('٤. طلب حذف البيانات', '4. Data Deletion Requests')}</h3>
          <p>
            {t(
              'بصفتك ولي الأمر، يحق لك طلب الحذف الكامل والنهائي لجميع بيانات حسابك وبيانات أبنائك في أي وقت من خلال قسم (الإعدادات) في لوحة تحكم الآباء. سيتم تنفيذ الطلب وتدمير البيانات خلال 48 ساعة.',
              'As a parent, you have the right to request full and permanent deletion of all your account and children\'s data at any time through the Settings section in the Parent Dashboard. The request will be executed and data destroyed within 48 hours.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
