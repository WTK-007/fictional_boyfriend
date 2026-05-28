import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { db } from './index';
import {
  conversations,
  messages,
  subscriptions,
  users,
  type Conversation,
  type Message,
  type Subscription,
  type User,
} from './schema';

// 一次最多拉多少条消息（前端首屏/翻页都用这个）
export const DEFAULT_MESSAGE_PAGE_SIZE = 20;
// 给 LLM 的上下文窗口（仅 text 类型）
export const LLM_CONTEXT_WINDOW = 20;

export async function getOrCreateUser(uid: string): Promise<User> {
  const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (existing[0]) return existing[0];

  // 匿名 uid 用户(未走 BetterAuth 注册)填占位 email/nickname,保持 schema notNull 约束
  // BetterAuth 注册路径会在 hook 里覆盖这两个字段
  const [created] = await db
    .insert(users)
    .values({
      uid,
      email: `${uid}@anonymous.local`,
      nickname: '游客',
    })
    .onConflictDoNothing({ target: users.uid })
    .returning();

  if (created) return created;

  // 冲突时(并发场景)再查一次
  const reFetched = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return reFetched[0]!;
}

export async function getOrCreateConversation(
  userId: string,
  characterId: string,
): Promise<Conversation> {
  const existing = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.characterId, characterId)))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(conversations)
    .values({ userId, characterId })
    .returning();
  return created;
}

interface InsertMessageInput {
  conversationId: string;
  role: 'user' | 'character';
  type: 'text' | 'voice' | 'image';
  content: string;
  rawContent?: string;
  audioUri?: string;
  audioDurationMs?: number;
  audioStatus?: 'pending' | 'done' | 'failed' | 'skipped';
  imageUri?: string;
  imagePrompt?: string;
  imageStatus?: 'pending' | 'done' | 'failed';
  clientMsgId?: string;
}

export async function insertMessage(input: InsertMessageInput): Promise<Message> {
  const [created] = await db.insert(messages).values(input).returning();

  await db
    .update(conversations)
    .set({
      messageCount: sql`${conversations.messageCount} + 1`,
      imageCount:
        input.type === 'image'
          ? sql`${conversations.imageCount} + 1`
          : conversations.imageCount,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, input.conversationId));

  return created;
}

/**
 * 找到 (uid, characterId) 对应的 conversationId,不存在返回 null。
 * 不会创建,纯只读 — 用于翻页/列表接口。
 */
export async function findConversationId(
  uid: string,
  characterId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.userId))
    .where(and(eq(users.uid, uid), eq(conversations.characterId, characterId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * 拉一页消息(展示用)。按 id DESC 拿最近 N 条,再反转成"老→新"返回。
 * - beforeId: 拿比这个 id 更老的消息(用于上滑加载更多)
 * - 多返回一条用来判断 hasMore,接口层会把那条切掉
 */
export async function getMessagesPage(
  conversationId: string,
  options: { limit?: number; beforeId?: number } = {},
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const limit = options.limit ?? DEFAULT_MESSAGE_PAGE_SIZE;
  const whereClauses = [eq(messages.conversationId, conversationId)];
  if (typeof options.beforeId === 'number') {
    whereClauses.push(lt(messages.id, options.beforeId));
  }

  // 多拿 1 条用来判断是否还有更老的
  const rows = await db
    .select()
    .from(messages)
    .where(and(...whereClauses))
    .orderBy(desc(messages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  // 反转回老→新,前端按时间顺序渲染
  page.reverse();
  return { messages: page, hasMore };
}

/**
 * 给 LLM 的上下文：只取最近 N 条 text 类型,按老→新返回。
 * 避免拉 voice/image 重复行,也避免长会话把整张表拉回来。
 */
export async function getRecentTextMessagesForLLM(
  conversationId: string,
  limit: number = LLM_CONTEXT_WINDOW,
): Promise<Pick<Message, 'role' | 'content'>[]> {
  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.type, 'text'),
      ),
    )
    .orderBy(desc(messages.id))
    .limit(limit);
  return rows.reverse();
}

/**
 * 兼容旧调用:拉首屏消息(最近 N 条)。
 * 老接口语义是"全部消息按时间升序",这里改成"最近 N 条按时间升序"。
 */
export async function getMessagesForChat(
  uid: string,
  characterId: string,
  options: { limit?: number; beforeId?: number } = {},
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const conversationId = await findConversationId(uid, characterId);
  if (!conversationId) return { messages: [], hasMore: false };
  return getMessagesPage(conversationId, options);
}


export async function ensureConversation(uid: string, characterId: string) {
  const user = await getOrCreateUser(uid);
  const conversation = await getOrCreateConversation(user.id, characterId);
  return { user, conversation };
}

// ---------- Creem 订阅 ----------

export type UpsertSubscriptionInput = {
  userId: string;
  creemSubscriptionId: string;
  creemCustomerId?: string;
  creemProductId: string;
  status: Subscription['status'];
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  canceledAt?: Date;
  metadata?: Record<string, unknown>;
  eventAt: Date;
};

// 按 creem_subscription_id upsert;只在新事件时间 > 已存事件时间才覆盖,防止乱序 webhook 把状态回退
export async function upsertSubscriptionFromWebhook(input: UpsertSubscriptionInput): Promise<void> {
  await db
    .insert(subscriptions)
    .values({
      userId: input.userId,
      creemSubscriptionId: input.creemSubscriptionId,
      creemCustomerId: input.creemCustomerId ?? null,
      creemProductId: input.creemProductId,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      canceledAt: input.canceledAt ?? null,
      metadata: input.metadata ?? {},
      lastEventAt: input.eventAt,
    })
    .onConflictDoUpdate({
      target: subscriptions.creemSubscriptionId,
      set: {
        // userId 写入后不再覆盖(防止恶意 metadata 改绑)
        creemCustomerId: sql`COALESCE(${input.creemCustomerId ?? null}, ${subscriptions.creemCustomerId})`,
        creemProductId: input.creemProductId,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        canceledAt: input.canceledAt ?? null,
        metadata: input.metadata ?? {},
        lastEventAt: input.eventAt,
        updatedAt: new Date(),
      },
      where: sql`${subscriptions.lastEventAt} IS NULL OR ${subscriptions.lastEventAt} < ${input.eventAt}`,
    });
}

export async function findSubscriptionByCreemId(
  creemSubscriptionId: string,
): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.creemSubscriptionId, creemSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

// 当前是否有有效的订阅(trialing / active)。给前端"是否会员"判定用
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        sql`${subscriptions.status} IN ('trialing', 'active', 'scheduled_cancel')`,
        sql`(${subscriptions.currentPeriodEnd} IS NULL OR ${subscriptions.currentPeriodEnd} > NOW())`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

