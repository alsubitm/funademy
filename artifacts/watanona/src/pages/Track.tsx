import { useGetWatanStats, logout } from '@workspace/api-client-react';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Link } from 'wouter';
import { ArrowRight, TrendingUp, TrendingDown, Minus, Lock } from 'lucide-react';
import { MilestoneCelebration } from '@/components/MilestoneCelebration';

const chartConfig = {
  count: {
    label: 'مكعبات',
    color: 'hsl(142 71% 45%)',
  },
} satisfies ChartConfig;

const dayFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  day: 'numeric',
  month: 'short',
});

function formatDay(iso: string) {
  return dayFormatter.format(new Date(`${iso}T12:00:00+03:00`));
}

const numberFormatter = new Intl.NumberFormat('ar-SA-u-nu-latn');

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="bg-card/60 border-white/10 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-white/60">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${accent ?? 'text-white'}`}>
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-white/50">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function AccessDenied({ isForbidden }: { isForbidden: boolean }) {
  const [switching, setSwitching] = useState(false);

  const handleSwitchAccount = async () => {
    setSwitching(true);
    try {
      await logout();
    } catch {
      // ignore — proceed to the login page either way
    }
    window.location.href = `/manara/login?redirect=${encodeURIComponent(window.location.href)}`;
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen w-full bg-background text-white flex items-center justify-center px-4"
    >
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-white/10 p-5">
            <Lock className="h-10 w-10 text-white/60" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">لوحة إدارية</h1>
          <p className="text-white/60 text-sm">
            هذه الصفحة مخصصة للمشرفين فقط. سجّل دخولك بحساب أدمن منارة للمتابعة.
          </p>
        </div>
        <a
          href="/"
          className="inline-block w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          العودة للصفحة الرئيسية
        </a>
        {isForbidden ? (
          <button
            type="button"
            onClick={handleSwitchAccount}
            disabled={switching}
            className="inline-block w-full rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {switching
              ? 'جارٍ تسجيل الخروج…'
              : 'تسجيل الخروج والدخول بحساب آخر'}
          </button>
        ) : (
          <a
            href={`/manara/login?redirect=${encodeURIComponent(window.location.href)}`}
            className="inline-block w-full rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            تسجيل دخول منارة
          </a>
        )}
      </div>
    </main>
  );
}

export default function Track() {
  const { data, isLoading, isError, error } = useGetWatanStats({
    query: { queryKey: ['watan-stats'], refetchInterval: 30000, retry: false },
  });

  // Check if the error is an auth error (401 or 403)
  const isAuthError =
    isError &&
    error != null &&
    typeof (error as { status?: number }).status === 'number' &&
    ((error as { status: number }).status === 401 ||
      (error as { status: number }).status === 403);

  if (isAuthError) {
    return (
      <AccessDenied
        isForbidden={(error as { status: number }).status === 403}
      />
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen w-full bg-background text-white px-4 py-10 md:px-10"
    >
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-secondary font-medium mb-1">
              أطفالنا يبنون وطننا
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">
              لوحة تتبّع الحملة
            </h1>
            <p className="mt-2 text-white/60">
              عدد المكعبات المضافة يومياً ونمو الحملة قبل اليوم الوطني
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            العودة للحملة
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </header>

        {isError && !isAuthError && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="py-6 text-center text-white/80">
              تعذّر تحميل إحصاءات الحملة. حاول تحديث الصفحة.
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl bg-white/5" />
            ))}
          </div>
        )}

        {data && (
          <>
            <MilestoneCelebration progressPercent={data.progressPercent} />
            <Card className="bg-card/60 border-white/10 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-lg">
                  <span>هدف الحملة قبل اليوم الوطني</span>
                  <span className="text-sm font-normal text-white/60">
                    {numberFormatter.format(data.goal)} مكعب
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-primary to-secondary transition-all duration-700"
                    style={{ width: `${Math.min(100, data.progressPercent)}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-primary">
                    اكتمل {numberFormatter.format(data.progressPercent)}٪
                  </span>
                  <span className="text-white/60">
                    {data.remaining > 0
                      ? `متبقٍّ ${numberFormatter.format(data.remaining)} مكعب لتحقيق الهدف`
                      : 'تحقّق الهدف — مبروك! 🎉'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <StatCard
                label="إجمالي المكعبات"
                value={numberFormatter.format(data.total)}
                accent="text-primary"
              />
              <StatCard
                label="مكعبات اليوم"
                value={numberFormatter.format(data.today)}
                hint={`أمس: ${numberFormatter.format(data.yesterday)}`}
              />
              <StatCard
                label="النمو اليومي"
                value={
                  data.growthPercent === null
                    ? '—'
                    : `${numberFormatter.format(Math.abs(data.growthPercent))}٪`
                }
                accent={
                  data.growthPercent === null
                    ? 'text-white/60'
                    : data.growthPercent >= 0
                      ? 'text-primary'
                      : 'text-destructive'
                }
                hint={
                  data.growthPercent === null ? (
                    'لا توجد بيانات للمقارنة'
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {data.growthPercent > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : data.growthPercent < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      مقارنة بالأمس
                    </span>
                  )
                }
              />
              <StatCard
                label="أيام حتى اليوم الوطني"
                value={numberFormatter.format(data.daysRemaining)}
                accent="text-secondary"
                hint="23 سبتمبر"
              />
            </div>

            <Card className="bg-card/60 border-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg">
                  المكعبات المضافة يومياً — آخر 14 يوماً
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-72 w-full">
                  <BarChart data={data.daily} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDay}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                      reversed
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      orientation="right"
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => formatDay(String(value))}
                        />
                      }
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--color-count)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-white/40">
              تُحدَّث البيانات تلقائياً كل 30 ثانية · التواريخ بتوقيت الرياض
            </p>
          </>
        )}
      </div>
    </main>
  );
}
