// 一次性清理:删除 Phase 2 sanity check 时插入的测试用户
// 执行: pnpm tsx --env-file=.env.local scripts/cleanup-betterauth-test-user.ts
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
  const res = await db.execute(
    sql`DELETE FROM "users" WHERE "email" = 'betterauth-test@example.com'`,
  );
  const count = (res as unknown as { rowCount?: number }).rowCount ?? 0;
  console.info(`[cleanup] 删除测试用户: ${count} 行 (含级联 sessions/accounts)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[cleanup] 失败:', err);
    process.exit(1);
  });
