/**
 * 文本清理（TTS用）
 * 去掉图片标记、括号等不该朗读的内容
 */
export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\[IMAGE:\s*.+?\]/g, '')   // 去掉图片标记
    .replace(/（[^）]*）/g, '')           // 去掉中文括号
    .replace(/\([^)]*\)/g, '')           // 去掉英文括号
    .replace(/\[[^\]]*\]/g, '')          // 去掉中括号
    .replace(/[「」『』]/g, '')           // 去掉其他标点
    .trim();
}
