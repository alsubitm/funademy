import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useRegister } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useSearch } from 'wouter';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2 } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  pin: z.string().length(4, 'PIN must be exactly 4 digits').regex(/^\d+$/, 'PIN must be numeric'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Signup() {
  const { t, dir } = useI18n();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const planParam = new URLSearchParams(searchString).get('plan') || 'annual';
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      pin: '',
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(
      { data },
      {
        onSuccess: () => {
          // After successful registration, they need to subscribe.
          // The API might log them in automatically, or they might need to go to /app/subscription
          setLocation(`/app/subscription?plan=${planParam}`);
        },
        onError: (err) => {
          toast({
            title: t('فشل التسجيل', 'Registration Failed'),
            description: err.message || t('حدث خطأ غير متوقع', 'An unexpected error occurred'),
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl border p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">{t('إنشاء حساب عائلي', 'Create Family Account')}</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            {t('سجل الآن واحصل على 7 أيام تجربة مجانية. إلغاء في أي وقت.', 'Sign up now for a 7-day free trial. Cancel anytime.')}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('اسم ولي الأمر', 'Parent\'s Name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('أحمد عبدالله', 'Ahmed Abdullah')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('البريد الإلكتروني', 'Email')}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="name@example.com" dir="ltr" className={dir === 'rtl' ? 'text-right' : ''} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('كلمة المرور', 'Password')}</FormLabel>
                  <FormControl>
                    <Input type="password" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('رمز PIN لولي الأمر (4 أرقام)', 'Parent PIN (4 digits)')}</FormLabel>
                  <FormControl>
                    <Input type="text" inputMode="numeric" pattern="\d*" maxLength={4} dir="ltr" className={`text-center tracking-widest text-xl ${dir === 'rtl' ? 'text-right' : ''}`} placeholder="••••" {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('يستخدم هذا الرمز لحماية إعداداتك ومنع الأطفال من الخروج من التطبيق.', 'Used to protect settings and prevent children from exiting the app.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-12 text-lg mt-2" disabled={registerMutation.isPending}>
              {registerMutation.isPending && <Loader2 className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />}
              {t('متابعة لإنشاء الحساب', 'Continue')}
            </Button>
          </form>
        </Form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t('لديك حساب بالفعل؟ ', 'Already have an account? ')}
          <Link href="/login" className="text-primary font-bold hover:underline">
            {t('تسجيل الدخول', 'Log in')}
          </Link>
        </div>
      </div>
    </div>
  );
}
