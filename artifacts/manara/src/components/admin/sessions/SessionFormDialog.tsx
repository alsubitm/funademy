import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateLiveSession,
  useUpdateLiveSession,
  getListSessionsQueryKey,
  type LiveSessionView,
  type LiveSessionInput,
  type LiveSessionUpdate,
} from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SessionSeries } from './shared';
import { apiErrorMessage, isoToLocalInput, localInputToIso } from './shared';

interface FormState {
  title: string;
  description: string;
  program: string;
  seriesId: string; // '' = none
  teacherId: string; // '' = self (admin can override)
  startsAtLocal: string;
  durationMinutes: string;
  capacity: string;
  priceSar: string; // '' = free
  includedInSubscription: boolean;
  meetingLink: string;
}

const emptyForm: FormState = {
  title: '',
  description: '',
  program: '',
  seriesId: '',
  teacherId: '',
  startsAtLocal: '',
  durationMinutes: '60',
  capacity: '10',
  priceSar: '',
  includedInSubscription: false,
  meetingLink: '',
};

function fromSession(s: LiveSessionView): FormState {
  return {
    title: s.title ?? '',
    description: s.description ?? '',
    program: s.program ?? '',
    seriesId: s.seriesId != null ? String(s.seriesId) : '',
    teacherId: s.teacherId != null ? String(s.teacherId) : '',
    startsAtLocal: isoToLocalInput(s.startsAt),
    durationMinutes: String(s.durationMinutes ?? 60),
    capacity: String(s.capacity ?? 10),
    priceSar: s.priceSar != null && s.priceSar > 0 ? String(s.priceSar) : '',
    includedInSubscription: !!s.includedInSubscription,
    meetingLink: '',
  };
}

export function SessionFormDialog({
  open,
  onOpenChange,
  session,
  series,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this session; otherwise it creates one. */
  session?: LiveSessionView | null;
  series: SessionSeries[];
  isAdmin: boolean;
}) {
  const { t, lang } = useI18n();
  const isAr = lang === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!session;

  const [form, setForm] = React.useState<FormState>(emptyForm);

  React.useEffect(() => {
    if (open) setForm(session ? fromSession(session) : emptyForm);
  }, [open, session]);

  const createMutation = useCreateLiveSession();
  const updateMutation = useUpdateLiveSession();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey({ includePast: false }) });
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey({ includePast: true }) });
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: t('العنوان مطلوب', 'Title is required') });
      return;
    }
    if (!isEdit && !form.startsAtLocal) {
      toast({ variant: 'destructive', title: t('موعد البداية مطلوب', 'Start time is required') });
      return;
    }

    const priceSar = form.priceSar.trim() === '' ? null : Number(form.priceSar);
    const capacity = Number(form.capacity) || 10;
    const durationMinutes = Number(form.durationMinutes) || 60;

    if (isEdit && session) {
      const data: LiveSessionUpdate = {
        title: form.title.trim(),
        description: form.description,
        program: form.program,
        durationMinutes,
        capacity,
        priceSar,
        includedInSubscription: form.includedInSubscription,
      };
      if (form.startsAtLocal) data.startsAt = localInputToIso(form.startsAtLocal);
      if (form.meetingLink.trim()) data.meetingLink = form.meetingLink.trim();
      updateMutation.mutate(
        { id: session.id, data },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: t('تم تحديث الجلسة', 'Session updated') });
            onOpenChange(false);
          },
          onError: (err) =>
            toast({ variant: 'destructive', title: t('تعذّر التحديث', 'Update failed'), description: apiErrorMessage(err, isAr) }),
        },
      );
      return;
    }

    const data: LiveSessionInput = {
      title: form.title.trim(),
      description: form.description || undefined,
      program: form.program || undefined,
      startsAt: localInputToIso(form.startsAtLocal),
      durationMinutes,
      capacity,
      priceSar,
      includedInSubscription: form.includedInSubscription,
      meetingLink: form.meetingLink || undefined,
    };
    if (form.seriesId) data.seriesId = Number(form.seriesId);
    if (isAdmin && form.teacherId.trim()) data.teacherId = Number(form.teacherId);

    createMutation.mutate(
      { data },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: t('تم إنشاء الجلسة', 'Session created') });
          onOpenChange(false);
        },
        onError: (err) =>
          toast({ variant: 'destructive', title: t('تعذّر الإنشاء', 'Creation failed'), description: apiErrorMessage(err, isAr) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('تعديل الجلسة', 'Edit Session') : t('إنشاء جلسة جديدة', 'Create Session')}
          </DialogTitle>
          <DialogDescription>
            {t('حدد تفاصيل الجلسة المباشرة والسعة والسعر ورابط الاجتماع.', 'Set the live session details, capacity, price and meeting link.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-title">{t('العنوان', 'Title')}</Label>
            <Input id="s-title" value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-desc">{t('الوصف', 'Description')}</Label>
            <Textarea id="s-desc" value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-program">{t('البرنامج', 'Program')}</Label>
              <Input id="s-program" value={form.program} onChange={(e) => set('program', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('السلسلة', 'Series')}</Label>
              <Select
                value={form.seriesId || 'none'}
                onValueChange={(v) => set('seriesId', v === 'none' ? '' : v)}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('بدون سلسلة', 'No series')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('بدون سلسلة', 'No series')}</SelectItem>
                  {series.map((sr) => (
                    <SelectItem key={sr.id} value={String(sr.id)}>
                      {sr.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-start">{t('موعد البداية', 'Start time')}</Label>
              <Input
                id="s-start"
                type="datetime-local"
                value={form.startsAtLocal}
                onChange={(e) => set('startsAtLocal', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-duration">{t('المدة (دقائق)', 'Duration (min)')}</Label>
              <Input
                id="s-duration"
                type="number"
                min={5}
                max={480}
                value={form.durationMinutes}
                onChange={(e) => set('durationMinutes', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s-capacity">
                {t('السعة', 'Capacity')}
                {isEdit ? ` (${t('يمكن زيادتها فقط ضمن الحجوزات', 'increase only above active bookings')})` : ''}
              </Label>
              <Input
                id="s-capacity"
                type="number"
                min={1}
                max={500}
                value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-price">{t('السعر (ر.س)', 'Price (SAR)')}</Label>
              <Input
                id="s-price"
                type="number"
                min={0}
                step="0.01"
                placeholder={t('اتركه فارغاً للمجانية', 'Empty = free')}
                value={form.priceSar}
                onChange={(e) => set('priceSar', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="s-incl">{t('مشمولة في الاشتراك', 'Included in subscription')}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('يستطيع المشتركون الحضور دون دفع إضافي.', 'Subscribers can attend without extra payment.')}
              </p>
            </div>
            <Switch
              id="s-incl"
              checked={form.includedInSubscription}
              onCheckedChange={(v) => set('includedInSubscription', v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-link">{t('رابط الاجتماع', 'Meeting URL')}</Label>
            <Input
              id="s-link"
              type="url"
              dir="ltr"
              placeholder="https://…"
              value={form.meetingLink}
              onChange={(e) => set('meetingLink', e.target.value)}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                {t('اتركه فارغاً للإبقاء على الرابط الحالي.', 'Leave empty to keep the current link.')}
              </p>
            )}
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="s-teacher">{t('معرّف المعلّم المسند (اختياري)', 'Assignee teacher ID (optional)')}</Label>
              <Input
                id="s-teacher"
                type="number"
                dir="ltr"
                placeholder={t('اتركه فارغاً لإسناده لك', 'Empty = assign to you')}
                value={form.teacherId}
                onChange={(e) => set('teacherId', e.target.value)}
                disabled={isEdit}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t('جارٍ الحفظ…', 'Saving…')
                : isEdit
                  ? t('حفظ التعديلات', 'Save changes')
                  : t('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
