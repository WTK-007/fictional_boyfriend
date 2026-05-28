import crypto from 'node:crypto';

// Creem API 文档:
//   https://docs.creem.io/features/checkout/checkout-api
//   https://docs.creem.io/learn/webhooks/introduction
// 测试 vs 生产由 API key 前缀自动识别:
//   creem_test_xxx → https://test-api.creem.io
//   creem_xxx      → https://api.creem.io

export type CreemMode = 'test' | 'live';

export function detectCreemMode(apiKey: string): CreemMode {
  return apiKey.startsWith('creem_test_') ? 'test' : 'live';
}

export function getCreemBaseUrl(apiKey: string): string {
  // 允许 env 显式覆盖,方便自定义代理 / 私有部署
  const override = process.env.CREEM_API_BASE_URL?.trim().replace(/\/$/, '');
  if (override) return override;
  return detectCreemMode(apiKey) === 'test'
    ? 'https://test-api.creem.io'
    : 'https://api.creem.io';
}

// ---------- 创建 Checkout Session ----------

export interface CreateCheckoutInput {
  productId: string;
  requestId?: string;
  successUrl: string;
  customer?: { email?: string };
  metadata?: Record<string, unknown>;
  units?: number;
  discountCode?: string;
}

export interface CreemCheckoutSession {
  id: string;
  checkout_url: string;
  product_id: string;
  status: string;
  [key: string]: unknown;
}

// ---------- 查询单个订阅 (用于 redirect 反查) ----------

// 官方 demo 在 success_url 落地后,从 query 拿 subscription_id 直接调这个接口反查,
// 比 redirect URL 签名校验稳。Creem 返回的 subscription 对象包含 status / customer /
// product / current_period_*_date / metadata 等字段。

export interface CreemSubscription {
  id: string;
  status: string;
  customer?: { id?: string; email?: string } | string;
  product?: { id?: string } | string;
  current_period_start_date?: string;
  current_period_end_date?: string;
  canceled_at?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function getSubscription(subscriptionId: string): Promise<CreemSubscription> {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) throw new Error('CREEM_API_KEY 未配置');

  const res = await fetch(`${getCreemBaseUrl(apiKey)}/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Creem getSubscription failed ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as CreemSubscription;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CreemCheckoutSession> {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) throw new Error('CREEM_API_KEY 未配置');

  const body: Record<string, unknown> = {
    product_id: input.productId,
    success_url: input.successUrl,
  };
  if (input.requestId) body.request_id = input.requestId;
  if (input.customer && input.customer.email) body.customer = { email: input.customer.email };
  if (input.metadata) body.metadata = input.metadata;
  if (input.units != null) body.units = input.units;
  if (input.discountCode) body.discount_code = input.discountCode;

  const res = await fetch(`${getCreemBaseUrl(apiKey)}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    // Creem checkout 创建偶发慢,15s 上限
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Creem create checkout failed ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as CreemCheckoutSession;
}

// ---------- success_url 回跳签名校验 ----------

// 文档: https://docs.creem.io/features/checkout/checkout-api
//   signature = HMAC-SHA256(sorted "key=value&..." 串, API key)
// 实现说明:
//   1. 用 URLSearchParams 拿到 Creem 实际拼上来的全部参数(不再硬编码白名单),
//      因为 Creem 实际可能比文档表格多塞 mode / request_id 等字段
//   2. 剔除 signature 自身 + 任何 null/空串
//   3. 按 key 字典序 sort,join 成 "key=value&key=value"
//   4. timingSafeEqual 比较

export type RedirectParams = {
  // 全量 query (含 signature)
  all: Record<string, string>;
  signature: string | null;
};

export function pickRedirectParams(searchParams: URLSearchParams): RedirectParams {
  const all: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) {
    all[k] = v;
  }
  return {
    all,
    signature: searchParams.get('signature'),
  };
}

// 把要参与签名的参数拼成 Creem 期望的字符串,返回 { payload, sortedKeys }
// 抽出来方便调试日志
export function buildRedirectSignaturePayload(all: Record<string, string>): {
  payload: string;
  sortedKeys: string[];
} {
  const filtered = Object.entries(all)
    .filter(([k, v]) => k !== 'signature' && v != null && v !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    payload: filtered.map(([k, v]) => `${k}=${v}`).join('&'),
    sortedKeys: filtered.map(([k]) => k),
  };
}

export function verifyRedirectSignature(params: RedirectParams, apiKey: string): boolean {
  if (!params.signature) return false;
  const { payload } = buildRedirectSignaturePayload(params.all);
  const expected = crypto.createHmac('sha256', apiKey).update(payload).digest('hex');
  return timingSafeHexEqual(params.signature, expected);
}

// 给一对 (params, apiKey),返回一份调试快照(不含 secret)。用于排查签名失败。
export function debugRedirectSignature(
  params: RedirectParams,
  apiKey: string,
): {
  sortedKeys: string[];
  payload: string;
  expectedSignature: string;
  receivedSignature: string | null;
  match: boolean;
} {
  const { payload, sortedKeys } = buildRedirectSignaturePayload(params.all);
  const expected = crypto.createHmac('sha256', apiKey).update(payload).digest('hex');
  return {
    sortedKeys,
    payload,
    expectedSignature: expected,
    receivedSignature: params.signature,
    match: params.signature
      ? timingSafeHexEqual(params.signature, expected)
      : false,
  };
}

// ---------- webhook 签名校验 ----------

// 文档: Creem webhook 在 header `creem-signature` 上挂 HMAC-SHA256(raw body, webhook secret)
// 必须用 raw body(不是 JSON.stringify(parsed))才能保证字节级一致

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeHexEqual(signature.trim(), expected);
}

function timingSafeHexEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ---------- webhook payload 解析 ----------

// Creem 文档里出现过两种事件信封写法,这里都兼容:
//   { id, eventType, created_at, object }
//   { event, data, created }
// 实际收到长这样,谁先来谁说了算。

export interface CreemWebhookEnvelope {
  id?: string;
  eventType?: string;
  type?: string;
  event?: string;
  created_at?: number | string;
  created?: number | string;
  object?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export function getEventType(envelope: CreemWebhookEnvelope): string | null {
  const value = envelope.eventType ?? envelope.type ?? envelope.event;
  return typeof value === 'string' ? value : null;
}

export function getEventObject(envelope: CreemWebhookEnvelope): Record<string, unknown> {
  return envelope.object ?? envelope.data ?? {};
}

export function getEventTimestamp(envelope: CreemWebhookEnvelope): Date {
  const raw = envelope.created_at ?? envelope.created;
  if (typeof raw === 'number') {
    // Creem 文档里举的是毫秒时间戳 (e.g. 1728734325927),保险起见两种都试
    return raw > 1e12 ? new Date(raw) : new Date(raw * 1000);
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

// 从 subscription / checkout 事件 object 里提取我们关心的字段
// 字段名以 Creem 官方常见命名为主,带常见 fallback

export interface ExtractedSubscriptionFields {
  subscriptionId?: string;
  customerId?: string;
  productId?: string;
  status?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  canceledAt?: Date;
  metadata?: Record<string, unknown>;
}

export function extractSubscriptionFields(object: Record<string, unknown>): ExtractedSubscriptionFields {
  const pickString = (...candidates: unknown[]): string | undefined => {
    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 0) return c;
    }
    return undefined;
  };

  const pickDate = (...candidates: unknown[]): Date | undefined => {
    for (const c of candidates) {
      if (typeof c === 'string') {
        const d = new Date(c);
        if (!Number.isNaN(d.getTime())) return d;
      } else if (typeof c === 'number') {
        return c > 1e12 ? new Date(c) : new Date(c * 1000);
      }
    }
    return undefined;
  };

  const subscriptionObj = (object.subscription ?? null) as Record<string, unknown> | null;
  const customerObj = (object.customer ?? null) as Record<string, unknown> | null;
  const productObj = (object.product ?? null) as Record<string, unknown> | null;

  // object.id 在 subscription.* 事件里就是 sub_xxx;在 checkout.completed 事件里是 ch_xxx,
  // 此时订阅 ID 一般在 object.subscription.id 上
  const topId = pickString(object.id);
  const subscriptionId = pickString(
    object.subscription_id,
    subscriptionObj?.id,
    topId && topId.startsWith('sub_') ? topId : undefined,
  );

  return {
    subscriptionId,
    customerId: pickString(object.customer_id, customerObj?.id),
    productId: pickString(object.product_id, productObj?.id),
    status: pickString(object.status, subscriptionObj?.status),
    currentPeriodStart: pickDate(
      object.current_period_start,
      object.current_period_start_date,
      subscriptionObj?.current_period_start,
      subscriptionObj?.current_period_start_date,
    ),
    currentPeriodEnd: pickDate(
      object.current_period_end,
      object.current_period_end_date,
      subscriptionObj?.current_period_end,
      subscriptionObj?.current_period_end_date,
      object.next_billing_date,
    ),
    canceledAt: pickDate(object.canceled_at, subscriptionObj?.canceled_at),
    metadata:
      object.metadata && typeof object.metadata === 'object'
        ? (object.metadata as Record<string, unknown>)
        : subscriptionObj?.metadata && typeof subscriptionObj.metadata === 'object'
          ? (subscriptionObj.metadata as Record<string, unknown>)
          : undefined,
  };
}

// event 名 → 数据库枚举的映射;不在表里的事件返回 null,handler 自己处理
const STATUS_FROM_EVENT: Record<string, string> = {
  'subscription.trialing': 'trialing',
  'subscription.active': 'active',
  'subscription.paid': 'active',
  'subscription.update': 'active', // 通用更新,具体状态以 object.status 为准
  'subscription.past_due': 'past_due',
  'subscription.paused': 'paused',
  'subscription.scheduled_cancel': 'scheduled_cancel',
  'subscription.canceled': 'canceled',
  'subscription.expired': 'expired',
};

export function resolveSubscriptionStatus(
  eventType: string,
  fromObject: string | undefined,
): string | null {
  const allowed = new Set([
    'trialing',
    'active',
    'past_due',
    'paused',
    'scheduled_cancel',
    'canceled',
    'expired',
  ]);
  // 优先用 object.status(Creem 显式声明),否则用事件名推断
  if (fromObject && allowed.has(fromObject)) return fromObject;
  const inferred = STATUS_FROM_EVENT[eventType];
  return inferred && allowed.has(inferred) ? inferred : null;
}
