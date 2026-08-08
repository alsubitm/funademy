import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/** GET ?studentId=&programId= — student skill states for a program + badge status. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const studentId = Number(req.nextUrl.searchParams.get('studentId'));
  const programId = Number(req.nextUrl.searchParams.get('programId'));
  if (!Number.isInteger(studentId)) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const [skills, studentSkills, badges, studentBadges] = await Promise.all([
    Number.isInteger(programId)
      ? prisma.skill.findMany({ where: { programId }, orderBy: { position: 'asc' } })
      : Promise.resolve([]),
    prisma.studentSkill.findMany({ where: { studentId } }),
    prisma.badge.findMany({ orderBy: { position: 'asc' } }),
    prisma.studentBadge.findMany({ where: { studentId } }),
  ]);
  const stateBySkill = new Map(studentSkills.map((s) => [s.skillId, s.status]));
  const earned = new Map(studentBadges.map((b) => [b.badgeId, b.awardedAt]));

  return NextResponse.json({
    skills: skills.map((s) => ({ id: s.id, nameAr: s.nameAr, status: stateBySkill.get(s.id) ?? null })),
    badges: badges.map((b) => ({ id: b.id, nameAr: b.nameAr, iconKey: b.iconKey, awardedAt: earned.get(b.id) ?? null })),
  });
}

/**
 * POST — one of:
 *   { studentId, skillId, status: "in_progress" | "mastered" | "none" }  (skill check-off; "none" clears)
 *   { studentId, badgeId, award: true | false }                          (award / revoke badge)
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const studentId = Number(b?.studentId);
  if (!Number.isInteger(studentId)) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: 'student_not_found' }, { status: 404 });

  if (b?.skillId !== undefined) {
    const skillId = Number(b.skillId);
    const status = String(b?.status ?? '');
    if (!Number.isInteger(skillId) || !['in_progress', 'mastered', 'none'].includes(status)) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) return NextResponse.json({ error: 'skill_not_found' }, { status: 404 });
    // The skill must belong to a program the student is actually enrolled in.
    const enrolled = await prisma.enrollment.findFirst({
      where: { studentId, status: { in: ['active', 'paused'] }, courseRun: { programId: skill.programId } },
    });
    if (!enrolled) return NextResponse.json({ error: 'not_enrolled_in_program' }, { status: 409 });
    if (status === 'none') {
      await prisma.studentSkill.deleteMany({ where: { studentId, skillId } });
      return NextResponse.json({ ok: true });
    }
    const rec = await prisma.studentSkill.upsert({
      where: { studentId_skillId: { studentId, skillId } },
      update: { status: status as 'in_progress' | 'mastered' },
      create: { studentId, skillId, status: status as 'in_progress' | 'mastered' },
    });
    return NextResponse.json({ skill: rec });
  }

  if (b?.badgeId !== undefined) {
    const badgeId = Number(b.badgeId);
    if (!Number.isInteger(badgeId) || typeof b?.award !== 'boolean') {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge) return NextResponse.json({ error: 'badge_not_found' }, { status: 404 });
    if (b.award) {
      const rec = await prisma.studentBadge.upsert({
        where: { studentId_badgeId: { studentId, badgeId } },
        update: {},
        create: { studentId, badgeId },
      });
      return NextResponse.json({ badge: rec });
    }
    await prisma.studentBadge.deleteMany({ where: { studentId, badgeId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'validation' }, { status: 400 });
}
