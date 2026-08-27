import { createHash, randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';

export const CHAT_VISITOR_COOKIE = 'ye_chat_visitor';
export const CHAT_RETENTION_DAYS = 90;
export const CHAT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: CHAT_RETENTION_DAYS * 24 * 60 * 60,
};

export const chatExpiry = () => new Date(Date.now() + CHAT_RETENTION_DAYS * 24 * 60 * 60_000);
export const newVisitorToken = () => randomBytes(32).toString('base64url');
export const visitorTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function chatIdentity(req: NextRequest) {
  const familyId = await getFamilyId();
  const visitorToken = req.cookies.get(CHAT_VISITOR_COOKIE)?.value;
  return {
    familyId,
    visitorHash: visitorToken ? visitorTokenHash(visitorToken) : null,
  };
}

export async function ownedConversation(req: NextRequest, id: string) {
  const identity = await chatIdentity(req);
  const conversation = await prisma.chatConversation.findFirst({
    where: {
      id,
      expiresAt: { gt: new Date() },
      OR: [
        ...(identity.familyId ? [{ familyId: identity.familyId }] : []),
        ...(identity.visitorHash ? [{ familyId: null, visitorTokenHash: identity.visitorHash }] : []),
      ],
    },
  });
  return { conversation, identity };
}

/** Actions always require the current family session, not merely a visitor token. */
export async function reverifyFamilyConversation(req: NextRequest, id: string) {
  const familyId = await getFamilyId();
  if (!familyId) return null;
  return prisma.chatConversation.findFirst({
    where: { id, familyId, expiresAt: { gt: new Date() } },
  });
}

/** Same-origin protection for cookie-authenticated chat mutations. Tests and
 * local server-to-server calls may omit browser Origin headers outside prod. */
export function requireChatCsrf(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) {
    return process.env.NODE_ENV === 'production'
      ? NextResponse.json({ error: 'csrf_origin_required' }, { status: 403 })
      : null;
  }
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const expected = `${forwardedProto || req.nextUrl.protocol.replace(':', '')}://${forwardedHost || req.headers.get('host') || req.nextUrl.host}`;
  try {
    if (new URL(origin).origin !== new URL(expected).origin) {
      return NextResponse.json({ error: 'csrf_invalid_origin' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'csrf_invalid_origin' }, { status: 403 });
  }
  return null;
}