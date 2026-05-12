import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCharacterById } from '@/data/characters';

export async function POST(request: NextRequest) {
  try {
    const { characterId, messages } = await request.json();

    if (!characterId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const character = getCharacterById(characterId);
    if (!character) {
      return NextResponse.json(
        { error: '角色不存在' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 限制对话历史长度，只发送最近 20 条消息
    const recentMessages = messages.slice(-20);

    const llmMessages = [
      { role: 'system' as const, content: character.systemPrompt },
      ...recentMessages.map((msg: { role: string; content: string }) => ({
        role: (msg.role === 'character' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    const response = await client.invoke(llmMessages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.9,
    });

    return NextResponse.json({ reply: response.content });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { reply: '网络不太好，等一下再试试～' },
      { status: 200 }
    );
  }
}
