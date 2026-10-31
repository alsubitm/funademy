import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { familyHasActiveEnrollment } from '@/lib/kid-auth';
import { BADGE_ICONS, BAND_LABELS, serializeChild } from '@/lib/learning';
import LearnChildrenClient from '@/app/(ar)/learn/LearnChildrenClient';

export default async function LearnSelection({ english = false }: { english?: boolean }) {
  const t = (ar: string, en: string) => english ? en : ar;
  const prefix = english ? '/en' : '';
  const familyId = await getFamilyId();
  if (!familyId) redirect(`${prefix}/account?next=${prefix}/learn`);
  const enrolled = await familyHasActiveEnrollment(familyId);
  const children = enrolled ? await prisma.lrnChild.findMany({
    where: { familyId }, orderBy: { createdAt: 'asc' },
  }) : [];

  return <main className="learn-landing" dir={english ? 'ltr' : 'rtl'} lang={english ? 'en' : 'ar'}>
    <div className="learn-header">
      <Link href={`${prefix}/portal`} className="learn-back">{t('← بوابة الأهالي', '← Parent portal')}</Link>
      <h1 className="learn-title">{t('منصة التعلّم 🎓', 'Learning platform 🎓')}</h1>
      <p className="learn-subtitle">{t('اختر طفلاً للبدء', 'Choose a child to get started')}</p>
    </div>
    {!enrolled ? <div className="learn-gate">
      <div className="learn-gate-icon">🔒</div>
      <h2>{t('منصة التعلّم للعائلات المسجّلة', 'Learning for enrolled families')}</h2>
      <p>{t('يجب أن يكون لديكم تسجيل نشط في أي دورة للوصول إلى محتوى التعلّم.', 'Your family needs an active course enrollment to access learning content.')}</p>
      <Link href={`${prefix}/enroll`} className="btn y">{t('سجّل الآن', 'Enroll now')}</Link>
    </div> : <LearnChildrenClient familyId={familyId} initialChildren={children.map(serializeChild)} bandLabels={BAND_LABELS} badgeIcons={BADGE_ICONS} />}
  </main>;
}
