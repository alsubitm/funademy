import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateSessionSeries,
  getListSessionSeriesQueryKey,
  type SessionSeriesInput,
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
import { apiErrorMessage } from './shared';

export function SeriesFormDialog({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const { t, lang } = useI18n();
  const isAr = lang === 'ar';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [program, setProgram] = React.useState('');
  const [teacherId, setTeacherId] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setProgram('');
      setTeacherId('');
    }
  }, [open]);

  const mutation = useCreateSessionSeries();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: 'destructive', title: t('العنوان مطلوب', 'Title is required') });
      return;
    }
    const data: SessionSeriesInput = {
      title: title.trim(),
      description: description || undefined,
      program: program || undefined,
    };
    if (isAdmin && teacherId.trim()) data.teacherId = Number(teacherId);

    mutation.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionSeriesQueryKey() });
          toast({ title: t('تم إنشاء السلسلة', 'Series created') });
          onOpenChange(false);
        },
        onError: (err) =>
          toast({ variant: 'destructive', title: t('تعذّر الإنشاء', 'Creation failed'), description: apiErrorMessage(err, isAr) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('إنشاء سلسلة جلسات', 'Create Session Series')}</DialogTitle>
          <DialogDescription>
            {t('اجمع الجلسات المتكررة ضمن سلسلة واحدة.', 'Group recurring sessions under a single series.')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sr-title">{t('العنوان', 'Title')}</Label>
            <Input id="sr-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-desc">{t('الوصف', 'Description')}</Label>
            <Textarea id="sr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-program">{t('البرنامج', 'Program')}</Label>
            <Input id="sr-program" value={program} onChange={(e) => setProgram(e.target.value)} />
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="sr-teacher">{t('معرّف المعلّم المسند (اختياري)', 'Assignee teacher ID (optional)')}</Label>
              <Input
                id="sr-teacher"
                type="number"
                dir="ltr"
                placeholder={t('اتركه فارغاً لإسناده لك', 'Empty = assign to you')}
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('جارٍ الحفظ…', 'Saving…') : t('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
