import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { verifyPassword as defaultVerifyPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { users, sessions, accounts, verifications } from '@/db/schema';
import { verifyTurnstileToken } from '@/lib/turnstile';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '@/lib/email';
import { isLegacyScryptHash, verifyLegacyScrypt } from '@/lib/legacy-scrypt';

// Google provider 只在配齐 clientId/clientSecret 时启用,避免本地缺配置时启动崩溃
const socialProviders: NonNullable<BetterAuthOptions['socialProviders']> = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  // 复用现有 AUTH_SECRET 作为 fallback,平滑过渡
  secret:
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.DATABASE_URL ||
    'dev-only-insecure-fallback',

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),

  user: {
    // BetterAuth 默认要求 user.name / user.image,通过 fields 映射到现有的 nickname / avatarUrl
    fields: {
      name: 'nickname',
      image: 'avatarUrl',
    },
    // 现有 schema 上的自定义字段,声明出来才能在 session.user 上读到
    // uid 在数据库层是 NOT NULL UNIQUE,但这里设 required: false
    // 否则 BetterAuth 会在请求校验阶段就要求客户端提供 uid,databaseHooks 没机会注入
    // 注入逻辑见下面的 databaseHooks.user.create.before
    additionalFields: {
      uid: { type: 'string', input: false, required: false },
      deviceFingerprint: { type: 'string', input: false, required: false },
      lastActiveAt: { type: 'date', input: false, required: false },
      // 仅 Phase 4 lazy 迁移期间还在 users 表上,迁完会从 schema 移除
      passwordHash: { type: 'string', input: false, required: false, returned: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    // Lazy 兼容老 scrypt$ 格式:
    // - 迁移期老用户的密码通过一次性脚本搬到 accounts.password,保留原 scrypt$ 格式
    // - 这里 verify 自动识别老/新两种格式;新注册仍走 BetterAuth 默认 hash
    password: {
      verify: async ({ hash, password }) => {
        if (isLegacyScryptHash(hash)) {
          return verifyLegacyScrypt(password, hash);
        }
        return defaultVerifyPassword({ hash, password });
      },
    },
    // 注意:暂未启用 requireEmailVerification,避免老用户(emailVerified=false)立刻无法登录
    // 待全量老用户走完一轮主动验证或迁移后,Phase 6 文档里说明如何打开
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendPasswordResetEmail(
          user.email,
          user.name?.trim() || user.email.split('@')[0],
          url,
        );
      } catch (err) {
        console.error('[auth] sendPasswordResetEmail failed:', {
          email: user.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await sendVerificationEmail(
          user.email,
          user.name?.trim() || user.email.split('@')[0],
          url,
        );
      } catch (err) {
        console.error('[auth] sendVerificationEmail failed:', {
          email: user.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  },

  socialProviders,

  account: {
    accountLinking: {
      enabled: true,
      // Google 的 email 由 Google 验证,可信
      trustedProviders: ['google'],
      // 只要 email 匹配就直接 link,不要求本地账号 emailVerified=true
      // ⚠️ BetterAuth 已标 @deprecated,下个 minor 会强制 true 并移除此选项;届时必须改回去
      // ⚠️ 安全权衡:有人抢注未验证账号占别人 email 时,受害者用 Google 登录会被 link 到攻击者行
      requireLocalEmailVerified: false,
    },
  },

  advanced: {
    database: {
      // PG + Drizzle 下 BetterAuth 会让数据库用 gen_random_uuid() 自动生成 ID
      generateId: 'uuid',
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // 所有新用户(邮密注册 + Google OAuth)都强制带一个 uid,前端聊天 API 用它
          // 不让客户端传入(additionalFields.uid.input: false),由服务端 randomUUID() 生成
          const userWithUid = user as typeof user & { uid?: string | null };
          if (!userWithUid.uid) {
            userWithUid.uid = randomUUID();
          }
          return { data: userWithUid };
        },
        after: async (user) => {
          // Welcome email — 失败不阻断注册;跳过匿名占位邮箱
          const u = user as { email?: string | null; name?: string | null };
          if (!u.email || u.email.endsWith('@anonymous.local')) return;
          try {
            await sendWelcomeEmail(u.email, u.name?.trim() || u.email.split('@')[0]);
          } catch (err) {
            console.error('[auth] sendWelcomeEmail failed:', {
              email: u.email,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        },
      },
    },
  },

  // Turnstile 校验:邮密注册/登录路径上读 x-turnstile-token header
  // (BetterAuth 客户端 SDK 的 body 类型是固定的,把 token 走 header 传)
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email' && ctx.path !== '/sign-in/email') return;
      const headers = ctx.headers as Headers | undefined;
      const token = headers?.get('x-turnstile-token') ?? null;
      const ip =
        headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers?.get('cf-connecting-ip') ||
        headers?.get('x-real-ip') ||
        null;
      const result = await verifyTurnstileToken(token, ip);
      if (!result.success) {
        console.warn('[auth] Turnstile verify failed:', result.errorCodes);
        throw new APIError('FORBIDDEN', { message: '人机验证失败,请重试' });
      }
    }),
  },
});

export type Auth = typeof auth;
export type Session = Auth['$Infer']['Session'];
