import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  findSubscriptionByCreemId,
  upsertSubscriptionFromWebhook,
} from '@/db/repo';
import {
  extractSubscriptionFields,
  getEventObject,
  getEventTimestamp,
  getEventType,
  resolveSubscriptionStatus,
  verifyWebhookSignature,
  type CreemWebhookEnvelope,
} from '@/lib/creem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNATURE_HEADER = 'creem-signature';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Creem webhook endpoint is live.',
    endpoint: '/api/webhooks/creem',
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[creem-webhook] CREEM_WEBHOOK_SECRET 未配置,拒绝处理');
    return NextResponse.json({ ok: false, error: 'webhook_not_configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.warn('[creem-webhook] 签名校验失败', { hasSignature: Boolean(signature) });
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
  }

  let envelope: CreemWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody) as CreemWebhookEnvelope;
  } catch (err) {
    console.warn('[creem-webhook] payload 不是合法 JSON', err);
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const eventType = getEventType(envelope);
  const eventId = typeof envelope.id === 'string' ? envelope.id : null;
  const eventAt = getEventTimestamp(envelope);
  const object = getEventObject(envelope);

  console.log('[creem-webhook] received', { eventId, eventType, eventAt: eventAt.toISOString() });

  // 任何 handler 抛错都吞掉返 200,避免 Creem 30s/1m/5m/1h 不断重试
  // (失败已落 console,运营可在 Creem dashboard 手动 resend)
  try {
    if (!eventType) {
      console.warn('[creem-webhook] 缺 eventType,跳过', { eventId });
      return NextResponse.json({ ok: true, eventId, eventType: null });
    }

    if (eventType.startsWith('subscription.')) {
      await handleSubscriptionEvent(eventType, object, eventAt);
    } else if (eventType === 'checkout.completed') {
      await handleCheckoutCompleted(object, eventAt);
    } else if (eventType === 'refund.created' || eventType === 'dispute.created') {
      // TODO: 这两类等会员场景跑通后,再决定怎么联动(收回权益 / 站内通知)
      console.log('[creem-webhook] 暂未处理', { eventType, eventId });
    } else {
      console.warn('[creem-webhook] 未识别事件', { eventType, eventId });
    }
  } catch (err) {
    console.error('[creem-webhook] handler error', { eventType, eventId, err });
  }

  return NextResponse.json({ ok: true, eventId, eventType });
}

// ---------- handlers ----------

async function handleSubscriptionEvent(
  eventType: string,
  object: Record<string, unknown>,
  eventAt: Date,
): Promise<void> {
  const fields = extractSubscriptionFields(object);

  if (!fields.subscriptionId) {
    console.warn('[creem-webhook] subscription 事件缺 subscriptionId,跳过', { eventType });
    return;
  }
  if (!fields.productId) {
    console.warn('[creem-webhook] subscription 事件缺 productId,跳过', {
      eventType,
      subscriptionId: fields.subscriptionId,
    });
    return;
  }

  const status = resolveSubscriptionStatus(eventType, fields.status);
  if (!status) {
    console.warn('[creem-webhook] 无法解析 status,跳过', { eventType, raw: fields.status });
    return;
  }

  const userId = await resolveUserId({
    metadata: fields.metadata,
    creemSubscriptionId: fields.subscriptionId,
    creemCustomerId: fields.customerId,
    customerEmail: extractCustomerEmail(object),
  });

  if (!userId) {
    console.error('[creem-webhook] 找不到对应 userId,落不到具体用户', {
      eventType,
      subscriptionId: fields.subscriptionId,
    });
    return;
  }

  await upsertSubscriptionFromWebhook({
    userId,
    creemSubscriptionId: fields.subscriptionId,
    creemCustomerId: fields.customerId,
    creemProductId: fields.productId,
    status: status as Parameters<typeof upsertSubscriptionFromWebhook>[0]['status'],
    currentPeriodStart: fields.currentPeriodStart,
    currentPeriodEnd: fields.currentPeriodEnd,
    canceledAt: fields.canceledAt,
    metadata: fields.metadata,
    eventAt,
  });

  console.log('[creem-webhook] 订阅已落库', {
    eventType,
    userId,
    subscriptionId: fields.subscriptionId,
    status,
  });
}

async function handleCheckoutCompleted(
  object: Record<string, unknown>,
  eventAt: Date,
): Promise<void> {
  // checkout.completed 主要用来确认订单创建;真正的"开通会员"以 subscription.active 为准。
  // 这里只在 object 里恰好带了 subscription 信息时,顺手落一条订阅(让前端能立刻看到)。
  const fields = extractSubscriptionFields(object);
  if (!fields.subscriptionId) {
    console.log('[creem-webhook] checkout.completed 无订阅信息(可能是一次性购买),仅记录');
    return;
  }

  await handleSubscriptionEvent('subscription.active', object, eventAt);
}

// ---------- 帮助函数:把 Creem 事件落到具体 user.id ----------

type ResolveUserInput = {
  metadata: Record<string, unknown> | undefined;
  creemSubscriptionId: string;
  creemCustomerId: string | undefined;
  customerEmail: string | undefined;
};

async function resolveUserId(input: ResolveUserInput): Promise<string | null> {
  // 1. checkout 创建时 metadata 写了 userId,最准
  const fromMetadata = input.metadata?.userId;
  if (typeof fromMetadata === 'string' && fromMetadata.length > 0) {
    const row = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, fromMetadata))
      .limit(1);
    if (row[0]) return row[0].id;
  }

  // 2. 历史订阅已绑过 user(续期 webhook 没带 metadata 的场景)
  const existing = await findSubscriptionByCreemId(input.creemSubscriptionId);
  if (existing) return existing.userId;

  // 3. 兜底:用 customer email 反查
  if (input.customerEmail) {
    const row = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.customerEmail))
      .limit(1);
    if (row[0]) return row[0].id;
  }

  return null;
}

function extractCustomerEmail(object: Record<string, unknown>): string | undefined {
  const customer = object.customer;
  if (customer && typeof customer === 'object') {
    const email = (customer as Record<string, unknown>).email;
    if (typeof email === 'string') return email;
  }
  if (typeof object.customer_email === 'string') return object.customer_email;
  return undefined;
}
