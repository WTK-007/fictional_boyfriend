import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCharacterById } from '@/data/characters';
import { ensureConversation, getMessagesForChat, insertMessage } from '@/db/repo';
import { parseReply } from '@/utils/parseReply';

export async function POST(request: NextRequest) {
  try {
    const { characterId, uid, content } = await request.json();

    if (!characterId || !uid || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const character = getCharacterById(characterId);
    if (!character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 400 });
    }

    const { conversation } = await ensureConversation(uid, characterId);

    // 先落库用户消息，再读历史 → 保证发给 LLM 的 history 包含本轮发言
    await insertMessage({
      conversationId: conversation.id,
      role: 'user',
      type: 'text',
      content: content.trim(),
    });

    const allMessages = await getMessagesForChat(uid, characterId);

    // 只用 text 类型构造 LLM 上下文（voice/image 是同一文本的展示拷贝，避免重复）
    const textHistory = allMessages
      .filter((m) => m.type === 'text')
      .slice(-20)
      .map((m) => ({
        role: (m.role === 'character' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      }));

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const llmMessages = [
      { role: 'system' as const, content: character.systemPrompt },
      ...textHistory,
    ];

    const response = await client.invoke(llmMessages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.9,
    });

    const rawReply: string = response.content ?? '';
    const { text, imagePrompt } = parseReply(rawReply);

    await insertMessage({
      conversationId: conversation.id,
      role: 'character',
      type: 'text',
      content: text,
      rawContent: rawReply,
      imagePrompt: imagePrompt ?? undefined,
    });

    return NextResponse.json({ text, imagePrompt });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { text: '网络不太好，等一下再试试～', imagePrompt: null },
      { status: 200 },
    );
  }
}
