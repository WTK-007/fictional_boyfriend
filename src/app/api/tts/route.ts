import { NextRequest, NextResponse } from 'next/server';
import { cleanTextForSpeech } from '@/utils/cleanText';

const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

export async function POST(request: NextRequest) {
  try {
    const { text, speaker, uid } = await request.json();

    if (!text || !speaker) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) {
      return NextResponse.json(
        { error: '文本为空，跳过语音生成' },
        { status: 200 },
      );
    }

    const apiKey = process.env.VOLC_SPEECH_API_KEY;
    const resourceId = process.env.VOLC_SPEECH_RESOURCE_ID || 'seed-tts-2.0';
    if (!apiKey) {
      throw new Error('VOLC_SPEECH_API_KEY 未配置');
    }

    const upstream = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': crypto.randomUUID(),
      },
      body: JSON.stringify({
        user: { uid: uid || 'default-user' },
        req_params: {
          text: cleanedText,
          speaker,
          audio_params: { format: 'mp3', sample_rate: 24000 },
        },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      throw new Error(`TTS upstream ${upstream.status}: ${errText.slice(0, 200)}`);
    }

    const audioChunks: string[] = [];
    let finished = false;
    let lastError: { code: number; message: string } | null = null;

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;

        let evt: { code: number; message?: string; data?: string | null };
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }

        if (evt.code === 20000000) {
          finished = true;
          break;
        }
        if (evt.code !== 0) {
          lastError = { code: evt.code, message: evt.message || '' };
          break;
        }
        if (typeof evt.data === 'string' && evt.data) {
          audioChunks.push(evt.data);
        }
      }
      if (finished || lastError) break;
    }

    if (lastError) {
      throw new Error(`TTS code=${lastError.code} ${lastError.message}`);
    }
    if (!audioChunks.length) {
      throw new Error('TTS 未返回音频数据');
    }

    const audioBuffer = Buffer.concat(
      audioChunks.map(b64 => Buffer.from(b64, 'base64')),
    );
    const audioUri = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;

    return NextResponse.json({ audioUri, audioSize: audioBuffer.length });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json({ error: '语音生成失败' }, { status: 200 });
  }
}
