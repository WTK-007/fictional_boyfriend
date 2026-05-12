/**
 * 从 LLM 回复中提取 [IMAGE: ...] 标记
 */
export function parseReply(reply: string): {
  text: string;
  imagePrompt: string | null;
} {
  const imageMatch = reply.match(/\[IMAGE:\s*(.+?)\]/);
  const textContent = reply.replace(/\[IMAGE:\s*.+?\]/, '').trim();
  return {
    text: textContent,
    imagePrompt: imageMatch ? imageMatch[1] : null,
  };
}
