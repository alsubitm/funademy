import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const subjects = await prisma.lrnSubject.findMany({
    orderBy: { position: 'asc' },
    include: {
      _count: { select: { units: true } },
      units: {
        include: { _count: { select: { lessons: true } } },
      },
    },
  });

  return NextResponse.json(
    subjects.map((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      slug: s.slug,
      icon: s.icon,
      color: s.color,
      position: s.position,
      unitCount: s._count.units,
      lessonCount: s.units.reduce((acc, u) => acc + u._count.lessons, 0),
    })),
  );
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  if (!b.nameAr || !b.nameEn || !b.slug)
    return NextResponse.json({ error: 'nameAr, nameEn, slug required' }, { status: 400 });

  const maxPos = await prisma.lrnSubject.aggregate({ _max: { position: true } });
  const position = (maxPos._max.position ?? 0) + 1;

  const subject = await prisma.lrnSubject.create({
    data: {
      nameAr: String(b.nameAr),
      nameEn: String(b.nameEn),
      slug: String(b.slug).toLowerCase().replace(/\s+/g, '-'),
      icon: String(b.icon ?? '📚'),
      color: String(b.color ?? '#1C54CB'),
      position,
    },
  });

  return NextResponse.json(subject, { status: 201 });
}
