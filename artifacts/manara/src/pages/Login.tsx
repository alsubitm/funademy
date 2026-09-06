import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useLogin, useGetMe } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation } from 'wouter';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { t, dir } = useI18n();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const loginMutation = useLogin();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  React.useEffect(() => {
    if (user && !isUserLoading) {
      if (user.activeChild) {
        setLocation('/kid');
      } else if (user.role === 'parent') {
        setLocation('/app');
      } else {
        setLocation('/admin');
      }
    }
  }, [user, isUserLoading, setLocation]);

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          if (res.activeChild) {
            setLocation('/kid');
          } else if (res.role === 'parent') {
            setLocation('/app');
          } else {
            setLocation('/admin');
          }
        },
        onError: () => {
          toast({
            title: t('فشل تسجيل الدخول', 'Login Failed'),
            description: t('تأكد من صحة البريد الإلكتروني وكلمة المرور', 'Please check your email and password'),
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
          <h1 className="text-2xl font-bold">{t('مرحباً بعودتك', 'Welcome Back')}</h1>
          <p className="text-muted-foreground mt-2 text-center">
            {t('قم بتسجيل الدخول لمتابعة رحلة أبنائك التعليمية', 'Log in to continue your children\'s learning journey')}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <div className="flex justify-between items-center">
                    <FormLabel>{t('كلمة المرور', 'Password')}</FormLabel>
                    {/* Placeholder for forgot password */}
                    <a href="#" className="text-sm text-primary hover:underline" tabIndex={-1}>
                      {t('نسيت كلمة المرور؟', 'Forgot password?')}
                    </a>
                  </div>
                  <FormControl>
                    <Input type="password" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-12 text-lg" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />}
              {t('تسجيل الدخول', 'Log In')}
            </Button>
          </form>
        </Form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t('ليس لديك حساب؟ ', 'Don\'t have an account? ')}
          <Link href="/signup" className="text-primary font-bold hover:underline">
            {t('سجل الآن', 'Sign up now')}
          </Link>
        </div>
      </div>
    </div>
  );
}
