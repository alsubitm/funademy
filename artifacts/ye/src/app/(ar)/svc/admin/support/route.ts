import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';
import { waLink } from '@/lib/constants';

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

function whatsappHref(record: SupportRecord): string | null {
  const raw = asText(record.contactValue) ?? asText(record.phone) ?? asText(record.whatsapp);
  if (!raw) return null;
  const number = raw.replace(/\D/g, '');
  if (number.length < 8 || number.length > 15) return null;
  return `https://wa.me/${number}`;
}

/** Return an intentionally small DTO: no message transcript, name, email, or raw phone. */
function conversationDto(record: SupportRecord) {
  return {
    id: record.id,
    status: asText(record.status) ?? 'open',
    summary: asText(record.summary) ?? asText(record.title),
    contactMethod: asText(record.contactMethod) ?? asText(record.contactChannel),
    whatsappHref: whatsappHref(record) ?? waLink(`مرحباً، أتابع بخصوص محادثة الدعم رقم ${String(record.id)}`),
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
    whatsappHref: whatsappHref(record) ?? waLink(`مرحباً، أتابع بخصوص طلب الدعم رقم ${String(record.id)}`),
    createdAt: asDate(record.createdAt),
    updatedAt: asDate(record.updatedAt),
    closedAt: asDate(record.closedAt) ?? asDate(record.resolvedAt),
  };
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const db = prisma as unknown as SupportDb;
  const [conversations, escalations] = await Promise.all([
    db.chatConversation.findMany({ take: 100 }),
    db.chatEscalation.findMany({ take: 100 }),
  ]);

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
    capabilities: {
      assignEscalation: escalationFields.has('assignedTo'),
      updateConversationStatus: conversationFields.has('status'),
    },
  });
}