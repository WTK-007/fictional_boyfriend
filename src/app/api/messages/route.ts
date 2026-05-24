import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_MESSAGE_PAGE_SIZE, getMessagesForChat } from '@/db/repo';
import type { Message } from '@/types/chat';

const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const characterId = searchParams.get('characterId');
    const beforeRaw = searchParams.get('before');
    const limitRaw = searchParams.get('limit');

    if (!uid || !characterId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const beforeId = beforeRaw ? Number.parseInt(beforeRaw, 10) : undefined;
    if (beforeRaw && (!Number.isFinite(beforeId) || (beforeId as number) <= 0)) {
      return NextResponse.json({ error: 'before 不合法' }, { status: 400 });
    }

    let limit = limitRaw ? Number.parseInt(limitRaw, 10) : DEFAULT_MESSAGE_PAGE_SIZE;
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_MESSAGE_PAGE_SIZE;
    if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;

    const { messages: rows, hasMore } = await getMessagesForChat(uid, characterId, {
      limit,
      beforeId,
    });

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

    return NextResponse.json({ messages, hasMore });
  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json({ messages: [], hasMore: false }, { status: 200 });
  }
}
