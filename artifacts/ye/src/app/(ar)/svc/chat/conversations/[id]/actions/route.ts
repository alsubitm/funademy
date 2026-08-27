import { NextRequest, NextResponse } from 'next/server';
import { allowRate } from '@/lib/rate-limit';
import { reverifyFamilyConversation, requireChatCsrf } from '@/lib/chat-auth';
import { prepareActionSchema, prepareChatAction } from '@/lib/chat-tools';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireChatCsrf(req);
  if (csrf) return csrf;
  const { id } = await params;
  const conversation = await reverifyFamilyConversation(req, id);
  if (!conversation?.familyId) return NextResponse.json({ error: 'reauthentication_required' }, { status: 401 });
  if (!(await allowRate(`chat:action:${conversation.familyId}`, 10, 60 * 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const parsed = prepareActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  try {
    const action = await prepareChatAction(id, conversation.familyId, parsed.data);
    return NextResponse.json({
      action: {
        id: action.id,
        kind: action.kind,
        status: action.status,
        payload: action.payload,
        requiresExplicitConfirmation: true,
        expiresAt: action.expiresAt,
      },
    }, { status: action.status === 'prepared' ? 201 : 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'preparation_failed';
    return NextResponse.json({ error: code }, { status: code.includes('unavailable') ? 409 : 400 });
  }
}