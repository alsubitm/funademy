import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/** Admin content management: testimonials + FAQs. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const [testimonials, faqs] = await Promise.all([
    prisma.testimonial.findMany({ orderBy: { position: 'asc' } }),
    prisma.faqEntry.findMany({ orderBy: { position: 'asc' } }),
  ]);
  return NextResponse.json({ testimonials, faqs });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const type = String(b?.type ?? '');
  const id = Number(b?.id);
  if (!id || !['testimonial', 'faq'].includes(type)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  if (type === 'testimonial') {
    const allowed = ['name', 'nameAr', 'area', 'programEn', 'programAr', 'quoteEn', 'quoteAr', 'stars', 'published', 'position'];
    const data = Object.fromEntries(Object.entries(b.data ?? {}).filter(([k]) => allowed.includes(k)));
    const testimonial = await prisma.testimonial.update({ where: { id }, data });
    return NextResponse.json({ testimonial });
  }

  const allowed = ['questionEn', 'questionAr', 'answerEn', 'answerAr', 'published', 'position'];
  const data = Object.fromEntries(Object.entries(b.data ?? {}).filter(([k]) => allowed.includes(k)));
  const faq = await prisma.faqEntry.update({ where: { id }, data });
  return NextResponse.json({ faq });
}
