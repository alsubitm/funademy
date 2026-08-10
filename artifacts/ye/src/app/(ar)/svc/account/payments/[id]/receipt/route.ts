import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Printable HTML receipt for one payment. Owner-only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'ar';
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, familyId },
    include: { items: true, family: true },
  });
  if (!payment) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const ar = lang === 'ar';
  const t = ar
    ? {
        title: 'إيصال دفع', receipt: 'رقم الإيصال', date: 'التاريخ', payer: 'ولي الأمر',
        provider: 'وسيلة الدفع', reference: 'المرجع', item: 'البند', period: 'الفترة',
        amount: 'المبلغ (ريال)', subtotal: 'الإجمالي قبل الخصم', discount: 'الخصم',
        total: 'الإجمالي المدفوع', simulated: 'دفعة تجريبية — لم يتم خصم مبلغ حقيقي',
        kind: { enrollment: 'تسجيل جديد', renewal: 'تجديد اشتراك' } as Record<string, string>,
        print: 'طباعة / حفظ PDF', brand: 'FunAdemy — e² Young Engineers',
        refunded: 'تم استرجاع مبلغ هذه الدفعة بالكامل إلى وسيلة الدفع الأصلية',
      }
    : {
        title: 'Payment receipt', receipt: 'Receipt no.', date: 'Date', payer: 'Parent',
        provider: 'Payment method', reference: 'Reference', item: 'Item', period: 'Period',
        amount: 'Amount (SAR)', subtotal: 'Subtotal', discount: 'Discount',
        total: 'Total paid', simulated: 'Simulated payment — no real charge was made',
        kind: { enrollment: 'New enrollment', renewal: 'Subscription renewal' } as Record<string, string>,
        print: 'Print / Save PDF', brand: 'FunAdemy — e² Young Engineers',
        refunded: 'This payment has been fully refunded to the original payment method',
      };
  const providers: Record<string, string> = {
    moyasar_mada: 'Mada', moyasar_applepay: 'Apple Pay', moyasar_stcpay: 'STC Pay', tamara: 'Tamara',
  };
  const fd = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const rows = payment.items.map((i) => `
    <tr>
      <td>${esc(i.studentName)} — ${esc(ar ? i.programAr : i.programEn)}${i.discountPct > 0 ? `<br><small>${ar ? `خصم أشقاء ${i.discountPct}٪` : `${i.discountPct}% sibling discount`}</small>` : ''}</td>
      <td dir="ltr">${fd(i.periodStart)} → ${fd(i.periodEnd)}</td>
      <td dir="ltr">${i.totalSar}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html lang="${lang}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${t.title} #${payment.id}</title>
<style>
  body { font-family: system-ui, 'Segoe UI', Tahoma, sans-serif; color: #07112a; margin: 0; background: #f4f6fb; }
  .sheet { max-width: 640px; margin: 24px auto; background: #fff; border: 1px solid #e3e7f0; border-radius: 16px; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .brand { color: #1c54cb; font-weight: 700; font-size: 13px; margin-bottom: 20px; }
  .meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 14px; margin-bottom: 20px; }
  .meta b { color: #5f6b92; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: start; padding: 10px 8px; border-bottom: 1px solid #e3e7f0; }
  th { color: #5f6b92; font-size: 12px; }
  .totals { margin-top: 16px; font-size: 14px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { font-weight: 800; font-size: 17px; border-top: 2px solid #07112a; margin-top: 6px; padding-top: 10px; }
  .sim { background: #fff7db; border: 1px solid #ffca17; color: #8a6d00; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-top: 18px; }
  .refunded { background: #efe7fd; border: 1px solid #c9b3f2; color: #6b3fd1; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-top: 18px; font-weight: 700; }
  .print { margin-top: 22px; }
  .print button { background: #1c54cb; color: #fff; border: 0; border-radius: 10px; padding: 12px 26px; font-size: 15px; font-weight: 700; cursor: pointer; }
  @media print { .print { display: none; } body { background: #fff; } .sheet { border: 0; margin: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <h1>${t.title}</h1>
    <div class="brand">${t.brand}</div>
    <div class="meta">
      <b>${t.receipt}</b><span dir="ltr">#${payment.id} · ${t.kind[payment.kind] ?? payment.kind}</span>
      <b>${t.date}</b><span dir="ltr">${fd(payment.createdAt)}</span>
      <b>${t.payer}</b><span>${esc(payment.family.parentName)}</span>
      <b>${t.provider}</b><span>${providers[payment.provider] ?? esc(payment.provider)}</span>
      <b>${t.reference}</b><span dir="ltr">${esc(payment.reference)}</span>
    </div>
    <table>
      <thead><tr><th>${t.item}</th><th>${t.period}</th><th>${t.amount}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>${t.subtotal}</span><span dir="ltr">${payment.subtotalSar} SAR</span></div>
      ${payment.discountSar > 0 ? `<div><span>${t.discount}</span><span dir="ltr">−${payment.discountSar} SAR</span></div>` : ''}
      <div class="grand"><span>${t.total}</span><span dir="ltr">${payment.totalSar} SAR</span></div>
    </div>
    ${payment.status === 'refunded' ? `<div class="refunded">${t.refunded}</div>` : ''}
    ${payment.simulated ? `<div class="sim">${t.simulated}</div>` : ''}
    <div class="print"><button onclick="window.print()">${t.print}</button></div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
