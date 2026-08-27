import { NextRequest, NextResponse } from 'next/server';
import { reverifyFamilyConversation, requireChatCsrf } from '@/lib/chat-auth';
import { executeChatAction } from '@/lib/chat-tools';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> },
) {
  const csrf = requireChatCsrf(req);
  if (csrf) return csrf;
  const { id, actionId } = await params;
  const conversation = await reverifyFamilyConversation(req, id);
  if (!conversation?.familyId) return NextResponse.json({ error: 'reauthentication_required' }, { status: 401 });
  try {
    const action = await executeChatAction(actionId, id, conversation.familyId);
    return NextResponse.json({
      action: { id: action.id, kind: action.kind, status: action.status, result: action.result, executedAt: action.executedAt },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'execution_failed';
    return NextResponse.json({ error: code }, { status: code === 'action_not_found' ? 404 : 409 });
  }
}