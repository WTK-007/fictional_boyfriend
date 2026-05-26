// 一次性迁移:把老 users.passwordHash 搬到 BetterAuth 的 accounts 表 (providerId='credential')
// 保留原 scrypt$ 格式,运行时由 src/lib/auth-server.ts 里的 password.verify 自动识别
// 执行: pnpm tsx --env-file=.env.local scripts/migrate-passwords-to-betterauth.ts
// 幂等:ON CONFLICT DO NOTHING,重复运行不会重复插入
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
  // BetterAuth credential 账号约定:accountId === user.id (见 node_modules/better-auth/dist/plugins/*/routes.mjs)
  const res = await db.execute(
    sql`INSERT INTO "accounts" ("user_id", "account_id", "provider_id", "password")
        SELECT "id", "id"::text, 'credential', "password_hash"
        FROM "users"
        WHERE "password_hash" IS NOT NULL
        ON CONFLICT ("provider_id", "account_id") DO NOTHING`,
  );
  const count = (res as unknown as { rowCount?: number }).rowCount ?? 0;
  console.info(`[migrate] credential accounts 已建: ${count} 行`);
  console.info('[migrate] 提示:确认无残留登录问题后,可在 Phase 6 删除 users.password_hash 字段');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] 失败:', err);
    process.exit(1);
  });
