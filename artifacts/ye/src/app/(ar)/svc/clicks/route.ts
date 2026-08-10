import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { riyadhDay } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/** Track outbound clicks (e.g. WhatsApp). Fire-and-forget from the client. */
export async function POST(req: NextRequest) {
  let kind = 'whatsapp';
  let page = '/';
  try {
    const b = await req.json();
    if (typeof b.kind === 'string' && b.kind.length <= 32) kind = b.kind;
    if (typeof b.page === 'string' && b.page.length <= 128) page = b.page;
  } catch {
    // defaults
  }
  const day = riyadhDay();
  await prisma.clickEvent.upsert({
    where: { kind_page_day: { kind, page, day } },
    update: { count: { increment: 1 } },
    create: { kind, page, day, count: 1 },
  });
  return NextResponse.json({ ok: true });
}
