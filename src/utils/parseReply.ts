/**
 * 解析 LLM 回复:
 *   首选 JSON 协议 { text, shouldSendImage, imagePrompt }(主路径,A 方案)
 *   退化策略 1: 抠出文本中的 JSON 块(模型偶尔会带 ```json 包裹或前后赘述)
 *   退化策略 2: 老的 [IMAGE: ...] 标记(向后兼容,迁移期保留)
 *   退化策略 3: 纯文本,不带图
 */

export interface ParsedReply {
  text: string;
  imagePrompt: string | null;
}

export function parseReply(reply: string): ParsedReply {
  const raw = (reply ?? '').trim();
  if (!raw) return { text: '', imagePrompt: null };

  const direct = tryParseJsonReply(raw);
  if (direct) return direct;

  const block = extractJsonBlock(raw);
  if (block) {
    const fromBlock = tryParseJsonReply(block);
    if (fromBlock) return fromBlock;
  }

  const legacy = raw.match(/\[IMAGE:\s*(.+?)\]/);
  if (legacy) {
    return {
      text: raw.replace(/\[IMAGE:\s*.+?\]/, '').trim(),
      imagePrompt: legacy[1]?.trim() || null,
    };
  }

  return { text: raw, imagePrompt: null };
}

function tryParseJsonReply(raw: string): ParsedReply | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;

  const o = obj as Record<string, unknown>;
  const text = typeof o.text === 'string' ? o.text.trim() : '';
  if (!text) return null;

  const shouldSendImage = o.shouldSendImage === true;
  const promptRaw = typeof o.imagePrompt === 'string' ? o.imagePrompt.trim() : '';
  const imagePrompt = shouldSendImage && promptRaw ? promptRaw : null;

  return { text, imagePrompt };
}

function extractJsonBlock(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence?.[1]) return fence[1].trim();

  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last > first) {
    return raw.slice(first, last + 1);
  }
  return null;
}
