import { Resend } from 'resend';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { WelcomeEmail } from '@/emails/WelcomeEmail';
import { DailyLoveLetter } from '@/emails/DailyLoveLetter';

const resend = new Resend(process.env.RESEND_API_KEY);

// 测试期收件箱被写死;域名 paperboyfriend.space 验证完成后,把 from 切回真实域名 + to 改成 userEmail
const FROM = '纸片人男友 <onboarding@resend.dev>';
const APP_URL = 'https://paperboyfriend.space';

export async function sendWelcomeEmail(userName: string) {
  await resend.emails.send({
    from: FROM,
    to: 'vullnetleka429@gmail.com',
    subject: '你好呀,我是你的专属男友 💌',
    react: <WelcomeEmail userName={userName} />,
  });
}

export async function sendDailyLoveLetter(userEmail: string, userName: string) {
  const loveLetter = await generateLoveLetter(userName);
  await resend.emails.send({
    from: FROM,
    to: userEmail,
    subject: `早安 ${userName},今天也想你了`,
    react: <DailyLoveLetter userName={userName} loveLetter={loveLetter} appUrl={APP_URL} />,
  });
}

// 群发:某个用户失败不影响其他用户
export async function sendDailyLoveLetterToAll() {
  const rows = await db
    .select({ email: users.email, nickname: users.nickname })
    .from(users)
    .where(isNotNull(users.email));

  let success = 0;
  let failure = 0;

  for (const u of rows) {
    if (!u.email) continue;
    const name = u.nickname?.trim() || u.email.split('@')[0];
    try {
      await sendDailyLoveLetter(u.email, name);
      success++;
    } catch (error) {
      failure++;
      console.error(
        `[daily-letter] 发送给 ${u.email} 失败:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.info(`[daily-letter] 群发结束: success=${success} failure=${failure} total=${rows.length}`);
  return { success, failure, total: rows.length };
}

async function generateLoveLetter(userName: string): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config);
  const resp = await client.invoke(
    [
      {
        role: 'system' as const,
        content:
          '你是一个温柔体贴有点害羞的纸片人男友。请给恋人写一段早安情话,温柔不油腻,50-100 字一段,不要使用 emoji 或 markdown,直接输出文本即可,不要加引号、标题或解释。',
      },
      {
        role: 'user' as const,
        content: `请给 ${userName} 写一段早安情话。`,
      },
    ],
    {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.9,
    },
  );

  const text = (resp.content ?? '').trim();
  return text || `早安,${userName}。今天也想你了。`;
}
