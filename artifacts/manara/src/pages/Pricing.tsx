import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetMarketingContent } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Check, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function Pricing() {
  const { t } = useI18n();
  const { data, isLoading } = useGetMarketingContent();

  const features = [
    t('حساب عائلي واحد', 'One family account'),
    t('ملفات شخصية غير محدودة للأبناء', 'Unlimited child profiles'),
    t('تغطية شاملة لجميع المناهج الدراسية', 'Comprehensive coverage of all subjects'),
    t('تقارير أسبوعية مفصلة للأداء', 'Detailed weekly performance reports'),
    t('بيئة خالية تماماً من الإعلانات', '100% Ad-free environment'),
    t('دعم فني على مدار الساعة', '24/7 Technical support'),
  ];

  return (
    <div className="py-24 bg-muted/20 min-h-screen">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold mb-4">{t('باقة عائلية واحدة، للجميع', 'One Family Plan, For Everyone')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t(
              'لا توجد رسوم خفية ولا تعقيدات. اشتراك واحد يغطي جميع أبنائك في جميع المراحل الدراسية.',
              'No hidden fees, no complexity. One subscription covers all your children across all grade levels.'
            )}
          </p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[1, 2].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32 bg-muted rounded-t-xl" />
                <CardContent className="h-64" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {data?.plans.map((plan) => {
              const isAnnual = plan.period === 'annual';
              return (
                <Card key={plan.plan} className={`relative flex flex-col ${isAnnual ? 'border-primary shadow-lg scale-105 z-10' : 'border-border/50'}`}>
                  {isAnnual && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                      <span className="bg-primary text-primary-foreground text-sm font-bold py-1 px-4 rounded-full">
                        {t('الأكثر توفيراً', 'Best Value')}
                      </span>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl">{t(plan.plan === 'monthly' ? 'شهري' : 'سنوي', plan.plan === 'monthly' ? 'Monthly' : 'Annual')}</CardTitle>
                    <CardDescription>{t('تدفع ' + (plan.plan === 'monthly' ? 'شهرياً' : 'سنوياً'), 'Billed ' + plan.plan)}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 text-center pt-6">
                    <div className="mb-2">
                      <span className="text-5xl font-black">{plan.priceSar}</span>
                      <span className="text-muted-foreground font-medium"> {t('ريال', 'SAR')} / {t(plan.plan === 'monthly' ? 'شهر' : 'سنة', plan.plan === 'monthly' ? 'mo' : 'yr')}</span>
                    </div>
                    {plan.savingsPercent && (
                      <p className="text-primary font-medium text-sm mb-6">
                        {t(`وفر ${plan.savingsPercent}%`, `Save ${plan.savingsPercent}%`)}
                      </p>
                    )}
                    
                    <ul className="text-start space-y-4 mt-8">
                      {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-primary shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-6">
                    <Button 
                      className="w-full h-12 text-lg rounded-xl" 
                      variant={isAnnual ? 'default' : 'outline'}
                      asChild
                    >
                      <Link href={`/signup?plan=${plan.plan}`}>
                        {t('ابدأ تجربتك المجانية', 'Start Free Trial')}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <p>{t('جميع الخطط تتضمن 7 أيام تجربة مجانية. لا يتم الخصم إلا بعد انتهاء الفترة التجريبية.', 'All plans include a 7-day free trial. You won\'t be charged until the trial ends.')}</p>
        </div>
      </div>
    </div>
  );
}
