import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './index';
import {
  conversations,
  messages,
  users,
  type Conversation,
  type Message,
  type User,
} from './schema';

export async function getOrCreateUser(uid: string): Promise<User> {
  const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(users)
    .values({ uid })
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

export async function getMessagesForChat(
  uid: string,
  characterId: string,
): Promise<Message[]> {
  const userRows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (!userRows[0]) return [];

  const convRows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userRows[0].id),
        eq(conversations.characterId, characterId),
      ),
    )
    .limit(1);
  if (!convRows[0]) return [];

  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convRows[0].id))
    .orderBy(asc(messages.createdAt), asc(messages.id));
}

export async function ensureConversation(uid: string, characterId: string) {
  const user = await getOrCreateUser(uid);
  const conversation = await getOrCreateConversation(user.id, characterId);
  return { user, conversation };
}
