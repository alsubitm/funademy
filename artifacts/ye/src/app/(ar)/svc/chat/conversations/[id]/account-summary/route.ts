import { NextRequest, NextResponse } from 'next/server';
import { reverifyFamilyConversation } from '@/lib/chat-auth';
import { accountSummary } from '@/lib/chat-tools';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await reverifyFamilyConversation(req, id);
  if (!conversation?.familyId) return NextResponse.json({ error: 'reauthentication_required' }, { status: 401 });
  const summary = await accountSummary(conversation.familyId);
  if (!summary) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ summary });
}