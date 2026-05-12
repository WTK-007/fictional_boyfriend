import { NextRequest, NextResponse } from 'next/server';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { cleanTextForSpeech } from '@/utils/cleanText';

export async function POST(request: NextRequest) {
  try {
    const { text, speaker, uid } = await request.json();

    if (!text || !speaker) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 清理文本
    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) {
      return NextResponse.json(
        { error: '文本为空，跳过语音生成' },
        { status: 200 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new TTSClient(config, customHeaders);

    const response = await client.synthesize({
      uid: uid || 'default-user',
      text: cleanedText,
      speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    });

    return NextResponse.json({
      audioUri: response.audioUri,
      audioSize: response.audioSize,
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: '语音生成失败' },
      { status: 200 }
    );
  }
}
