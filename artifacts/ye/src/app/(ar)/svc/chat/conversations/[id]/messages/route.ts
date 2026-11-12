import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { allowRate, clientIp } from '@/lib/rate-limit';
import { chatExpiry, ownedConversation, requireChatCsrf } from '@/lib/chat-auth';
import { buildLiveKnowledge, selectKnowledge } from '@/lib/chat-knowledge';
import { answerWithOpenAI, deterministicGroundedAnswer } from '@/lib/chat-openai';
import { accountSummary, formatAccountSummary, prepareChatAction } from '@/lib/chat-tools';
import { purgeExpiredChat } from '@/lib/chat-retention';
import { detectSensitivePaymentInput } from '@/lib/chat-safety';
import { waLink } from '@/lib/constants';
import { childAge, gearReply, isRecommendation, recommendationSources, responseLocale } from '@/lib/nujaym';

export const dynamic = 'force-dynamic';

const schema = z.object({
  content: z.string().trim().min(1).max(3000),
  idempotencyKey: z.string().min(8).max(120),
}).strict();

const encoder = new TextEncoder();
const sse = (value: unknown) => encoder.encode(`data: ${JSON.stringify(value)}\n\n`);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireChatCsrf(req);
  if (csrf) return csrf;
  void purgeExpiredChat().catch(() => {});
  const { id } = await params;
  if (!(await allowRate(`chat:send:${clientIp(req)}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const { conversation, identity } = await ownedConversation(req, id);
  if (!conversation) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const locale = responseLocale(parsed.data.content, conversation.locale);
  if (detectSensitivePaymentInput(parsed.data.content)) {
    const warning = locale === 'ar'
      ? 'لا يمكن للمساعد معالجة أو حفظ بيانات البطاقات أو الحسابات البنكية. لا ترسل هذه البيانات هنا، وتواصل مع فريقنا عبر واتساب للمساعدة الآمنة.'
      : 'The assistant cannot process or store card or banking details. Do not send them here; contact our team on WhatsApp for safe assistance.';
    const blockedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(sse({ type: 'delta', content: warning }));
        controller.enqueue(sse({
          type: 'done',
          blocked: 'sensitive_payment_input',
          handoff: true,
          handoffUrl: waLink(locale === 'ar' ? 'مرحباً، أحتاج مساعدة آمنة من فريق FunAdemy.' : 'Hello, I need safe assistance from the FunAdemy team.'),
          sources: [],
        }));
        controller.close();
      },
    });
    return new NextResponse(blockedStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }
  const duplicate = await prisma.chatMessage.findFirst({
    where: { conversationId: id, idempotencyKey: parsed.data.idempotencyKey },
  });
  if (duplicate) return NextResponse.json({ error: 'duplicate', messageId: duplicate.id }, { status: 409 });

  const history = await prisma.chatMessage.findMany({
    where: { conversationId: id, role: { in: ['user', 'assistant'] } },
    select: { role: true, content: true },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const userMessage = await prisma.chatMessage.create({
    data: {
      conversationId: id,
      role: 'user',
      content: parsed.data.content,
      idempotencyKey: parsed.data.idempotencyKey,
      expiresAt: chatExpiry(),
    },
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const chronologicalHistory = [...history].reverse();
        const allSources = await buildLiveKnowledge();
        const recommendation = isRecommendation(parsed.data.content, chronologicalHistory);
        const age = childAge(parsed.data.content, chronologicalHistory);
        const sources = recommendation
          ? recommendationSources(parsed.data.content, chronologicalHistory, allSources)
          : selectKnowledge([parsed.data.content, ...chronologicalHistory.filter(m => m.role === 'user').slice(-2).map(m => m.content)].join(' '), allSources);
        const challenge = gearReply(parsed.data.content, chronologicalHistory, locale);
        const text = parsed.data.content.toLowerCase();
        const sensitive = /(refund|استرداد|إلغاء.*(دفع|اشتراك)|هوية|national.?id|تغيير.*(بيانات|هوية))/.test(text);
        const accountIntent = /(حسابي|ملخص حساب|اشتراكي|دفعاتي|حجوزاتي|حصصي|my account|account summary|my subscription|my payments|my bookings|my classes)/.test(text);
        const trialIntent = /(trial|تجريبية|حصة تجريبية|كيف.*[اأ]حجز|how.*book)/.test(text);
        const consultIntent = /(consult|consultation|استشارة)/.test(text);
        const makeupIntent = /(makeup|تعويض)/.test(text);
        let preparedAction: { id: string; kind: string; payload: unknown; expiresAt: Date } | null = null;
        let deterministicAnswer: string | null = challenge?.text ?? null;
        if (!deterministicAnswer && recommendation && age === null) {
          deterministicAnswer = locale === 'ar' ? 'أكيد! كم عمر طفلك، وش يحب: البناء أو البرمجة أو الروبوتات؟'
            : 'Happy to help! How old is your child, and do they enjoy building, coding, or robotics?';
        } else if (!deterministicAnswer && recommendation && !sources.length) {
          deterministicAnswer = locale === 'ar' ? 'ما لقيت برنامجًا منشورًا يناسب هذا العمر. خلّ فريقنا يساعدك في الاختيار: /contact.'
            : 'I could not find a published programme for that age. Our team can help you choose: /en/contact.';
        }
        if (identity.familyId && conversation.familyId === identity.familyId && accountIntent) {
          const account = await accountSummary(identity.familyId);
          deterministicAnswer = account
            ? formatAccountSummary(account, locale)
            : (locale === 'ar' ? 'تعذر تحميل حسابك الآن. افتح /account أو اطلب تحويلك للفريق.' : 'Your account could not be loaded. Open /en/account or ask for a handoff.');
        } else if (accountIntent) {
          deterministicAnswer = locale === 'ar'
            ? 'سجّل الدخول أولاً لعرض بيانات عائلتك بأمان، ثم افتح /account.'
            : 'Sign in first to view your family data securely, then open /en/account.';
        }
        // Fixed intent extraction only: no model-selected tools or arbitrary DB queries.
        if (identity.familyId && conversation.familyId === identity.familyId && !sensitive) {
          const makeup = text.match(/(?:makeup|تعويض)\s+(\d+)\s+(\d+)/);
          const consult = text.match(/(?:consult|استشارة)\s+(\d{4}-\d\d-\d\dT[^\s]+)/);
          const trial = text.match(/(?:trial|تجريبية)\s+(\d+)\s+(\d+)\s+(\d+)/);
          const key = `nl:${id}:${userMessage.id}`;
          try {
            if (makeup) preparedAction = await prepareChatAction(id, identity.familyId, { kind: 'request_makeup', studentId: Number(makeup[1]), sessionId: Number(makeup[2]), idempotencyKey: key });
            else if (consult) preparedAction = await prepareChatAction(id, identity.familyId, { kind: 'book_consultation', startsAt: consult[1], idempotencyKey: key });
            else if (trial) preparedAction = await prepareChatAction(id, identity.familyId, { kind: 'book_trial', studentId: Number(trial[1]), programId: Number(trial[2]), slotId: Number(trial[3]), idempotencyKey: key });
          } catch {
            // Invalid/incomplete requests deliberately stay in the normal answer path.
          }
        }
        if (!preparedAction && !deterministicAnswer && (trialIntent || consultIntent || makeupIntent)) {
          deterministicAnswer = locale === 'ar'
            ? trialIntent
              ? 'لحجز حصة تجريبية اختر الطفل والبرنامج والموعد من صفحة الحجز: /book. لن أنفّذ أي حجز قبل عرض بطاقة تأكيد.'
              : consultIntent
                ? 'اختر موعد الاستشارة المتاح من صفحة الاستشارات: /consult. بعد اختيار الوقت يمكن عرض بطاقة تأكيد.'
                : 'طلبات التعويض متاحة للطفل والحصة المؤهلة من بوابة الأهالي: /account. يلزم تسجيل الدخول واختيار الحصة الفائتة.'
            : trialIntent
              ? 'Choose the child, program, and time on the booking page: /en/book. No booking is executed before a confirmation card.'
              : consultIntent
                ? 'Choose an available consultation time at /en/consult. A confirmation card can then be shown.'
                : 'Eligible makeup requests are available for the missed class in /en/account. Sign in and select the missed session.';
        } else if (preparedAction && !deterministicAnswer) {
          deterministicAnswer = locale === 'ar'
            ? 'جهزت طلبك فقط. راجع بطاقة الإجراء واضغط تأكيد لتنفيذه.'
            : 'I only prepared the request. Review the action card and click confirm to execute it.';
        }
        if (sensitive) {
          const alreadyOpen = await prisma.chatEscalation.findFirst({
            where: { conversationId: id, reason: 'sensitive_request', status: 'open' },
          });
          if (!alreadyOpen) {
            await prisma.chatEscalation.create({
              data: { conversationId: id, reason: 'sensitive_request', summary: 'Sensitive request', contactMethod: conversation.contactMethod, expiresAt: chatExpiry() },
            });
          }
        }
        const modelAnswer = !sensitive && !deterministicAnswer ? await answerWithOpenAI(
          parsed.data.content,
          chronologicalHistory.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 3000) })),
          sources,
        ) : null;
        const providerUnavailable = !sensitive && !deterministicAnswer && sources.length > 0 && !modelAnswer;
        const recommendationFallback = recommendation && sources.length
          ? sources.slice(0, 2).map(s => locale === 'ar'
            ? `${s.titleEn} يناسب عمر ${s.ageMin}–${s.ageMax}. ${s.descriptionAr ?? ''} [${s.id}]`
            : `${s.titleEn} is for ages ${s.ageMin}–${s.ageMax}. ${s.descriptionEn ?? ''} [${s.id}]`).join('\n')
          : null;
        const answer = sensitive
          ? (locale === 'ar' ? 'لا أستطيع تنفيذ طلبات الدفع أو الإلغاء أو تغيير الهوية. حوّلت طلبك إلى الفريق المختص.' : 'I cannot perform payment, cancellation, or identity changes. Your request has been escalated to the team.')
          : deterministicAnswer
            ? deterministicAnswer
          :
          modelAnswer ?? recommendationFallback ??
          (sources.length
            ? (deterministicGroundedAnswer(sources, locale)!)
            : (locale === 'ar'
              ? 'لا تتوفر لدي معلومة موثوقة عن هذا السؤال، ولن أخمّن. يمكنني تحويله لفريق الدعم.'
              : 'I do not have a reliable source for that question, so I will not guess. I can hand it off to support.'));
        const refs = sources
          .filter((source) => answer.includes(source.id))
          .map(({ id: sourceId, titleAr, titleEn, url }) => ({
            id: sourceId, title: locale === 'ar' ? titleAr : titleEn,
            url: locale === 'en' ? `/en${url === '/' ? '' : url}` : url,
          }));
        const assistant = await prisma.chatMessage.create({
          data: { conversationId: id, role: 'assistant', content: answer, sourceRefs: refs, expiresAt: chatExpiry() },
        });
        await prisma.chatConversation.update({ where: { id }, data: { expiresAt: chatExpiry() } });
        controller.enqueue(sse({ type: 'delta', content: answer }));
        controller.enqueue(sse({ type: 'done', messageId: assistant.id, userMessageId: userMessage.id, sources: refs, preparedAction, celebrate: !sensitive && answer === challenge?.text && challenge.celebrate, providerUnavailable }));
      } catch (error) {
        console.error('[chat] response failed');
        await prisma.chatAudit.create({ data: { conversationId: id, familyId: conversation.familyId, event: 'provider_failure', expiresAt: chatExpiry() } }).catch(() => {});
        controller.enqueue(sse({ type: 'error', error: 'temporarily_unavailable' }));
      } finally {
        controller.close();
      }
    },
  });
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}