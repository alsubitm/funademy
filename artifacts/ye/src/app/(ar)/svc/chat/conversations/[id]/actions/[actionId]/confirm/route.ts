import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reverifyFamilyConversation, requireChatCsrf } from '@/lib/chat-auth';
import { confirmChatAction, executeChatAction } from '@/lib/chat-tools';

export const dynamic = 'force-dynamic';

const schema = z.object({ confirm: z.literal(true) }).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> },
) {
  const csrf = requireChatCsrf(req);
  if (csrf) return csrf;
  const { id, actionId } = await params;
  const conversation = await reverifyFamilyConversation(req, id);
  if (!conversation?.familyId) return NextResponse.json({ error: 'reauthentication_required' }, { status: 401 });
  if (!schema.safeParse(await req.json().catch(() => null)).success) {
    return NextResponse.json({ error: 'explicit_confirmation_required' }, { status: 400 });
  }
  try {
    await confirmChatAction(actionId, id, conversation.familyId);
    const action = await executeChatAction(actionId, id, conversation.familyId);
    return NextResponse.json({ action: { id: action.id, kind: action.kind, status: action.status, result: action.result, executedAt: action.executedAt } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'confirmation_failed' }, { status: 409 });
  }
}