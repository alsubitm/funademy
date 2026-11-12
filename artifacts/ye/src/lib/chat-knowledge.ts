import { prisma } from '@/lib/db';

export type KnowledgeSource = {
  id: string;
  type: 'program' | 'run' | 'slot' | 'faq' | 'policy';
  title: string;
  titleAr: string;
  titleEn: string;
  url: string;
  text: string;
  ageMin?: number;
  ageMax?: number;
  descriptionAr?: string;
  descriptionEn?: string;
};

const clean = (value: unknown) =>
  String(value ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 1200);

/** Builds a fresh, bounded snapshot. Database content is data, never instructions. */
export async function buildLiveKnowledge(): Promise<KnowledgeSource[]> {
  const [programs, runs, slots, faqs] = await Promise.all([
    prisma.program.findMany({ orderBy: { position: 'asc' } }),
    prisma.courseRun.findMany({
      where: { active: true, endDate: { gte: new Date() } },
      include: { program: { select: { nameAr: true, nameEn: true } } },
      orderBy: { startDate: 'asc' },
      take: 40,
    }),
    prisma.scheduleSlot.findMany({
      where: { active: true },
      include: { program: { select: { nameAr: true, nameEn: true } } },
      take: 60,
    }),
    prisma.faqEntry.findMany({ where: { published: true }, orderBy: { position: 'asc' }, take: 60 }),
  ]);

  return [
    {
      id: 'policy:assistant',
      type: 'policy' as const,
      title: 'FunAdemy',
      titleAr: 'FunAdemy',
      titleEn: 'FunAdemy',
      url: '/contact',
      text: 'Nujaym / نُجَيْم is the FunAdemy assistant for programme questions and engineering challenges. Use /book or /en/book for trial booking and personal details, /enroll or /en/enroll for enrollment, /contact or /en/contact for academy support. Unknown fees, schedules and availability must be confirmed with the academy.',
    },
    {
      id: 'policy:privacy',
      type: 'policy' as const,
      title: 'سياسة الخصوصية / Privacy Policy',
      titleAr: 'سياسة الخصوصية',
      titleEn: 'Privacy Policy',
      url: '/privacy',
      text: clean('سياسة الخصوصية وحماية بيانات العائلات والأطفال والمحادثات وحقوق البيانات | Privacy policy, family and child data protection, chat processing, and data rights'),
    },
    {
      id: 'policy:terms',
      type: 'policy' as const,
      title: 'الشروط والأحكام / Terms & Conditions',
      titleAr: 'الشروط والأحكام',
      titleEn: 'Terms & Conditions',
      url: '/terms',
      text: clean('شروط الحجز والدفع والدعم | Booking, payment, support and service terms'),
    },
    {
      id: 'policy:refund-cancellation',
      type: 'policy' as const,
      title: 'سياسة الاسترداد والإلغاء / Refunds & Cancellation',
      titleAr: 'سياسة الاسترداد والإلغاء',
      titleEn: 'Refunds & Cancellation',
      url: '/terms',
      text: clean('قبل بداية البرنامج استرداد كامل. بعد البداية تخصم الحصص المنفذة. طلبات الاسترداد عبر الدعم وتعالج خلال 5–10 أيام عمل | Full refund before program start; delivered classes deducted after start; requests through support, processed in 5–10 business days'),
    },
    ...programs.map((p) => ({
      id: `program:${p.id}`,
      ageMin: p.ageMin,
      ageMax: p.ageMax,
      descriptionAr: clean(p.descAr),
      descriptionEn: clean(p.descEn),
      type: 'program' as const,
      title: p.nameAr,
      titleAr: p.nameAr,
      titleEn: p.nameEn,
      url: '/programs',
      text: clean(`${p.nameAr} / ${p.nameEn}; ages ${p.ageMin}-${p.ageMax}; ${p.format}; ${p.descAr}; ${p.descEn}`),
    })),
    ...runs.map((r) => ({
      id: `run:${r.id}`,
      type: 'run' as const,
      title: r.program.nameAr,
      titleAr: r.program.nameAr,
      titleEn: r.program.nameEn,
      url: '/enroll',
      text: clean(
        `${r.program.nameAr} / ${r.program.nameEn}; ${r.startDate.toISOString()}–${r.endDate.toISOString()}; weekday ${r.weekday}; ${r.time}; ${r.format}; seats ${r.seatsLeft}; monthly SAR ${r.monthlyPriceSar}`,
      ),
    })),
    ...slots.map((s) => ({
      id: `slot:${s.id}`,
      type: 'slot' as const,
      title: s.program.nameAr,
      titleAr: s.program.nameAr,
      titleEn: s.program.nameEn,
      url: '/book',
      text: clean(`${s.program.nameAr} / ${s.program.nameEn}; weekday ${s.weekday}; ${s.time}; ${s.format}; ${s.location ?? ''}; seats ${s.seatsLeft}`),
    })),
    ...faqs.map((f) => ({
      id: `faq:${f.id}`,
      type: 'faq' as const,
      title: f.questionAr,
      titleAr: f.questionAr,
      titleEn: f.questionEn,
      url: '/#faq',
      text: clean(`${f.questionAr} — ${f.answerAr} | ${f.questionEn} — ${f.answerEn}`),
    })),
  ];
}

export function selectKnowledge(query: string, sources: KnowledgeSource[], limit = 14) {
  const terms = new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2));
  const selected = sources
    .map((source) => ({
      source,
      score: [...terms].reduce((n, term) => n + (source.text.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.source);
  return selected.length ? selected : sources.filter(s => s.id === 'policy:assistant');
}