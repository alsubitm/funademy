import React from 'react';
import { useRoute, Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import {
  useGetSessionDetail,
  useGetSessionJoinLink,
  useListSessionMaterials,
  useListMyBookings,
  useBookSession,
  useCancelSessionBooking,
  getGetSessionDetailQueryKey,
  getGetSessionJoinLinkQueryKey,
  getListSessionMaterialsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  CalendarClock,
  Users,
  User,
  Video,
  Clock,
  ChevronRight,
  ChevronLeft,
  FileText,
  Link as LinkIcon,
  StickyNote,
  Lock,
} from 'lucide-react';
import { SessionPriceBadge } from '@/components/sessions/SessionCard';
import { BookingStatusBadge } from '@/components/sessions/BookingStatusBadge';
import {
  apiError,
  formatCountdown,
  formatDateTime,
  formatSar,
  type JoinLinkView,
  type MyBooking,
  type SessionMaterial,
  type SessionView,
} from '@/components/sessions/types';

const JOIN_REVEAL_MS = 15 * 60_000;

function MaterialIcon({ kind }: { kind: string }) {
  if (kind === 'file') return <FileText className="w-4 h-4 text-primary" />;
  if (kind === 'note') return <StickyNote className="w-4 h-4 text-primary" />;
  return <LinkIcon className="w-4 h-4 text-primary" />;
}

export default function SessionDetail() {
  const { t, lang, dir } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute('/app/sessions/:id');
  const id = params?.id ? parseInt(params.id, 10) : NaN;
  const ChevronBack = dir === 'rtl' ? ChevronRight : ChevronLeft;

  const [now, setNow] = React.useState<number>(() => Date.now());
  const [showBook, setShowBook] = React.useState(false);
  const [showCancel, setShowCancel] = React.useState(false);

  const detailQuery = useGetSessionDetail(id, {
    query: { enabled: !Number.isNaN(id), queryKey: getGetSessionDetailQueryKey(id) },
  });
  // Poll bookings while the page is open so a server-side waitlist promotion
  // (waitlisted → booked) is picked up without a manual refresh.
  const bookingsQuery = useListMyBookings({
    query: { refetchInterval: 30_000 },
  });
  const bookMutation = useBookSession();
  const cancelMutation = useCancelSessionBooking();

  const session = detailQuery.data as SessionView | undefined;
  const bookings = (bookingsQuery.data as MyBooking[] | undefined) ?? [];
  const myBooking = bookings.find((b) => b.sessionId === id && b.status !== 'cancelled');
  const isActiveParticipant =
    myBooking?.status === 'booked' || myBooking?.status === 'attended';

  const startMs = session ? new Date(session.startsAt).getTime() : 0;
  const revealAt = startMs - JOIN_REVEAL_MS;
  const endMs = session ? startMs + session.durationMinutes * 60_000 : 0;
  const withinJoinWindow = session ? now >= revealAt && now <= endMs : false;

  // Materials — only fetch for active participants (backend gates with 403).
  const materialsQuery = useListSessionMaterials(id, {
    query: {
      enabled: !Number.isNaN(id) && !!isActiveParticipant,
      retry: false,
      queryKey: getListSessionMaterialsQueryKey(id),
    },
  });
  const materialsForbidden = apiError(materialsQuery.error).status === 403;
  const materials = (materialsQuery.data as SessionMaterial[] | undefined) ?? [];

  // Join link — enabled only for active participants once near start; poll near start.
  const joinEnabled = !Number.isNaN(id) && !!isActiveParticipant && withinJoinWindow;
  const joinQuery = useGetSessionJoinLink(id, {
    query: {
      enabled: joinEnabled,
      retry: false,
      refetchInterval: joinEnabled ? 30_000 : false,
      queryKey: getGetSessionJoinLinkQueryKey(id),
    },
  });
  const joinLink = joinQuery.data as JoinLinkView | undefined;

  // Tick every second while approaching the reveal window for a live countdown.
  React.useEffect(() => {
    if (!session) return;
    if (now > endMs) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session, endMs, now]);

  const refetchAll = () => queryClient.invalidateQueries();

  const doBook = (paymentMethod?: string) => {
    bookMutation.mutate(
      { id, data: paymentMethod ? { paymentMethod: paymentMethod as any } : undefined },
      {
        onSuccess: (res: any) => {
          setShowBook(false);
          refetchAll();
          toast({
            title: res?.waitlisted ? t('أُضفت لقائمة الانتظار', 'Added to waitlist') : t('تم الحجز', 'Booked'),
            description: res?.waitlisted
              ? t('سنعلمك فور توفر مقعد.', 'We will notify you when a seat opens.')
              : t('تم تأكيد حجزك.', 'Your booking is confirmed.'),
          });
        },
        onError: (err) => {
          const e = apiError(err);
          if (e.status !== 402) setShowBook(false);
          toast({
            variant: 'destructive',
            title: e.status === 402 ? t('الجلسة مدفوعة', 'Paid session') : t('تعذّر الحجز', 'Booking failed'),
            description: e.data?.message ?? t('حدث خطأ ما.', 'Something went wrong.'),
          });
        },
      },
    );
  };

  const doCancel = () => {
    cancelMutation.mutate(
      { id },
      {
        onSuccess: () => {
          setShowCancel(false);
          refetchAll();
          toast({ title: t('تم إلغاء الحجز', 'Booking cancelled') });
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

  if (Number.isNaN(id)) {
    return <div className="p-8 text-center text-muted-foreground">{t('جلسة غير صالحة', 'Invalid session')}</div>;
  }

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Card className="h-40 animate-pulse bg-muted/40" />
        <Card className="h-64 animate-pulse bg-muted/40" />
      </div>
    );
  }

  if (detailQuery.isError || !session) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/app/sessions">
            <ChevronBack className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('العودة للجلسات', 'Back to sessions')}
          </Link>
        </Button>
        <Card className="p-10 text-center border-dashed">
          <CardTitle className="mb-2">{t('الجلسة غير موجودة', 'Session not found')}</CardTitle>
          <p className="text-muted-foreground">
            {t('قد تكون الجلسة أُلغيت أو حُذفت.', 'The session may have been cancelled or removed.')}
          </p>
        </Card>
      </div>
    );
  }

  const isPaid = !!session.priceSar && session.priceSar > 0;
  const full = session.seatsLeft <= 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Button variant="ghost" asChild className="-ms-2">
        <Link href="/app/sessions">
          <ChevronBack className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {t('العودة للجلسات', 'Back to sessions')}
        </Link>
      </Button>

      <Card className="overflow-hidden">
        <div className="h-1.5 w-full bg-primary" />
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-2xl">{session.title}</CardTitle>
                {myBooking && <BookingStatusBadge status={myBooking.status} />}
              </div>
              {session.program && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md w-fit inline-block">
                  {session.program}
                </span>
              )}
            </div>
            <SessionPriceBadge session={session} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="w-4 h-4 text-primary shrink-0" />
              <span>{formatDateTime(session.startsAt, lang)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{t(`${session.durationMinutes} دقيقة`, `${session.durationMinutes} minutes`)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4 shrink-0" />
              <span>{t('المعلّم', 'Teacher')} #{session.teacherId}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4 shrink-0" />
              <span>
                {full
                  ? t('الجلسة مكتملة', 'Full')
                  : t(`${session.seatsLeft} مقعد متبقٍ من ${session.capacity}`, `${session.seatsLeft} of ${session.capacity} seats left`)}
              </span>
            </div>
          </div>

          {session.description && (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap border-t pt-4">
              {session.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {!myBooking && session.status === 'scheduled' && (
              <Button onClick={() => setShowBook(true)} disabled={bookMutation.isPending} variant={full ? 'outline' : 'default'}>
                {full ? t('انضم لقائمة الانتظار', 'Join waitlist') : t('احجز الآن', 'Book now')}
              </Button>
            )}
            {(myBooking?.status === 'booked' || myBooking?.status === 'waitlisted') && (
              <Button variant="outline" className="text-destructive" onClick={() => setShowCancel(true)} disabled={cancelMutation.isPending}>
                {t('إلغاء الحجز', 'Cancel booking')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Join link section — only for active participants */}
      {isActiveParticipant && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              {t('رابط الانضمام', 'Join link')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {now > endMs ? (
              <p className="text-sm text-muted-foreground">{t('انتهت الجلسة.', 'This session has ended.')}</p>
            ) : now < revealAt ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'يُتاح رابط الانضمام قبل ١٥ دقيقة من بداية الجلسة.',
                    'The join link becomes available 15 minutes before the session starts.',
                  )}
                </p>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="w-4 h-4 text-primary" />
                  {t('يُتاح خلال', 'Available in')}: {formatCountdown(revealAt - now, lang)}
                </div>
                <Button disabled variant="outline">
                  <Lock className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('الرابط غير متاح بعد', 'Link not available yet')}
                </Button>
              </div>
            ) : joinQuery.isLoading ? (
              <div className="h-10 w-40 bg-muted rounded animate-pulse" />
            ) : joinLink?.meetingLink ? (
              <Button asChild>
                <a href={joinLink.meetingLink} target="_blank" rel="noreferrer">
                  <Video className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('انضم للجلسة الآن', 'Join session now')}
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {apiError(joinQuery.error).data?.message ??
                  t('رابط الانضمام غير متاح حالياً.', 'The join link is not available right now.')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Materials section — gated */}
      {isActiveParticipant && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t('مواد الجلسة', 'Session materials')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {materialsQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : materialsForbidden ? (
              <p className="text-sm text-muted-foreground">
                {t('تُتاح المواد للمشتركين المؤكدين في الجلسة.', 'Materials are available to confirmed participants.')}
              </p>
            ) : materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('لا توجد مواد بعد.', 'No materials yet.')}</p>
            ) : (
              <ul className="space-y-2">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-start gap-2 text-sm border-b last:border-b-0 pb-2 last:pb-0">
                    <MaterialIcon kind={m.kind} />
                    <div className="flex-1">
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                          {m.title}
                        </a>
                      ) : (
                        <span className="font-medium">{m.title}</span>
                      )}
                      {m.content && <p className="text-muted-foreground whitespace-pre-wrap mt-0.5">{m.content}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Book dialog */}
      <Dialog open={showBook} onOpenChange={setShowBook}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('تأكيد الحجز', 'Confirm booking')}</DialogTitle>
            <DialogDescription>
              {session.title}
              <br />
              {formatDateTime(session.startsAt, lang)}
            </DialogDescription>
          </DialogHeader>
          {isPaid ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{t('هذه جلسة مدفوعة. اختر طريقة الدفع:', 'This is a paid session. Choose a payment method:')}</p>
              <div className="grid gap-2">
                {session.includedInSubscription && (
                  <Button variant="outline" className="justify-start" onClick={() => doBook('subscription')} disabled={bookMutation.isPending}>
                    {t('استخدام الاشتراك', 'Use subscription')}
                  </Button>
                )}
                <Button variant="outline" className="justify-start" onClick={() => doBook('package')} disabled={bookMutation.isPending}>
                  {t('استخدام رصيد باقة', 'Use package credit')}
                </Button>
                <Button className="justify-start" onClick={() => doBook('single')} disabled={bookMutation.isPending}>
                  {t(`شراء مفرد — ${formatSar(session.priceSar!, lang)}`, `Single purchase — ${formatSar(session.priceSar!, lang)}`)}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('هذه جلسة مجانية. أكّد لإتمام الحجز.', 'This is a free session. Confirm to book.')}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowBook(false)} disabled={bookMutation.isPending}>
              {t('إلغاء', 'Cancel')}
            </Button>
            {!isPaid && (
              <Button onClick={() => doBook()} disabled={bookMutation.isPending}>
                {t('تأكيد الحجز', 'Confirm')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('تأكيد الإلغاء', 'Confirm cancellation')}</DialogTitle>
            <DialogDescription>
              {t(
                'هل أنت متأكد من إلغاء حجزك؟ لا يمكن الإلغاء قبل أقل من ساعتين من موعد الجلسة.',
                'Are you sure you want to cancel? Cancellation is not allowed within 2 hours of the session.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCancel(false)} disabled={cancelMutation.isPending}>
              {t('تراجع', 'Back')}
            </Button>
            <Button variant="destructive" onClick={doCancel} disabled={cancelMutation.isPending}>
              {t('تأكيد الإلغاء', 'Cancel booking')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
