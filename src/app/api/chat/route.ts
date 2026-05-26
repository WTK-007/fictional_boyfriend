import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCharacterById } from '@/data/characters';
import {
  ensureConversation,
  getRecentTextMessagesForLLM,
  insertMessage,
} from '@/db/repo';
import { parseReply } from '@/utils/parseReply';

// 强制 LLM 输出为严格 JSON，前置一次显式的「这一轮要不要发图」判断
const JSON_OUTPUT_SPEC = `## 输出格式（必须严格遵守）
每次回复**只能**输出一个 JSON 对象，不要加任何解释、前后文字、Markdown 代码块包裹：

{"text":"要对用户说的话","shouldSendImage":false,"imagePrompt":null}

字段说明：
- text: 你这一轮的回复文本（不要把图片描述放进来）
- shouldSendImage: 布尔值。先判断这一轮是否触发了上面「发图规则」里的场景，触发了才填 true；没触发就 false。大多数轮次都应该是 false。
- imagePrompt: 当 shouldSendImage=true 时，写一段详细的图片描述（必须包含你的外貌特征 + 画面风格 + 当前场景）；为 false 时填 null。

示例：
用户："今天好累啊"
{"text":"辛苦啦～早点休息，水要记得喝","shouldSendImage":false,"imagePrompt":null}

用户："想看你"
{"text":"嗯...给你看一张，刚拍的","shouldSendImage":true,"imagePrompt":"一张温柔自拍，黑色微卷头发，银色细框眼镜，白衬衫，窗边自然光，日系清新风格，暖色调"}`;

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

    // 直接在 SQL 里 limit + 过滤 text，避免长会话把整张表拉回来
    const recentTexts = await getRecentTextMessagesForLLM(conversation.id);
    const textHistory = recentTexts.map((m) => ({
      role: (m.role === 'character' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }));

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const llmMessages = [
      { role: 'system' as const, content: `${character.systemPrompt}\n\n${JSON_OUTPUT_SPEC}` },
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
