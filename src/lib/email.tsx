import { Resend } from 'resend';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { WelcomeEmail } from '@/emails/WelcomeEmail';
import { DailyLoveLetter } from '@/emails/DailyLoveLetter';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = '纸片人男友 <hello@paperboyfriend.space>';
const APP_URL = 'https://paperboyfriend.space';

export async function sendWelcomeEmail(userEmail: string, userName: string) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: userEmail,
    subject: '你好呀,我是你的专属男友 💌',
    react: <WelcomeEmail userName={userName} />,
  });
  if (error) throw new Error(`Resend error: ${error.name} - ${error.message}`);
  return data?.id ?? null;
}

// 单封发送:复用已生成好的文案,不再触发 LLM
export async function sendDailyLoveLetter(
  userEmail: string,
  userName: string,
  loveLetter: string,
) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: userEmail,
    subject: `早安 ${userName},今天也想你了`,
    react: <DailyLoveLetter userName={userName} loveLetter={loveLetter} appUrl={APP_URL} />,
  });
  if (error) throw new Error(`Resend error: ${error.name} - ${error.message}`);
  return data?.id ?? null;
}

// 群发并发数:Resend 默认 10 req/s,留出余量
const SEND_CONCURRENCY = 8;

// 群发:整批共用同一封 AI 文案,按并发分批发送;某个用户失败不影响其他用户
export async function sendDailyLoveLetterToAll() {
  // 1) 一次性生成共用文案(原来是 N 次 LLM 调用,现在只 1 次)
  let sharedLetter: string;
  try {
    sharedLetter = await generateLoveLetter();
  } catch (err) {
    console.error('[daily-letter] 生成共用文案失败,使用兜底文案:', err);
    sharedLetter = '早安。今天也想你了,记得好好吃饭。';
  }

  const rows = await db
    .select({ email: users.email, nickname: users.nickname })
    .from(users)
    .where(isNotNull(users.email));

  // 2) 按 SEND_CONCURRENCY 分块并发发送
  let success = 0;
  let failure = 0;
  const eligible = rows.filter((u): u is { email: string; nickname: string | null } =>
    Boolean(u.email),
  );

  for (let i = 0; i < eligible.length; i += SEND_CONCURRENCY) {
    const chunk = eligible.slice(i, i + SEND_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((u) => {
        const name = u.nickname?.trim() || u.email.split('@')[0];
        return sendDailyLoveLetter(u.email, name, sharedLetter);
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled') {
        success++;
      } else {
        failure++;
        console.error(
          `[daily-letter] 发送给 ${chunk[j].email} 失败:`,
          r.reason instanceof Error ? r.reason.message : String(r.reason),
        );
      }
    }
  }

  console.info(`[daily-letter] 群发结束: success=${success} failure=${failure} total=${eligible.length}`);
  return { success, failure, total: eligible.length };
}

// 共用文案:不再带 userName,模板里 greeting 行已经用 userName 个性化了
async function generateLoveLetter(): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config);
  const resp = await client.invoke(
    [
      {
        role: 'system' as const,
        content:
          '你是一个温柔体贴有点害羞的纸片人男友。请写一段早安情话,温柔不油腻,50-100 字一段,不要出现具体人名(用"你"代称),不要使用 emoji 或 markdown,直接输出文本即可,不要加引号、标题或解释。',
      },
      {
        role: 'user' as const,
        content: '给恋人写一段早安情话。',
      },
    ],
    {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.9,
    },
  );

  const text = (resp.content ?? '').trim();
  return text || '早安。今天也想你了,记得好好吃饭。';
}
