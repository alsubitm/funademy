import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useLogin, useGetMe, logout } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation } from 'wouter';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2, ShieldAlert, LogOut } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

function isAdminOnlyRedirect(redirect: string): boolean {
  // Admin-only destinations: Manara admin pages and the Watanona tracking dashboard
  const path = redirect.split('?')[0].split('#')[0];
  return path.includes('/admin') || path.includes('/track');
}

function getSafeRedirect(): string | null {
  const raw = new URLSearchParams(window.location.search).get('redirect');
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    // Only allow same-origin redirects to avoid open-redirect abuse
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export default function Login() {
  const { t, dir } = useI18n();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const loginMutation = useLogin();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [loggedOut, setLoggedOut] = React.useState(false);

  const isAdminUser = (role: string) => role === 'admin' || role === 'teacher';

  const redirect = getSafeRedirect();
  const needsAdminAccount = Boolean(
    !loggedOut &&
      user &&
      !isUserLoading &&
      redirect &&
      isAdminOnlyRedirect(redirect) &&
      (user.activeChild || !isAdminUser(user.role))
  );

  const handleSwitchAccount = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLoggedOut(true);
      form.reset();
    } catch {
      toast({
        title: t('تعذّر تسجيل الخروج', 'Logout failed'),
        description: t('حاول مرة أخرى', 'Please try again'),
        variant: 'destructive',
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  React.useEffect(() => {
    if (user && !isUserLoading && !loggedOut) {
      const redirect = getSafeRedirect();
      if (redirect) {
        if (isAdminOnlyRedirect(redirect) && (user.activeChild || !isAdminUser(user.role))) {
          // Don't redirect blindly — the destination requires an admin account.
          return;
        }
        window.location.href = redirect;
        return;
      }
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
          setLoggedOut(false);
          const redirect = getSafeRedirect();
          if (redirect) {
            if (isAdminOnlyRedirect(redirect) && (res.activeChild || !isAdminUser(res.role))) {
              // Logged in with a non-admin account while heading to an admin page
              return;
            }
            window.location.href = redirect;
            return;
          }
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

  if (needsAdminAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <div className="max-w-md w-full bg-card rounded-2xl shadow-xl border p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">{t('هذه الصفحة تتطلب حساب مشرف', 'Admin account required')}</h1>
            <p className="text-muted-foreground mt-2">
              {t(
                'أنت مسجّل الدخول حالياً بحساب لا يملك صلاحيات الإدارة، والصفحة المطلوبة مخصصة للمشرفين فقط. سجّل الخروج ثم ادخل بحساب مشرف للمتابعة.',
                'You are currently signed in with an account that does not have admin permissions, and the requested page is for admins only. Log out and sign in with an admin account to continue.'
              )}
            </p>
            <Button
              onClick={handleSwitchAccount}
              disabled={isLoggingOut}
              className="w-full h-12 text-lg mt-6"
            >
              {isLoggingOut ? (
                <Loader2 className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />
              ) : (
                <LogOut className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
              )}
              {t('تسجيل الخروج والدخول بحساب مشرف', 'Log out and sign in as admin')}
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 mt-3"
              onClick={() => {
                if (user?.activeChild) {
                  setLocation('/kid');
                } else if (user?.role === 'parent') {
                  setLocation('/app');
                } else {
                  setLocation('/');
                }
              }}
            >
              {t('البقاء في حسابي الحالي', 'Stay in my current account')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
