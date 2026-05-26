// 一次性脚本:把现有 users 表里 NULL 的 email/nickname 填占位值
// 为 Phase 1 schema 改动 (SET NOT NULL) 做准备
// 执行: pnpm tsx --env-file=.env.local scripts/backfill-user-required-fields.ts
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
  const emailRes = await db.execute(
    sql`UPDATE "users" SET "email" = "uid" || '@anonymous.local' WHERE "email" IS NULL`,
  );
  const nicknameRes = await db.execute(
    sql`UPDATE "users" SET "nickname" = COALESCE(NULLIF(split_part("email", '@', 1), ''), '游客') WHERE "nickname" IS NULL`,
  );
  // pg 的 rowCount 在 result.rowCount;不同版本字段名可能不同,容错读
  const emailCount = (emailRes as unknown as { rowCount?: number }).rowCount ?? 0;
  const nicknameCount = (nicknameRes as unknown as { rowCount?: number }).rowCount ?? 0;
  console.info(`[backfill] email 填充: ${emailCount} 行`);
  console.info(`[backfill] nickname 填充: ${nicknameCount} 行`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill] 失败:', err);
    process.exit(1);
  });
