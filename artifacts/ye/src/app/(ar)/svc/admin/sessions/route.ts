import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** PATCH — set per-session meeting override / recording link. */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const data: Record<string, unknown> = {};
  for (const key of ['meetingUrl', 'recordingUrl'] as const) {
    if (b?.[key] !== undefined) {
      const url = b[key] ? String(b[key]).slice(0, 500) : null;
      if (url && !isHttpUrl(url)) return NextResponse.json({ error: 'bad_url' }, { status: 400 });
      data[key] = url;
    }
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'validation' }, { status: 400 });

  try {
    const session = await prisma.classSession.update({ where: { id }, data });
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
