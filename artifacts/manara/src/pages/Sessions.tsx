import React from 'react';
import { useI18n } from '@/lib/i18n';
import {
  useListSessions,
  useListMyBookings,
  useListMySessionPackages,
  usePurchaseSessionPackage,
  useBookSession,
  useCancelSessionBooking,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { CalendarClock, Ticket, Package, PlusCircle, Video } from 'lucide-react';
import { SessionCard } from '@/components/sessions/SessionCard';
import { BookingStatusBadge } from '@/components/sessions/BookingStatusBadge';
import { NotificationsPanel } from '@/components/sessions/NotificationsPanel';
import {
  apiError,
  formatDateTime,
  formatSar,
  type MyBooking,
  type SessionPackage,
  type SessionView,
} from '@/components/sessions/types';

const PACKAGE_PRICE_PER_CREDIT_SAR = 40;
const PACKAGE_OPTIONS = [4, 8, 12];

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
      <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <CardTitle className="mb-2">{title}</CardTitle>
      <p className="text-muted-foreground max-w-md">{hint}</p>
    </Card>
  );
}

export default function Sessions() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sessionsQuery = useListSessions();
  const bookingsQuery = useListMyBookings();
  const packagesQuery = useListMySessionPackages();

  const bookMutation = useBookSession();
  const cancelMutation = useCancelSessionBooking();
  const purchaseMutation = usePurchaseSessionPackage();

  const [bookTarget, setBookTarget] = React.useState<SessionView | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<MyBooking | null>(null);
  const [purchaseCredits, setPurchaseCredits] = React.useState<number | null>(null);

  const sessions = (sessionsQuery.data as SessionView[] | undefined) ?? [];
  const bookings = (bookingsQuery.data as MyBooking[] | undefined) ?? [];
  const packages = (packagesQuery.data as SessionPackage[] | undefined) ?? [];

  const upcoming = [...sessions]
    .filter((s) => s.status === 'scheduled')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const refetchAll = () => {
    queryClient.invalidateQueries();
  };

  const doBook = (session: SessionView, paymentMethod?: string) => {
    bookMutation.mutate(
      { id: session.id, data: paymentMethod ? { paymentMethod: paymentMethod as any } : undefined },
      {
        onSuccess: (res: any) => {
          setBookTarget(null);
          refetchAll();
          if (res?.waitlisted) {
            toast({
              title: t('أُضفت لقائمة الانتظار', 'Added to waitlist'),
              description: t(
                'الجلسة مكتملة حالياً وسنعلمك فور توفر مقعد.',
                'The session is full — we will notify you when a seat opens.',
              ),
            });
          } else {
            toast({
              title: t('تم الحجز', 'Booked'),
              description: t('تم تأكيد حجزك بنجاح.', 'Your booking is confirmed.'),
            });
          }
        },
        onError: (err) => {
          const e = apiError(err);
          if (e.status === 402) {
            // Payment required — keep dialog open so the user can pick a paid method.
            toast({
              variant: 'destructive',
              title: t('الجلسة مدفوعة', 'Paid session'),
              description:
                e.data?.message ??
                t(
                  'يلزم اشتراك فعّال أو رصيد باقة أو شراء مفرد.',
                  'An active subscription, package credit, or single purchase is required.',
                ),
            });
          } else {
            setBookTarget(null);
            toast({
              variant: 'destructive',
              title: t('تعذّر الحجز', 'Booking failed'),
              description: e.data?.message ?? t('حدث خطأ ما.', 'Something went wrong.'),
            });
          }
        },
      },
    );
  };

  const doCancel = (booking: MyBooking) => {
    cancelMutation.mutate(
      { id: booking.sessionId },
      {
        onSuccess: () => {
          setCancelTarget(null);
          refetchAll();
          toast({
            title: t('تم إلغاء الحجز', 'Booking cancelled'),
            description: t('تم إلغاء حجزك بنجاح.', 'Your booking has been cancelled.'),
          });
        },
        onError: (err) => {
          const e = apiError(err);
          toast({
            variant: 'destructive',
            title: t('تعذّر الإلغاء', 'Cancel failed'),
            description: e.data?.message ?? t('حدث خطأ ما.', 'Something went wrong.'),
          });
        },
      },
    );
  };

  const doPurchase = (credits: number) => {
    purchaseMutation.mutate(
      { data: { credits } },
      {
        onSuccess: () => {
          setPurchaseCredits(null);
          refetchAll();
          toast({
            title: t('تم شراء الباقة', 'Package purchased'),
            description: t('أُضيف الرصيد إلى حسابك.', 'Credits added to your account.'),
          });
        },
        onError: (err) => {
          const e = apiError(err);
          setPurchaseCredits(null);
          toast({
            variant: 'destructive',
            title: t('تعذّر إتمام الدفع', 'Payment failed'),
            description: e.data?.message ?? t('حدث خطأ ما.', 'Something went wrong.'),
          });
        },
      },
    );
  };

  const isPaid = bookTarget && !!bookTarget.priceSar && bookTarget.priceSar > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('الجلسات المباشرة', 'Live Sessions')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('احجز الجلسات المباشرة وتابع حجوزاتك وباقاتك.', 'Book live sessions and track your bookings and packages.')}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">{t('الجلسات القادمة', 'Upcoming')}</TabsTrigger>
            <TabsTrigger value="bookings">{t('حجوزاتي', 'My bookings')}</TabsTrigger>
            <TabsTrigger value="packages">{t('باقاتي', 'My packages')}</TabsTrigger>
          </TabsList>

          {/* Upcoming */}
          <TabsContent value="upcoming" className="space-y-4">
            {sessionsQuery.isLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <Card key={i} className="h-56 animate-pulse bg-muted/40" />
                ))}
              </div>
            ) : sessionsQuery.isError ? (
              <EmptyState
                icon={CalendarClock}
                title={t('تعذّر تحميل الجلسات', 'Could not load sessions')}
                hint={t('حاول تحديث الصفحة لاحقاً.', 'Please try refreshing later.')}
              />
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={t('لا توجد جلسات قادمة', 'No upcoming sessions')}
                hint={t('تحقق لاحقاً — سنضيف جلسات جديدة قريباً.', 'Check back soon — new sessions will be added.')}
              />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {upcoming.map((s) => (
                  <SessionCard key={s.id} session={s} onBook={setBookTarget} booking={bookMutation.isPending} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* My bookings */}
          <TabsContent value="bookings" className="space-y-4">
            {bookingsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="h-24 animate-pulse bg-muted/40" />
                ))}
              </div>
            ) : bookingsQuery.isError ? (
              <EmptyState
                icon={Ticket}
                title={t('تعذّر تحميل الحجوزات', 'Could not load bookings')}
                hint={t('حاول لاحقاً.', 'Please try again later.')}
              />
            ) : bookings.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title={t('لا توجد حجوزات', 'No bookings')}
                hint={t('احجز جلسة من تبويب الجلسات القادمة.', 'Book a session from the Upcoming tab.')}
              />
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => {
                  const canCancel = b.status === 'booked' || b.status === 'waitlisted';
                  return (
                    <Card key={b.id}>
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/app/sessions/${b.sessionId}`}
                              className="font-semibold hover:text-primary transition-colors"
                            >
                              {b.session?.title ?? t('جلسة', 'Session') + ` #${b.sessionId}`}
                            </Link>
                            <BookingStatusBadge status={b.status} />
                          </div>
                          {b.session && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <CalendarClock className="w-3.5 h-3.5" />
                              {formatDateTime(b.session.startsAt, lang)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/app/sessions/${b.sessionId}`}>{t('التفاصيل', 'Details')}</Link>
                          </Button>
                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setCancelTarget(b)}
                            >
                              {t('إلغاء', 'Cancel')}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* My packages */}
          <TabsContent value="packages" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t('رصيد الباقات', 'Package credits')}</h2>
            </div>

            {packagesQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="h-20 animate-pulse bg-muted/40" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t('لا توجد باقات', 'No packages')}
                hint={t('اشترِ باقة لحجز الجلسات المدفوعة برصيد.', 'Buy a package to book paid sessions with credits.')}
              />
            ) : (
              <div className="space-y-3">
                {packages.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t(
                            `${p.remainingCredits} من ${p.totalCredits} جلسة متبقية`,
                            `${p.remainingCredits} of ${p.totalCredits} sessions remaining`,
                          )}
                        </p>
                      </div>
                      <Badge variant={p.paymentState === 'charged' ? 'default' : 'secondary'}>
                        {p.paymentState === 'charged'
                          ? t('مفعّلة', 'Active')
                          : t('قيد الدفع', 'Pending')}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('شراء باقة جديدة', 'Buy a new package')}</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-3">
                {PACKAGE_OPTIONS.map((credits) => (
                  <Card key={credits} className="p-4 flex flex-col items-center text-center gap-2">
                    <span className="text-2xl font-bold">{credits}</span>
                    <span className="text-sm text-muted-foreground">{t('جلسات', 'sessions')}</span>
                    <span className="font-semibold text-primary">
                      {formatSar(credits * PACKAGE_PRICE_PER_CREDIT_SAR, lang)}
                    </span>
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      onClick={() => setPurchaseCredits(credits)}
                      disabled={purchaseMutation.isPending}
                    >
                      <PlusCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                      {t('شراء', 'Buy')}
                    </Button>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-6">
          <NotificationsPanel />
        </div>
      </div>

      {/* Book dialog */}
      <Dialog open={!!bookTarget} onOpenChange={(o) => !o && setBookTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              {t('تأكيد الحجز', 'Confirm booking')}
            </DialogTitle>
            <DialogDescription>
              {bookTarget && (
                <>
                  {bookTarget.title}
                  <br />
                  {formatDateTime(bookTarget.startsAt, lang)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {isPaid ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {t(
                  'هذه جلسة مدفوعة. اختر طريقة الدفع:',
                  'This is a paid session. Choose a payment method:',
                )}
              </p>
              <div className="grid gap-2">
                {bookTarget?.includedInSubscription && (
                  <Button variant="outline" className="justify-start" onClick={() => doBook(bookTarget!, 'subscription')} disabled={bookMutation.isPending}>
                    {t('استخدام الاشتراك', 'Use subscription')}
                  </Button>
                )}
                <Button variant="outline" className="justify-start" onClick={() => doBook(bookTarget!, 'package')} disabled={bookMutation.isPending}>
                  {t('استخدام رصيد باقة', 'Use package credit')}
                </Button>
                <Button className="justify-start" onClick={() => doBook(bookTarget!, 'single')} disabled={bookMutation.isPending}>
                  {t(
                    `شراء مفرد — ${formatSar(bookTarget!.priceSar!, lang)}`,
                    `Single purchase — ${formatSar(bookTarget!.priceSar!, lang)}`,
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('هذه جلسة مجانية. أكّد لإتمام الحجز.', 'This is a free session. Confirm to book.')}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBookTarget(null)} disabled={bookMutation.isPending}>
              {t('إلغاء', 'Cancel')}
            </Button>
            {!isPaid && (
              <Button onClick={() => bookTarget && doBook(bookTarget)} disabled={bookMutation.isPending}>
                {t('تأكيد الحجز', 'Confirm')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('تأكيد الإلغاء', 'Confirm cancellation')}</DialogTitle>
            <DialogDescription>
              {t(
                'هل أنت متأكد من إلغاء حجزك في هذه الجلسة؟ لا يمكن الإلغاء قبل أقل من ساعتين من موعد الجلسة.',
                'Are you sure you want to cancel this booking? Cancellation is not allowed within 2 hours of the session.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={cancelMutation.isPending}>
              {t('تراجع', 'Back')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelTarget && doCancel(cancelTarget)}
              disabled={cancelMutation.isPending}
            >
              {t('تأكيد الإلغاء', 'Cancel booking')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase confirmation dialog */}
      <Dialog open={purchaseCredits !== null} onOpenChange={(o) => !o && setPurchaseCredits(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('تأكيد شراء الباقة', 'Confirm package purchase')}</DialogTitle>
            <DialogDescription>
              {purchaseCredits !== null &&
                t(
                  `ستحصل على ${purchaseCredits} جلسة مقابل ${formatSar(
                    purchaseCredits * PACKAGE_PRICE_PER_CREDIT_SAR,
                    lang,
                  )}.`,
                  `You will get ${purchaseCredits} sessions for ${formatSar(
                    purchaseCredits * PACKAGE_PRICE_PER_CREDIT_SAR,
                    lang,
                  )}.`,
                )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPurchaseCredits(null)} disabled={purchaseMutation.isPending}>
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={() => purchaseCredits !== null && doPurchase(purchaseCredits)}
              disabled={purchaseMutation.isPending}
            >
              {t('تأكيد الشراء والدفع', 'Confirm & pay')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
