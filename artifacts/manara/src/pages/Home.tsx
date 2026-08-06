import React from 'react';
import { useI18n } from '@/lib/i18n';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { PlayCircle, ShieldCheck, Star, Brain, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useGetMarketingContent } from '@workspace/api-client-react';

export default function Home() {
  const { t, dir } = useI18n();
  const { data: marketing, isLoading } = useGetMarketingContent();

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary/5 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
              {t('الرفيق الموثوق لتعليم أبنائك ', 'The trusted companion for ')}
              <span className="text-primary">{t('المنهج السعودي', 'the Saudi curriculum')}</span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {t(
                'منصة تعليمية مصممة خصيصاً للأسرة السعودية. محتوى آمن، تفاعلي، ويغطي المناهج الوطنية من رياض الأطفال وحتى المرحلة الثانوية باشتراك واحد للأسرة بأكملها.',
                'An educational platform built specifically for the Saudi family. Safe, interactive content covering national curricula from kindergarten to high school with one family subscription.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full" asChild>
                <Link href="/signup">
                  {t('ابدأ التجربة المجانية', 'Start Free Trial')}
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full" asChild>
                <Link href="/curriculum">
                  <PlayCircle className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('استكشف المناهج', 'Explore Curriculum')}
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {t('تجربة مجانية لمدة 7 أيام • إلغاء في أي وقت', '7-day free trial • Cancel anytime')}
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -z-10" />
      </section>

      {/* Stats Section */}
      {!isLoading && marketing?.stats && (
        <section className="py-12 border-b bg-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center divide-x rtl:divide-x-reverse divide-border">
              <div>
                <div className="text-4xl font-black text-primary mb-2">+{marketing.stats.families.toLocaleString()}</div>
                <div className="text-sm font-medium text-muted-foreground">{t('أسرة تثق بنا', 'Families Trust Us')}</div>
              </div>
              <div>
                <div className="text-4xl font-black text-primary mb-2">+{marketing.stats.lessons.toLocaleString()}</div>
                <div className="text-sm font-medium text-muted-foreground">{t('درس تفاعلي', 'Interactive Lessons')}</div>
              </div>
              <div className="col-span-2 md:col-span-1 border-t md:border-t-0 pt-8 md:pt-0">
                <div className="text-4xl font-black text-primary mb-2">{marketing.stats.subjects}</div>
                <div className="text-sm font-medium text-muted-foreground">{t('مادة دراسية', 'Subjects Covered')}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* How It Works - 3 Steps */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">{t('كيف تعمل منارة؟', 'How Manara Works')}</h2>
            <p className="text-muted-foreground">
              {t('خطوات بسيطة لبدء رحلة تعليمية ممتعة وآمنة لأبنائك.', 'Simple steps to start a fun and safe educational journey for your children.')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-border -z-10" />
            
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-sm">
                <span className="text-4xl font-black">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3">{t('سجل عائلتك', 'Register Your Family')}</h3>
              <p className="text-muted-foreground">
                {t('أنشئ حساباً واحداً لأسرتك واضف ملفات شخصية غير محدودة لأبنائك.', 'Create one family account and add unlimited profiles for your children.')}
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-6 shadow-sm">
                <span className="text-4xl font-black">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3">{t('حدد مسار كل طفل', 'Set Each Child\'s Path')}</h3>
              <p className="text-muted-foreground">
                {t('يتم تخصيص الواجهة والمحتوى تلقائياً بناءً على عمر الطفل ومرحلته الدراسية.', 'Interface and content are automatically customized based on age and grade level.')}
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-6 shadow-sm">
                <span className="text-4xl font-black">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3">{t('تابع تقدمهم', 'Track Their Progress')}</h3>
              <p className="text-muted-foreground">
                {t('احصل على تقارير أسبوعية تفصيلية عن أداء كل طفل ونقاط قوته والمجالات التي تحتاج دعماً.', 'Get detailed weekly reports on each child\'s performance, strengths, and areas needing support.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Four Bands */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">{t('مراحل مصممة لتناسب أعمارهم', 'Stages Designed for Their Age')}</h2>
            <p className="text-muted-foreground">
              {t('لا نقدم محتوى موحداً للجميع. تتغير واجهة التطبيق وطريقة التعلم مع نمو طفلك.', 'We don\'t offer one-size-fits-all content. The app interface and learning methods evolve as your child grows.')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Explorers */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-border/50 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFB800]/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
              <div className="inline-flex px-3 py-1 rounded-full bg-[#FFB800]/15 text-[#B28000] text-sm font-bold mb-4">
                {t('المستكشفون (4-7 سنوات)', 'Explorers (4-7 years)')}
              </div>
              <h3 className="text-2xl font-bold mb-3">{t('تعلم باللعب والاستماع', 'Learning through Play & Audio')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('واجهة تعتمد على الصوت والصور، أزرار كبيرة، ومكافآت فورية مبهجة تناسب مرحلة رياض الأطفال والصفوف الأولى.', 'Audio and image-led interface, large buttons, and cheerful instant rewards suited for kindergarten and early grades.')}
              </p>
              <ul className="space-y-2 mb-8">
                {['أساسيات القراءة والرياضيات', 'أناشيد تعليمية وتفاعلية', 'بدون نصوص معقدة'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#FFB800]" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Builders */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-border/50 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#9D4EDD]/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
              <div className="inline-flex px-3 py-1 rounded-full bg-[#9D4EDD]/15 text-[#6B21A8] text-sm font-bold mb-4">
                {t('البناة (8-11 سنة)', 'Builders (8-11 years)')}
              </div>
              <h3 className="text-2xl font-bold mb-3">{t('تحديات وأوسمة متدرجة', 'Challenges & Badges')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('بيئة محفزة تعتمد على جمع النقاط، مستويات متدرجة، ومسارات تعلم واضحة تعزز استقلالية الطفل.', 'A motivating environment based on earning points, progressive levels, and clear learning paths promoting child independence.')}
              </p>
              <ul className="space-y-2 mb-8">
                {['تطبيقات علمية ممتعة', 'تتبع متعة الإنجاز اليومي', 'تمارين تفاعلية ذكية'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#9D4EDD]" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Achievers */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-border/50 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#0077B6]/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
              <div className="inline-flex px-3 py-1 rounded-full bg-[#0077B6]/15 text-[#03045E] text-sm font-bold mb-4">
                {t('المنجزون (12-15 سنة)', 'Achievers (12-15 years)')}
              </div>
              <h3 className="text-2xl font-bold mb-3">{t('تنظيم وإتقان', 'Organization & Mastery')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('واجهة أنظف مع أشرطة تقدم واضحة، نسب إتقان للمفاهيم، ومحتوى يركز على الفهم العميق للمتوسطة.', 'Cleaner interface with clear progress bars, concept mastery percentages, and content focusing on deep understanding for middle school.')}
              </p>
              <ul className="space-y-2 mb-8">
                {['شروحات مرئية واضحة', 'متابعة دقيقة لمستوى الإتقان', 'خرائط ذهنية للمفاهيم'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#0077B6]" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Graduates */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-border/50 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#334155]/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
              <div className="inline-flex px-3 py-1 rounded-full bg-[#334155]/15 text-[#0F172A] text-sm font-bold mb-4">
                {t('الخريجون (16-18 سنة)', 'Graduates (16-18 years)')}
              </div>
              <h3 className="text-2xl font-bold mb-3">{t('استعداد جاد للاختبارات', 'Serious Exam Prep')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('نبرة جادة، تدريبات مكثفة على نماذج الاختبارات، ومتابعة دقيقة للأداء استعداداً للمرحلة الجامعية.', 'Serious tone, intensive practice with exam models, and precise performance tracking in preparation for university.')}
              </p>
              <ul className="space-y-2 mb-8">
                {['تدريب على القدرات والتحصيلي', 'مراجعات مكثفة', 'تحليل دقيق لنقاط الضعف'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#334155]" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto px-4 max-w-3xl">
          <Brain className="w-16 h-16 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">{t('جاهز لبدء رحلة التعلم؟', 'Ready to start the learning journey?')}</h2>
          <p className="text-primary-foreground/80 mb-10 text-lg">
            {t('انضم إلى آلاف العائلات التي تثق بمنارة كشريك تعليمي يومي لأبنائها.', 'Join thousands of families who trust Manara as a daily educational partner for their children.')}
          </p>
          <Button size="lg" variant="secondary" className="text-lg h-14 px-10 rounded-full" asChild>
            <Link href="/signup">{t('ابدأ تجربتك المجانية الآن', 'Start Your Free Trial Now')}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
