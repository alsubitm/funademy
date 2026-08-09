import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListSessionParticipants,
  useMarkSessionAttendance,
  useListSessionMaterials,
  useAddSessionMaterial,
  getListSessionParticipantsQueryKey,
  getListSessionMaterialsQueryKey,
  type LiveSessionView,
  type SessionMaterialInput,
} from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Check, X, Link2, ExternalLink, Users, FolderOpen } from 'lucide-react';
import type { SessionParticipant, SessionMaterial } from './shared';
import { apiErrorMessage, formatDateTime, formatPrice } from './shared';

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'attended':
      return 'default';
    case 'booked':
      return 'secondary';
    case 'waitlisted':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function SessionDetailDrawer({
  session,
  open,
  onOpenChange,
}: {
  session: LiveSessionView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang, dir } = useI18n();
  const isAr = lang === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sessionId = session?.id ?? 0;
  const enabled = open && !!session;

  const {
    data: participantsRaw,
    isLoading: participantsLoading,
    isError: participantsError,
    error: participantsErr,
  } = useListSessionParticipants(sessionId, {
    query: { enabled, queryKey: getListSessionParticipantsQueryKey(sessionId) },
  });

  const {
    data: materialsRaw,
    isLoading: materialsLoading,
  } = useListSessionMaterials(sessionId, {
    query: { enabled, queryKey: getListSessionMaterialsQueryKey(sessionId) },
  });

  const participants = (participantsRaw as unknown as SessionParticipant[] | undefined) ?? [];
  const materials = (materialsRaw as unknown as SessionMaterial[] | undefined) ?? [];

  const markMutation = useMarkSessionAttendance();
  const addMaterialMutation = useAddSessionMaterial();

  const [matTitle, setMatTitle] = React.useState('');
  const [matUrl, setMatUrl] = React.useState('');

  const invalidateParticipants = () =>
    queryClient.invalidateQueries({ queryKey: getListSessionParticipantsQueryKey(sessionId) });

  const markAttendance = (bookingId: number, status: 'present' | 'absent') => {
    markMutation.mutate(
      { id: sessionId, data: { records: [{ bookingId, status }] } },
      {
        onSuccess: () => {
          invalidateParticipants();
          toast({ title: t('تم تسجيل الحضور', 'Attendance saved') });
        },
        onError: (err) =>
          toast({ variant: 'destructive', title: t('تعذّر تسجيل الحضور', 'Attendance failed'), description: apiErrorMessage(err, isAr) }),
      },
    );
  };

  const addMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matTitle.trim()) {
      toast({ variant: 'destructive', title: t('العنوان مطلوب', 'Title is required') });
      return;
    }
    const data: SessionMaterialInput = {
      title: matTitle.trim(),
      kind: matUrl.trim() ? 'link' : 'note',
      url: matUrl.trim() || undefined,
    };
    addMaterialMutation.mutate(
      { id: sessionId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionMaterialsQueryKey(sessionId) });
          setMatTitle('');
          setMatUrl('');
          toast({ title: t('تمت إضافة المادة', 'Material added') });
        },
        onError: (err) =>
          toast({ variant: 'destructive', title: t('تعذّرت الإضافة', 'Add failed'), description: apiErrorMessage(err, isAr) }),
      },
    );
  };

  const activeParticipants = participants.filter((p) => p.status === 'booked' || p.status === 'attended');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={dir === 'rtl' ? 'left' : 'right'}
        className="w-full sm:max-w-xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{session?.title ?? ''}</SheetTitle>
          <SheetDescription>
            {session
              ? `${formatDateTime(session.startsAt, lang)} · ${formatPrice(session.priceSar, lang)} · ${t('السعة', 'Capacity')} ${session.bookedCount}/${session.capacity}`
              : ''}
          </SheetDescription>
        </SheetHeader>

        {/* Participants + attendance */}
        <section className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Users className="w-4 h-4" /> {t('المشاركون والحضور', 'Participants & Attendance')}
          </h3>
          {participantsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : participantsError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(participantsErr, isAr)}</p>
          ) : participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('لا يوجد مشاركون بعد.', 'No participants yet.')}</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('المشارك', 'Participant')}</TableHead>
                    <TableHead>{t('الحجز', 'Booking')}</TableHead>
                    <TableHead>{t('الدفع', 'Payment')}</TableHead>
                    <TableHead className="text-center">{t('الحضور', 'Attendance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => {
                    const canMark = p.status === 'booked' || p.status === 'attended';
                    return (
                      <TableRow key={p.bookingId}>
                        <TableCell>
                          <div className="font-medium">{p.userName || '—'}</div>
                          {p.childName && (
                            <div className="text-xs text-muted-foreground">{p.childName}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(p.status)}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.paymentMethod}</TableCell>
                        <TableCell>
                          {canMark ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant={p.attendanceStatus === 'present' || p.attendanceStatus === 'late' ? 'default' : 'outline'}
                                className="h-7 w-7"
                                title={t('حاضر', 'Present')}
                                disabled={markMutation.isPending}
                                onClick={() => markAttendance(p.bookingId, 'present')}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant={p.attendanceStatus === 'absent' ? 'destructive' : 'outline'}
                                className="h-7 w-7"
                                title={t('غائب', 'Absent')}
                                disabled={markMutation.isPending}
                                onClick={() => markAttendance(p.bookingId, 'absent')}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground block text-center">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {activeParticipants.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {t('المقاعد المشغولة', 'Active seats')}: {activeParticipants.length}
            </p>
          )}
        </section>

        {/* Materials */}
        <section className="mt-8">
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <FolderOpen className="w-4 h-4" /> {t('المواد التعليمية', 'Materials')}
          </h3>

          <form onSubmit={addMaterial} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="mat-title" className="text-xs">{t('العنوان', 'Title')}</Label>
              <Input id="mat-title" value={matTitle} onChange={(e) => setMatTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mat-url" className="text-xs">{t('الرابط', 'URL')}</Label>
              <Input id="mat-url" type="url" dir="ltr" placeholder="https://…" value={matUrl} onChange={(e) => setMatUrl(e.target.value)} />
            </div>
            <Button type="submit" disabled={addMaterialMutation.isPending}>
              {addMaterialMutation.isPending ? t('…', '…') : t('إضافة', 'Add')}
            </Button>
          </form>

          {materialsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('لا توجد مواد بعد.', 'No materials yet.')}</p>
          ) : (
            <ul className="space-y-2">
              {materials.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <Link2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{m.title}</span>
                  </span>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary shrink-0 hover:underline"
                    >
                      {t('فتح', 'Open')} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
