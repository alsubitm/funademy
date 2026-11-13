'use client';

import Link from 'next/link';
import { useLearningLocale } from './locale';

export type HomeFailure = 'signin' | 'chooser' | 'enrollment' | 'transient';

/** Classify a /svc/learn/home response into a recoverable learner state. */
export async function classifyHome(r: Response): Promise<HomeFailure | null> {
  if (r.ok) return null;
  const code = await r.json().then((j) => (typeof j?.error === 'string' ? j.error : ''), () => '');
  if (r.status === 401 && code === 'unauthorized') return 'signin';
  if (r.status === 401 || r.status === 404) return 'chooser';
  if (r.status === 403) return 'enrollment';
  return 'transient';
}

export const MAX_AUTO_RETRIES = 2;

export function LearnerRecovery({ kind, attempts, onRetry }: { kind: HomeFailure; attempts: number; onRetry: () => void }) {
  const { t, path } = useLearningLocale();
  const copy: Record<HomeFailure, { title: string; body: string }> = {
    signin: {
      title: t('انتهت جلسة ولي الأمر', 'The parent session has ended'),
      body: t('سجّل دخول ولي الأمر مرة أخرى ثم اختر ملف التعلّم.', 'Ask a parent to sign in again, then choose a learning profile.'),
    },
    chooser: {
      title: t('اختر ملف التعلّم من جديد', 'Choose your learning profile again'),
      body: t('انتهى وضع الطفل على هذا الجهاز أو تغيّر الملف المختار.', 'Child mode ended on this device or a different profile was chosen.'),
    },
    enrollment: {
      title: t('لا يوجد تسجيل نشط', 'No active enrollment'),
      body: t('تحتاج العائلة إلى تسجيل نشط في دورة لفتح محتوى التعلّم. يمكن لولي الأمر مراجعة ذلك من البوابة.', 'The family needs an active course enrollment to open learning content. A parent can check this in the portal.'),
    },
    transient: {
      title: t('تعذّر الاتصال الآن', 'We could not connect right now'),
      body: attempts > MAX_AUTO_RETRIES
        ? t('ما زال الاتصال متعثراً. خذ استراحة قصيرة وحاول لاحقاً، أو ارجع إلى اختيار الملف.', 'The connection is still failing. Take a short break and try later, or go back to profile selection.')
        : t('تقدّمك محفوظ. أعد المحاولة بعد لحظة.', 'Your progress is safe. Try again in a moment.'),
    },
  };
  const c = copy[kind];
  return (
    <div className="kid-recovery" role="alert" data-testid={`status-learner-${kind}`}>
      <div className="kid-recovery-mark" aria-hidden="true" />
      <h2>{c.title}</h2>
      <p>{c.body}</p>
      <div className="kid-recovery-actions">
        {kind === 'signin' && <Link className="kid-btn" href={path('/account?next=') + path('/learn')} data-testid="link-learner-signin">{t('تسجيل دخول ولي الأمر', 'Parent sign in')}</Link>}
        {kind === 'chooser' && <Link className="kid-btn" href={path('/learn')} data-testid="link-learner-chooser">{t('اختيار ملف التعلّم', 'Choose a profile')}</Link>}
        {kind === 'enrollment' && <>
          <Link className="kid-btn" href={path('/portal')} data-testid="link-learner-portal">{t('بوابة الأهالي', 'Parent portal')}</Link>
          <Link className="kid-btn line" href={path('/enroll')} data-testid="link-learner-enroll">{t('التسجيل في دورة', 'Enroll in a course')}</Link>
        </>}
        {kind === 'transient' && <>
          {attempts <= MAX_AUTO_RETRIES && <button type="button" className="kid-btn" onClick={onRetry} data-testid="button-learner-retry">{t('إعادة المحاولة', 'Try again')}</button>}
          <Link className="kid-btn line" href={path('/learn')} data-testid="link-learner-chooser">{t('اختيار ملف التعلّم', 'Choose a profile')}</Link>
        </>}
      </div>
    </div>
  );
}
