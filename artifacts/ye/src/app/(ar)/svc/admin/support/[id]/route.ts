import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../../guard';
import { chatExpiry } from '@/lib/chat-auth';

export const dynamic = 'force-dynamic';

type MutableModel = {
  update(args: { where: { id: string | number }; data: Record<string, unknown> }): Promise<unknown>;
};

type SupportDb = {
  chatConversation: MutableModel;
  chatEscalation: MutableModel;
};

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  if (!origin || (fetchSite && fetchSite !== 'same-origin')) return false;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? '');
  const target = body?.target === 'conversation' ? 'conversation' : 'escalation';
  if (!['assign', 'close', 'reopen'].includes(action) || (action === 'assign' && target !== 'escalation')) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const { id: rawId } = await params;
  const id: string | number = /^\d+$/.test(rawId) ? Number(rawId) : rawId;
  const db = prisma as unknown as SupportDb;
  const modelName = target === 'conversation' ? 'ChatConversation' : 'ChatEscalation';
  const fields = new Set(
    Prisma.dmmf.datamodel.models.find((model) => model.name === modelName)?.fields.map((field) => field.name),
  );

  if (action === 'assign') {
    const assignedTo = String(body?.assignedTo ?? '').trim();
    if (!assignedTo || assignedTo.length > 80) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    if (!fields.has('assignedTo')) {
      return NextResponse.json({ error: 'assignment_not_configured' }, { status: 409 });
    }
    await db.chatEscalation.update({ where: { id }, data: { assignedTo } });
  } else {
    const closed = action === 'close';
    const model = target === 'conversation' ? db.chatConversation : db.chatEscalation;
    if (!fields.has('status')) {
      return NextResponse.json({ error: 'status_not_configured' }, { status: 409 });
    }
    const data: Record<string, unknown> = { status: closed ? 'closed' : 'open' };
    const closedAtField = fields.has('closedAt') ? 'closedAt' : fields.has('resolvedAt') ? 'resolvedAt' : null;
    if (target === 'escalation' && closedAtField) data[closedAtField] = closed ? new Date() : null;
    await model.update({
      where: { id },
      data,
    });
  }

  // Append a redacted compliance event. Assignment names and conversation
  // contents are intentionally excluded from audit detail.
  if (target === 'conversation') {
    const auditOwner = await prisma.chatConversation.findUnique({ where: { id: rawId }, select: { id: true, familyId: true } });
    if (auditOwner) await prisma.chatAudit.create({
      data: {
        conversationId: auditOwner.id,
        familyId: auditOwner.familyId,
        event: `admin_support_${action}`,
        detail: { target },
        expiresAt: chatExpiry(),
      },
    });
  } else {
    const auditOwner = await prisma.chatEscalation.findUnique({
      where: { id: rawId },
      select: { conversationId: true, conversation: { select: { familyId: true } } },
    });
    if (auditOwner) {
    await prisma.chatAudit.create({
      data: {
          conversationId: auditOwner.conversationId,
          familyId: auditOwner.conversation.familyId,
        event: `admin_support_${action}`,
        detail: { target },
        expiresAt: chatExpiry(),
      },
    });
    }
  }

  return NextResponse.json({ ok: true });
}