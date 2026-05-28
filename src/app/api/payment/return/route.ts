import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  findSubscriptionByCreemId,
  upsertSubscriptionFromWebhook,
} from '@/db/repo';
import { auth } from '@/lib/auth-server';
import {
  extractSubscriptionFields,
  getSubscription,
  resolveSubscriptionStatus,
} from '@/lib/creem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Creem 完成支付后跳到这里 (success_url),query 上挂 checkout_id/order_id/subscription_id/...
// 文档:    https://docs.creem.io/features/checkout/checkout-api
// 参考实现: https://github.com/ja3nyc/creem-checkout-next-js-demo
//
// === 官方做法的核心 ===
// Creem 文档里那个 redirect URL 上的 signature 校验不靠谱(算法与文档对不上,官方 SDK
// 也没实现)。官方 demo 改用更稳的方式:用 subscription_id 直接调 Creem API 反查订阅,
// 拿到权威状态后写库 + 弹成功窗口。这条路与 webhook 互为兜底:
//
//   一切正常 — webhook 先到写库;redirect 后到查库已存在直接放行
//   webhook 慢 — redirect 主动查 Creem API,确认 status='active' 后写库,不必死等
//   webhook 丢 — redirect 兜底,用户照样能开通
//   伪造 redirect — Creem API 反查 subscription_id 不存在,直接报错不写库

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const origin =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.replace(/\/$/, '') ||
    url.origin;

  const redirect = (path: string) => NextResponse.redirect(`${origin}${path}`);

  const checkoutId = url.searchParams.get('checkout_id') ?? '';
  const subscriptionId = url.searchParams.get('subscription_id');

  // 没有 subscription_id 通常意味着这是一次性购买(checkout.completed 不带 sub),
  // 或者 Creem 没拼这个字段。无法反查,只能让用户先看到成功页,等 webhook 落库。
  if (!subscriptionId) {
    console.log('[creem-return] 无 subscription_id,跳过反查直接放行', { checkoutId });
    return redirect(`/?payment=success&status=ok&checkout_id=${encodeURIComponent(checkoutId)}`);
  }

  // 1. 先查我们自己的 DB,webhook 已经写过就直接放行
  const existing = await findSubscriptionByCreemId(subscriptionId);
  if (existing) {
    console.log('[creem-return] DB 已有订阅记录,直接放行', { subscriptionId, status: existing.status });
    return redirect(`/?payment=success&status=ok&checkout_id=${encodeURIComponent(checkoutId)}`);
  }

  // 2. DB 没有 → 调 Creem API 反查
  try {
    const sub = await getSubscription(subscriptionId);
    const fields = extractSubscriptionFields(sub as unknown as Record<string, unknown>);
    const status = resolveSubscriptionStatus('subscription.update', fields.status);

    if (!status || (status !== 'active' && status !== 'trialing')) {
      console.warn('[creem-return] Creem 返回的订阅状态非 active/trialing,不写库', {
        subscriptionId,
        rawStatus: fields.status,
      });
      return redirect(
        `/?payment=success&status=pending&checkout_id=${encodeURIComponent(checkoutId)}`,
      );
    }

    if (!fields.productId) {
      console.error('[creem-return] Creem 返回缺 productId,无法写库', { subscriptionId });
      return redirect(
        `/?payment=success&status=pending&checkout_id=${encodeURIComponent(checkoutId)}`,
      );
    }

    // 3. 解析 userId — 优先 metadata.userId (checkout 时塞进去的),
    //    回退用当前 BetterAuth session,最后兜底用 customer email 反查
    const userId = await resolveUserId({
      metadata: fields.metadata,
      customer: sub.customer,
      requestHeaders: request.headers,
    });
    if (!userId) {
      console.error('[creem-return] 找不到 userId,无法写库', { subscriptionId });
      return redirect(
        `/?payment=success&status=pending&checkout_id=${encodeURIComponent(checkoutId)}`,
      );
    }

    // 4. 写库(用同一套 upsert,跟 webhook 的写路径完全一致)
    await upsertSubscriptionFromWebhook({
      userId,
      creemSubscriptionId: subscriptionId,
      creemCustomerId: fields.customerId,
      creemProductId: fields.productId,
      status: status as Parameters<typeof upsertSubscriptionFromWebhook>[0]['status'],
      currentPeriodStart: fields.currentPeriodStart,
      currentPeriodEnd: fields.currentPeriodEnd,
      canceledAt: fields.canceledAt,
      metadata: fields.metadata,
      // redirect 反查没有 webhook 的 eventAt;用当前时间,webhook 真到时会按 lastEventAt
      // 大小决定要不要覆盖(我们的 upsert WHERE 条件已经处理这种乱序)
      eventAt: new Date(),
    });

    console.log('[creem-return] redirect 反查成功并写库', { subscriptionId, userId, status });
    return redirect(`/?payment=success&status=ok&checkout_id=${encodeURIComponent(checkoutId)}`);
  } catch (err) {
    // 反查 / 写库失败也不阻断用户:让他先看到成功页,等 webhook 兜底
    console.error('[creem-return] Creem API 反查失败,等 webhook 兜底', { subscriptionId, err });
    return redirect(
      `/?payment=success&status=pending&checkout_id=${encodeURIComponent(checkoutId)}`,
    );
  }
}

// ---------- userId 解析 ----------

type ResolveUserInput = {
  metadata: Record<string, unknown> | undefined;
  customer: { id?: string; email?: string } | string | undefined;
  requestHeaders: Headers;
};

async function resolveUserId(input: ResolveUserInput): Promise<string | null> {
  // 1. metadata.userId 最准 — checkout 创建时我们就塞进去了
  const fromMetadata = input.metadata?.userId;
  if (typeof fromMetadata === 'string' && fromMetadata.length > 0) {
    const row = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, fromMetadata))
      .limit(1);
    if (row[0]) return row[0].id;
  }

  // 2. 当前请求的 session — 用户付完款立刻跳回来,通常还登着
  try {
    const session = await auth.api.getSession({ headers: input.requestHeaders });
    if (session?.user?.id) return session.user.id;
  } catch {
    // ignore
  }

  // 3. Creem customer email 反查
  const customerEmail =
    typeof input.customer === 'object' && input.customer ? input.customer.email : undefined;
  if (customerEmail) {
    const row = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, customerEmail))
      .limit(1);
    if (row[0]) return row[0].id;
  }

  return null;
}
