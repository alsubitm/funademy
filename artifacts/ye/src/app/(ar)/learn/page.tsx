import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { familyHasActiveEnrollment } from '@/lib/kid-auth';
import { BADGE_ICONS, BAND_LABELS } from '@/lib/learning';
import { serializeChild } from '@/lib/learning';
import LearnChildrenClient from './LearnChildrenClient';
import { GraduationCap, Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function LearnPage() {
  const familyId = await getFamilyId();
  if (!familyId) redirect('/account?next=/learn');

  const enrolled = await familyHasActiveEnrollment(familyId);

  const family = await prisma.family.findUnique({ where: { id: familyId } });
  const children = enrolled
    ? await prisma.lrnChild.findMany({
        where: { familyId },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const serialized = children.map(serializeChild);

  return (
    <main className="learn-landing" dir="rtl" lang="ar">
      <div className="learn-header">
        <Link href="/portal" className="learn-back">← بوابة الأهالي</Link>
        <h1 className="learn-title flex items-center justify-center gap-2">منصة التعلّم <GraduationCap size={32} /></h1>
        <p className="learn-subtitle">اختر طفلاً للبدء</p>
      </div>

      {!enrolled ? (
        <div className="learn-gate">
          <div className="learn-gate-icon"><Lock size={48} className="text-gray-400" /></div>
          <h2>منصة التعلّم للعائلات المسجّلة</h2>
          <p>يجب أن يكون لديكم تسجيل نشط في أي دورة للوصول إلى محتوى التعلّم.</p>
          <Link href="/enroll" className="btn y">سجّل الآن</Link>
        </div>
      ) : (
        <LearnChildrenClient
          familyId={familyId}
          initialChildren={serialized}
          bandLabels={BAND_LABELS}
          badgeIcons={BADGE_ICONS}
        />
      )}
    </main>
  );
}
