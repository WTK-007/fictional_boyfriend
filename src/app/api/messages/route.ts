import { NextRequest, NextResponse } from 'next/server';
import { getMessagesForChat } from '@/db/repo';
import type { Message } from '@/types/chat';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const characterId = searchParams.get('characterId');

    if (!uid || !characterId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const rows = await getMessagesForChat(uid, characterId);

    const messages: Message[] = rows.map((r) => ({
      id: String(r.id),
      role: r.role,
      type: r.type,
      content: r.content,
      audioUri: r.audioUri ?? undefined,
      imageUri: r.imageUri ?? undefined,
      imagePrompt: r.imagePrompt ?? undefined,
      timestamp: r.createdAt.getTime(),
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json({ messages: [] }, { status: 200 });
  }
}
