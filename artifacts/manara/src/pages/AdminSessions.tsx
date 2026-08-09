import React from 'react';
import {
  useListSessions,
  useListSessionSeries,
  useUpdateLiveSession,
  useGetMe,
  getListSessionsQueryKey,
  type LiveSessionView,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  PlusCircle,
  MoreVertical,
  Pencil,
  Users,
  XCircle,
  CalendarClock,
  Layers,
} from 'lucide-react';
import { SessionFormDialog } from '@/components/admin/sessions/SessionFormDialog';
import { SeriesFormDialog } from '@/components/admin/sessions/SeriesFormDialog';
import { SessionDetailDrawer } from '@/components/admin/sessions/SessionDetailDrawer';
import type { SessionSeries } from '@/components/admin/sessions/shared';
import { apiErrorMessage, formatDateTime, formatPrice } from '@/components/admin/sessions/shared';

export default function AdminSessions() {
  const { t, lang } = useI18n();
  const isAr = lang === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: me } = useGetMe();
  const isAdmin = me?.role === 'admin';

  const [timeFilter, setTimeFilter] = React.useState<'upcoming' | 'past'>('upcoming');
  const includePast = timeFilter === 'past';

  const params = { includePast };
  const {
    data: sessions,
    isLoading,
    isError,
    error,
  } = useListSessions(params, { query: { queryKey: getListSessionsQueryKey(params) } });

  const { data: seriesRaw, isLoading: seriesLoading } = useListSessionSeries();
  const series = (seriesRaw as unknown as SessionSeries[] | undefined) ?? [];

  const updateMutation = useUpdateLiveSession();

  // Dialog / drawer state
  const [sessionDialogOpen, setSessionDialogOpen] = React.useState(false);
  const [editingSession, setEditingSession] = React.useState<LiveSessionView | null>(null);
  const [seriesDialogOpen, setSeriesDialogOpen] = React.useState(false);
  const [detailSession, setDetailSession] = React.useState<LiveSessionView | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey({ includePast: false }) });
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey({ includePast: true }) });
  };

  const openCreate = () => {
    setEditingSession(null);
    setSessionDialogOpen(true);
  };
  const openEdit = (s: LiveSessionView) => {
    setEditingSession(s);
    setSessionDialogOpen(true);
  };
  const openDetail = (s: LiveSessionView) => {
    setDetailSession(s);
    setDetailOpen(true);
  };

  const cancelSession = (s: LiveSessionView) => {
    const msg = isAr
      ? `إلغاء جلسة «${s.title}»؟ سيتم إلغاء جميع الحجوزات القائمة ورد المدفوعات.`
      : `Cancel "${s.title}"? All active bookings will be cancelled and refunded.`;
    if (!window.confirm(msg)) return;
    updateMutation.mutate(
      { id: s.id, data: { status: 'cancelled' } },
      {
        onSuccess: () => {
          invalidateSessions();
          toast({ title: t('تم إلغاء الجلسة', 'Session cancelled') });
        },
        onError: (err) =>
          toast({ variant: 'destructive', title: t('تعذّر الإلغاء', 'Cancel failed'), description: apiErrorMessage(err, isAr) }),
      },
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Video className="w-7 h-7 text-primary" /> {t('الجلسات المباشرة', 'Live Sessions')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('إدارة الجلسات والسلاسل والحضور والمواد.', 'Manage sessions, series, attendance and materials.')}
          </p>
        </div>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList>
          <TabsTrigger value="sessions">
            <CalendarClock className="w-4 h-4 me-2" /> {t('الجلسات', 'Sessions')}
          </TabsTrigger>
          <TabsTrigger value="series">
            <Layers className="w-4 h-4 me-2" /> {t('السلاسل', 'Series')}
          </TabsTrigger>
        </TabsList>

        {/* Sessions tab */}
        <TabsContent value="sessions" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as 'upcoming' | 'past')}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">{t('القادمة', 'Upcoming')}</SelectItem>
                <SelectItem value="past">{t('السابقة والكل', 'Past & all')}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate}>
              <PlusCircle className="w-4 h-4 me-2" /> {t('جلسة جديدة', 'New Session')}
            </Button>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isError ? (
            <Card className="p-8 text-center text-destructive">{apiErrorMessage(error, isAr)}</Card>
          ) : !sessions || sessions.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="mb-2">{t('لا توجد جلسات', 'No sessions')}</CardTitle>
              <p className="text-muted-foreground mb-6 max-w-md">
                {t('أنشئ أول جلسة مباشرة لتبدأ باستقبال الحجوزات.', 'Create your first live session to start accepting bookings.')}
              </p>
              <Button onClick={openCreate}>
                <PlusCircle className="w-4 h-4 me-2" /> {t('جلسة جديدة', 'New Session')}
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((s) => (
                <Card key={s.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{s.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(s.startsAt, lang)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetail(s)}>
                            <Users className="w-4 h-4 me-2" /> {t('المشاركون والحضور', 'Participants')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(s)} disabled={s.status === 'cancelled'}>
                            <Pencil className="w-4 h-4 me-2" /> {t('تعديل', 'Edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => cancelSession(s)}
                            disabled={s.status !== 'scheduled'}
                            className="text-destructive"
                          >
                            <XCircle className="w-4 h-4 me-2" /> {t('إلغاء الجلسة', 'Cancel session')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={s.status === 'cancelled' ? 'destructive' : s.status === 'completed' ? 'secondary' : 'default'}>
                        {s.status}
                      </Badge>
                      <Badge variant="outline">{formatPrice(s.priceSar, lang)}</Badge>
                      {s.includedInSubscription && (
                        <Badge variant="secondary">{t('ضمن الاشتراك', 'Subscription')}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('المقاعد', 'Seats')}: {s.bookedCount}/{s.capacity}
                      {' · '}
                      {t('متبقٍ', 'Left')} {s.seatsLeft}
                      {' · '}
                      {s.durationMinutes} {t('د', 'min')}
                    </div>
                    <Button variant="outline" size="sm" className="mt-auto" onClick={() => openDetail(s)}>
                      <Users className="w-4 h-4 me-2" /> {t('إدارة المشاركين', 'Manage participants')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Series tab */}
        <TabsContent value="series" className="mt-6 space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={() => setSeriesDialogOpen(true)}>
              <PlusCircle className="w-4 h-4 me-2" /> {t('سلسلة جديدة', 'New Series')}
            </Button>
          </div>

          {seriesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : series.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Layers className="w-8 h-8 text-muted-foreground" />
              </div>
              <CardTitle className="mb-2">{t('لا توجد سلاسل', 'No series')}</CardTitle>
              <p className="text-muted-foreground mb-6 max-w-md">
                {t('اجمع الجلسات المتكررة ضمن سلسلة واحدة.', 'Group recurring sessions under a series.')}
              </p>
              <Button onClick={() => setSeriesDialogOpen(true)}>
                <PlusCircle className="w-4 h-4 me-2" /> {t('سلسلة جديدة', 'New Series')}
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {series.map((sr) => (
                <Card key={sr.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{sr.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sr.description && <p className="text-sm text-muted-foreground">{sr.description}</p>}
                    {sr.program && <Badge variant="outline">{sr.program}</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SessionFormDialog
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        session={editingSession}
        series={series}
        isAdmin={isAdmin}
      />
      <SeriesFormDialog open={seriesDialogOpen} onOpenChange={setSeriesDialogOpen} isAdmin={isAdmin} />
      <SessionDetailDrawer session={detailSession} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
