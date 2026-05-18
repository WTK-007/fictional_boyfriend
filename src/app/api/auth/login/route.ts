import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { setSessionCookie, verifyPassword } from '@/lib/auth';
import { getClientIp, verifyTurnstileToken } from '@/lib/turnstile';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(254),
  password: z.string().min(1).max(128),
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
    return NextResponse.json({ error: '邮箱或密码格式不正确' }, { status: 400 });
  }
  const { email, password, turnstileToken } = parsed.data;

  const verify = await verifyTurnstileToken(turnstileToken, getClientIp(request));
  if (!verify.success) {
    console.warn('Turnstile verify failed:', verify.errorCodes);
    return NextResponse.json({ error: '人机验证失败，请重试' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: users.id,
      uid: users.uid,
      email: users.email,
      nickname: users.nickname,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
  }

  await db
    .update(users)
    .set({ lastActiveAt: new Date() })
    .where(eq(users.id, user.id));

  await setSessionCookie(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      uid: user.uid,
      email: user.email,
      nickname: user.nickname,
    },
  });
}
