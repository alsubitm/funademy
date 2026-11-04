import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';
import { hashInstructorPassword, safeInstructorMutation } from '@/lib/instructor-auth';

const error = (value: string, status: number) => NextResponse.json({ error: value }, { status });
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await isAdminRequest()) return error('unauthorized', 401);
  try {
    const [instructors, runs] = await Promise.all([
      prisma.instructor.findMany({ orderBy: { name: 'asc' }, select: {
        id: true, name: true, email: true, active: true,
        assignments: { select: { courseRunId: true } },
      } }),
      prisma.courseRun.findMany({ orderBy: { startDate: 'desc' }, select: {
        id: true, titleAr: true, titleEn: true, program: { select: { nameEn: true } },
      } }),
    ]);
    return NextResponse.json({
      instructors: instructors.map(({ assignments, ...record }) => ({ ...record, courseRunIds: assignments.map(a => a.courseRunId) })),
      runs: runs.map(r => ({ id: r.id, title: r.titleAr || r.titleEn || r.program.nameEn, program: r.program.nameEn })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return error('service_unavailable', 503); }
}
async function save(req: Request, editing: boolean) {
  if (!safeInstructorMutation(req)) return error('forbidden', 403);
  if (!await isAdminRequest()) return error('unauthorized', 401);
  let body;
  try { body = await req.json(); } catch { return error('invalid_input', 400); }
  if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 ||
    typeof body.email !== 'string' || body.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
    !Array.isArray(body.courseRunIds) || body.courseRunIds.length > 200 ||
    !body.courseRunIds.every((id: unknown) => Number.isSafeInteger(id) && Number(id) > 0) ||
    new Set(body.courseRunIds).size !== body.courseRunIds.length ||
    (editing && (!Number.isSafeInteger(body.id) || typeof body.active !== 'boolean'))) return error('invalid_input', 400);
  const changePassword = !editing || body.password !== undefined && body.password !== '';
  if (changePassword && (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128)) return error('password_length', 400);
  try {
    const passwordHash = changePassword ? await hashInstructorPassword(body.password) : undefined;
    const runCount = await prisma.courseRun.count({ where: { id: { in: body.courseRunIds } } });
    if (runCount !== body.courseRunIds.length) return error('invalid_assignments', 400);
    const fields = { name: body.name.trim(), email: body.email.trim().toLowerCase() };
    if (!editing) {
      await prisma.instructor.create({ data: {
        ...fields, passwordHash: passwordHash!,
        assignments: { create: body.courseRunIds.map((courseRunId: number) => ({ courseRunId })) },
      } });
    } else {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM ye_instructors WHERE id = ${body.id} FOR UPDATE`;
        await tx.instructor.update({ where: { id: body.id }, data: {
          ...fields, active: body.active, ...(passwordHash ? { passwordHash } : {}),
          // Every account/assignment edit immediately revokes outstanding sessions.
          authVersion: { increment: 1 },
          assignments: { deleteMany: {}, create: body.courseRunIds.map((courseRunId: number) => ({ courseRunId })) },
        } });
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? e.code : null;
    if (code === 'P2002') return error('email_exists', 409);
    if (code === 'P2025') return error('not_found', 404);
    if (code === 'P2003') return error('invalid_assignments', 400);
    return error('service_unavailable', 503);
  }
}
export const POST = (req: Request) => save(req, false);
export const PATCH = (req: Request) => save(req, true);
