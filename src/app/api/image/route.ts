import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCharacterById } from '@/data/characters';
import { ensureConversation, insertMessage } from '@/db/repo';
import { uploadToR2 } from '@/lib/r2';

export const runtime = 'nodejs';

function pickImageExt(contentType: string | null): string {
  if (!contentType) return 'png';
  if (contentType.includes('jpeg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'png';
}

async function persistTempImageToR2(
  tempUrl: string,
  characterId: string,
): Promise<{ url: string; sizeBytes: number; contentType: string }> {
  const dl = await fetch(tempUrl);
  if (!dl.ok) {
    throw new Error(`下载临时图片失败: ${dl.status}`);
  }
  const contentType = dl.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await dl.arrayBuffer());
  const ext = pickImageExt(contentType);
  const key = `images/${characterId}/${crypto.randomUUID()}.${ext}`;
  const url = await uploadToR2(buffer, key, contentType);
  return { url, sizeBytes: buffer.length, contentType };
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, characterId, uid } = await request.json();

    if (!prompt || !characterId) {
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

    // 增强 prompt：加入角色外貌和画风要求
    const enhancedPrompt = `${prompt}。画风要求：动漫风格，高质量，精细，${character.appearance}。不要出现文字。`;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    const response = await client.generate({
      prompt: enhancedPrompt,
      size: '2K',
      watermark: false,
    });

    const helper = client.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      const tempImageUrl = helper.imageUrls[0];

      let imageUri: string;
      try {
        const stored = await persistTempImageToR2(tempImageUrl, characterId);
        imageUri = stored.url;
      } catch (uploadErr) {
        console.error('R2 image upload failed:', uploadErr);
        if (uid) {
          try {
            const { conversation } = await ensureConversation(uid, characterId);
            await insertMessage({
              conversationId: conversation.id,
              role: 'character',
              type: 'image',
              content: prompt,
              imagePrompt: prompt,
              imageStatus: 'failed',
            });
          } catch (dbErr) {
            console.error('Image persist error (non-blocking):', dbErr);
          }
        }
        return NextResponse.json(
          { error: '图片存储失败', imageUri: '' },
          { status: 200 },
        );
      }

      if (uid) {
        try {
          const { conversation } = await ensureConversation(uid, characterId);
          await insertMessage({
            conversationId: conversation.id,
            role: 'character',
            type: 'image',
            content: prompt,
            imageUri,
            imagePrompt: prompt,
            imageStatus: 'done',
          });
        } catch (dbErr) {
          console.error('Image persist error (non-blocking):', dbErr);
        }
      }

      return NextResponse.json({ imageUri });
    } else {
      console.error('Image generation failed:', helper.errorMessages);

      if (uid) {
        try {
          const { conversation } = await ensureConversation(uid, characterId);
          await insertMessage({
            conversationId: conversation.id,
            role: 'character',
            type: 'image',
            content: prompt,
            imagePrompt: prompt,
            imageStatus: 'failed',
          });
        } catch (dbErr) {
          console.error('Image persist error (non-blocking):', dbErr);
        }
      }

      return NextResponse.json(
        { error: '图片生成失败', imageUri: '' },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Image API error:', error);
    return NextResponse.json(
      { error: '图片生成失败', imageUri: '' },
      { status: 200 }
    );
  }
}
