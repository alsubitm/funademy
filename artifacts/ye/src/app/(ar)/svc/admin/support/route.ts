import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';
import { whatsappHealth } from '@/lib/whatsapp';
import { reconcileStaleWhatsAppDispatches } from '@/lib/whatsapp-dispatch';

export const dynamic = 'force-dynamic';

type SupportRecord = Record<string, unknown>;

type SupportDb = {
  chatConversation: {
    findMany(args?: Record<string, unknown>): Promise<SupportRecord[]>;
  };
  chatEscalation: {
    findMany(args?: Record<string, unknown>): Promise<SupportRecord[]>;
  };
};

const asText = (value: unknown) => typeof value === 'string' ? value : null;
const asDate = (value: unknown) => value instanceof Date || typeof value === 'string'
  ? new Date(value).toISOString()
  : null;

/** Return an intentionally small DTO: never return name, email, or raw phone. */
function conversationDto(record: SupportRecord) {
  return {
    id: record.id,
    status: asText(record.status) ?? 'open',
    summary: asText(record.summary) ?? asText(record.title),
    contactMethod: asText(record.contactMethod) ?? asText(record.contactChannel),
    channel: asText(record.channel) ?? 'website',
    assignedTo: asText(record.assignedTo),
    whatsappHref: null,
    createdAt: asDate(record.createdAt),
    updatedAt: asDate(record.updatedAt),
  };
}

function escalationDto(record: SupportRecord) {
  return {
    id: record.id,
    conversationId: record.conversationId,
    status: asText(record.status) ?? 'open',
    reason: asText(record.reason),
    summary: asText(record.summary),
    assignedTo: asText(record.assignedTo),
    contactMethod: asText(record.contactMethod) ?? asText(record.contactChannel),
    whatsappHref: null,
    createdAt: asDate(record.createdAt),
    updatedAt: asDate(record.updatedAt),
    closedAt: asDate(record.closedAt) ?? asDate(record.resolvedAt),
  };
}

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  // A process can stop after claiming a provider dispatch. Never auto-resend:
  // make the unknown outcome explicit to staff after the bounded send window.
  await reconcileStaleWhatsAppDispatches();

  const db = prisma as unknown as SupportDb;
  const [conversations, escalations] = await Promise.all([
    db.chatConversation.findMany({ where: { expiresAt: { gt: new Date() } }, take: 100 }),
    db.chatEscalation.findMany({ where: { expiresAt: { gt: new Date() } }, take: 100 }),
  ]);
  const selectedId = new URL(req.url).searchParams.get('conversation');
  const selected = selectedId ? await prisma.chatConversation.findFirst({
    where: { id: selectedId, expiresAt: { gt: new Date() } },
    include: { messages: { where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'asc' }, take: 200 } },
  }) : null;

  const newestFirst = (a: { updatedAt: string | null; createdAt: string | null }, b: { updatedAt: string | null; createdAt: string | null }) =>
    Date.parse(b.updatedAt ?? b.createdAt ?? '') - Date.parse(a.updatedAt ?? a.createdAt ?? '');

  const conversationFields = new Set(
    Prisma.dmmf.datamodel.models.find((model) => model.name === 'ChatConversation')?.fields.map((field) => field.name),
  );
  const escalationFields = new Set(
    Prisma.dmmf.datamodel.models.find((model) => model.name === 'ChatEscalation')?.fields.map((field) => field.name),
  );

  return NextResponse.json({
    conversations: conversations.map(conversationDto).sort(newestFirst),
    escalations: escalations.map(escalationDto).sort(newestFirst),
    selected: selected ? {
      ...conversationDto(selected as unknown as SupportRecord),
      messages: selected.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        channel: message.channel,
        direction: message.role === 'assistant' ? 'outbound' : message.direction,
        deliveryStatus: message.deliveryStatus,
        deliveryError: message.deliveryError,
        createdAt: message.createdAt.toISOString(),
      })),
    } : null,
    capabilities: {
      assignEscalation: escalationFields.has('assignedTo'),
      assignConversation: conversationFields.has('assignedTo'),
      updateConversationStatus: conversationFields.has('status'),
      whatsapp: whatsappHealth(),
    },
  });
}