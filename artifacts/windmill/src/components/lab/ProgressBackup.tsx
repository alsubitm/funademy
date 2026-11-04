import { useRef, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { exportProgress, importProgress, MAX_BACKUP_BYTES, type LessonRules, type Progress } from '@/lib/lesson-engine';

const copy = {
  en: {
    open: 'Progress backup', title: 'Back up or restore progress', close: 'Close',
    body: 'Save a JSON file before clearing browser storage or moving to another device. It contains only lesson steps, hints, motor-test status and language — no names or device identifiers. Nothing is uploaded.',
    demo: 'Backups use saved learner progress, not demonstration steps.',
    download: 'Download backup', choose: 'Choose backup file', cancel: 'Cancel import',
    confirm: 'Replace current progress', warning: 'This replaces the current lesson progress on this device. Download a backup first if you want to keep it.',
    invalid: 'Cannot read this backup. Choose a valid Windmill backup for this lesson version (maximum 16 KB). Current progress has not changed.',
    downloaded: 'Backup download requested. Check that the file is saved before clearing browser storage.',
    failed: 'Could not download the backup. Keep this page open and try again.',
    restored: 'Progress restored. If browser storage is unavailable, download a backup before leaving.',
    summary: (n: number, total: number) => `Backup: ${n} of ${total} steps.`,
  },
  ar: {
    open: 'نسخة احتياطية للتقدم', title: 'حفظ التقدم أو استعادته', close: 'إغلاق',
    body: 'احفظ ملف JSON قبل مسح بيانات المتصفح أو الانتقال إلى جهاز آخر. يحتوي فقط على خطوات الدرس والتلميحات وحالة اختبار المحرك واللغة، دون أسماء أو معرّفات للأجهزة. لا يتم رفع أي بيانات.',
    demo: 'تستخدم النسخة تقدم المتعلم المحفوظ، وليس خطوات العرض التوضيحي.',
    download: 'تنزيل نسخة احتياطية', choose: 'اختيار ملف النسخة', cancel: 'إلغاء الاستيراد',
    confirm: 'استبدال التقدم الحالي', warning: 'سيُستبدل تقدم الدرس الحالي على هذا الجهاز. نزّل نسخة احتياطية أولاً إن أردت الاحتفاظ به.',
    invalid: 'تعذرت قراءة النسخة. اختر نسخة Windmill صالحة لإصدار هذا الدرس (بحد أقصى 16 كيلوبايت). لم يتغير التقدم الحالي.',
    downloaded: 'طُلب تنزيل النسخة. تأكد من حفظ الملف قبل مسح بيانات المتصفح.',
    failed: 'تعذر تنزيل النسخة. أبقِ هذه الصفحة مفتوحة وحاول مجدداً.',
    restored: 'تمت استعادة التقدم. إذا كان تخزين المتصفح غير متاح، نزّل نسخة قبل المغادرة.',
    summary: (n: number, total: number) => `النسخة: ${n} من ${total} خطوة.`,
  },
};

export function ProgressBackup({ lesson, progress, onReplace, onOpen }: {
  lesson: LessonRules; progress: Progress; onReplace: (p: Progress) => boolean; onOpen: () => void;
}) {
  const t = copy[progress.language];
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Progress | null>(null);
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const request = useRef(0);
  const close = () => { request.current++; setOpen(false); setPending(null); setReading(false); };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportProgress(lesson, progress)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'windmill-progress.json';
      document.body.append(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(t.downloaded);
    } catch { setMessage(t.failed); }
  };
  async function read(file: File | undefined) {
    const token = ++request.current;
    setPending(null); setMessage('');
    if (!file) return;
    setReading(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Too large');
      const candidate = importProgress(lesson, await file.text());
      if (token !== request.current) return;
      if (!candidate) throw new Error('Invalid backup');
      setPending(candidate);
    } catch {
      if (token === request.current) setMessage(t.invalid);
    } finally {
      if (token === request.current) setReading(false);
    }
  }
  return <>
    <button type="button" className="btn btn-ghost" data-testid="backup-open"
      onClick={() => { onOpen(); setMessage(''); setOpen(true); }}>{t.open}</button>
    <Dialog open={open} onClose={close} title={t.title} closeLabel={t.close} testId="dialog-backup">
      <p className="dlg-body">{t.body}</p>
      <p className="dlg-body">{t.demo}</p>
      <button type="button" className="btn btn-soft" onClick={download} data-testid="backup-download">{t.download}</button>
      <p className="dlg-body">
        <label>{t.choose}<input type="file" accept=".json,application/json" disabled={reading} data-testid="backup-file"
          onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void read(file); }} /></label>
      </p>
      {pending && <section aria-label={t.confirm}>
        <p className="dlg-body">{t.summary(pending.placed.length, lesson.steps.length)} {t.warning}</p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-soft" onClick={() => setPending(null)} data-testid="backup-cancel">{t.cancel}</button>
          <button type="button" className="btn btn-danger" data-testid="backup-confirm" onClick={() => {
            const language = pending.language;
            const ok = onReplace(pending);
            setPending(null); setMessage(ok ? copy[language].restored : t.invalid);
          }}>{t.confirm}</button>
        </div>
      </section>}
      <p className="dlg-body" role="status">{message}</p>
    </Dialog>
  </>;
}
