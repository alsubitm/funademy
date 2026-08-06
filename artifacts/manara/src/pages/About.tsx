import React from 'react';
import { useI18n } from '@/lib/i18n';
import { BookOpen, Target, Users, ShieldCheck, Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function About() {
  const { t } = useI18n();

  return (
    <div className="py-24 bg-background min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-16">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-foreground">{t('من نحن', 'About Us')}</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t(
              'أكاديمية منارة هي الرفيق الموثوق للأسرة السعودية في رحلة تعليم أبنائها، نجمع بين جودة المنهج الوطني وأحدث التقنيات التفاعلية.',
              'Manara Academy is the trusted companion for the Saudi family in their children\'s educational journey, combining national curriculum quality with the latest interactive technologies.'
            )}
          </p>
        </div>

        <div className="space-y-16">
          {/* Mission & Vision */}
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-primary/5 border-primary/20 shadow-none">
              <CardContent className="pt-6">
                <Target className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-4">{t('مهمتنا', 'Our Mission')}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t(
                    'تمكين العائلات السعودية من توفير تعليم منزلي موثوق وممتع يواكب تطلعات رؤية 2030 في بناء جيل شغوف بالمعرفة ومستعد للمستقبل.',
                    'Empowering Saudi families to provide reliable and enjoyable home education that aligns with Vision 2030 aspirations, building a generation passionate about knowledge and ready for the future.'
                  )}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-secondary/5 border-secondary/20 shadow-none">
              <CardContent className="pt-6">
                <Users className="w-10 h-10 text-secondary mb-4" />
                <h3 className="text-2xl font-bold mb-4">{t('رؤيتنا', 'Our Vision')}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t(
                    'أن نكون المنصة الأولى التي تعتمد عليها كل أسرة لدعم أبنائها دراسياً، من خلال بيئة تعليمية آمنة لا تحتاج لإشراف دائم من الآباء.',
                    'To be the primary platform every family relies on to support their children academically, through a safe learning environment that doesn\'t require constant parental supervision.'
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Values */}
          <div>
            <h2 className="text-3xl font-bold text-center mb-12">{t('قيمنا', 'Our Values')}</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-foreground" />
                </div>
                <h4 className="text-xl font-bold mb-2">{t('الأمان أولاً', 'Safety First')}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('بيئة مغلقة تماماً، بلا إعلانات، وبلا روابط خارجية أو تواصل مع غرباء.', 'A completely closed environment, no ads, no external links, and no communication with strangers.')}
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-foreground" />
                </div>
                <h4 className="text-xl font-bold mb-2">{t('متعة التعلم', 'Joy of Learning')}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('نحول الدروس الجامدة إلى تجارب تفاعلية مبهجة تناسب طبيعة كل مرحلة عمرية.', 'We transform rigid lessons into joyful interactive experiences suited to the nature of each age group.')}
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-foreground" />
                </div>
                <h4 className="text-xl font-bold mb-2">{t('الأصالة والجودة', 'Authenticity & Quality')}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('محتوى يتوافق بدقة مع المنهج الوطني ويحترم هوية وثقافة الأسرة السعودية.', 'Content that accurately aligns with the national curriculum and respects the identity and culture of the Saudi family.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
