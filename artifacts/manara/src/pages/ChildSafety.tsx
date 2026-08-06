import React from 'react';
import { useI18n } from '@/lib/i18n';
import { ShieldCheck, ShieldOff, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

import { useSeo } from '@/hooks/use-seo';

export default function ChildSafety() {
  const { t } = useI18n();

  useSeo(
    'حماية الطفل أولوية',
    'بنينا منارة لتكون المساحة الرقمية الأكثر أماناً لطفلك.',
    'Child Safety',
    'We built Manara to be the safest digital space for your child.'
  );

  return (
    <div className="py-24 bg-background min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-16">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-foreground">{t('حماية الطفل أولوية', 'Child Safety is a Priority')}</h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t(
              'بنينا منارة لتكون المساحة الرقمية الأكثر أماناً لطفلك. مكان يمكنك تركه فيه دون قلق.',
              'We built Manara to be the safest digital space for your child. A place you can leave them without worry.'
            )}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6 flex gap-4 items-start">
              <ShieldOff className="w-8 h-8 text-primary shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-2">{t('خالية 100٪ من الإعلانات', '100% Ad-Free')}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(
                    'لا توجد مساحات إعلانية، ولا نوافذ منبثقة، ولا محتوى دعائي خفي. لن يتعرض طفلك لأي رسائل تجارية أثناء التعلم.',
                    'No banner spaces, no popups, and no hidden sponsored content. Your child will not be exposed to commercial messages while learning.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-6 flex gap-4 items-start">
              <EyeOff className="w-8 h-8 text-primary shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-2">{t('لا روابط خارجية', 'No External Links')}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(
                    'بيئة مغلقة بالكامل. جميع مقاطع الفيديو والمواد التعليمية مستضافة داخل المنصة، فلا مجال لانتقال الطفل إلى مواقع أخرى بالخطأ.',
                    'A fully enclosed environment. All videos and materials are hosted within the platform, so there is no way for the child to accidentally navigate to other sites.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border shadow-sm md:col-span-2 max-w-2xl mx-auto w-full">
            <CardContent className="pt-6 flex gap-4 items-start">
              <ShieldCheck className="w-8 h-8 text-primary shrink-0" />
              <div>
                <h3 className="text-xl font-bold mb-2">{t('لا تواصل مع الغرباء (ميزات اجتماعية معطلة)', 'No Strangers (Social Features Disabled)')}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(
                    'لا توجد غرف دردشة، ولا إمكانية لإرسال رسائل خاصة، ولا تعليقات عامة. تركيز طفلك سيكون محصوراً في التعلم وإنجاز التمارين فقط، بعيداً عن مخاطر التواصل الرقمي.',
                    'No chat rooms, no direct messaging, and no public comments. Your child\'s focus will be solely on learning and completing exercises, away from the risks of digital communication.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="bg-muted/50 p-8 rounded-[2rem] text-center max-w-2xl mx-auto border border-border/50">
          <h2 className="text-2xl font-bold mb-4">{t('بوابة الآباء', 'The Parent Gate')}</h2>
          <p className="text-muted-foreground mb-6">
            {t(
              'لتوفير حماية إضافية، لا يمكن للطفل الخروج من الواجهة المخصصة له أو الدخول إلى إعدادات الحساب دون إدخال الرمز السري الخاص بك (PIN) المكون من 4 أرقام.',
              'For extra protection, the child cannot exit their designated interface or access account settings without entering your 4-digit PIN.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
