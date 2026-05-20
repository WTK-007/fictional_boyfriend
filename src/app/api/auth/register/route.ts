import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword, setSessionCookie } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { getClientIp, verifyTurnstileToken } from '@/lib/turnstile';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(254),
  password: z.string().min(6, '密码至少 6 位').max(128, '密码过长'),
  nickname: z.string().trim().min(1).max(50).optional(),
  turnstileToken: z.string().min(1).max(2048).optional(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '参数校验失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { email, password, nickname, turnstileToken } = parsed.data;

  const verify = await verifyTurnstileToken(turnstileToken, getClientIp(request));
  if (!verify.success) {
    console.warn('Turnstile verify failed:', verify.errorCodes);
    return NextResponse.json({ error: '人机验证失败，请重试' }, { status: 403 });
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const uid = crypto.randomUUID();

  const [created] = await db
    .insert(users)
    .values({
      uid,
      email,
      passwordHash,
      nickname: nickname ?? email.split('@')[0],
    })
    .returning({
      id: users.id,
      uid: users.uid,
      email: users.email,
      nickname: users.nickname,
    });

  await setSessionCookie(created.id);

  // 发送欢迎邮件：失败不影响注册结果，仅记日志
  try {
    await sendWelcomeEmail(created.nickname ?? email.split('@')[0]);
  } catch (err) {
    console.error('[register] sendWelcomeEmail failed:', {
      email,
      uid: created.uid,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ user: created }, { status: 201 });
}
