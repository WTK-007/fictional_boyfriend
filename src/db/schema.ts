import {
  pgTable,
  pgEnum,
  bigserial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------- Enums ----------

export const messageRoleEnum = pgEnum('message_role', ['user', 'character']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'voice', 'image']);
export const audioStatusEnum = pgEnum('audio_status', ['pending', 'done', 'failed', 'skipped']);
export const imageStatusEnum = pgEnum('image_status', ['pending', 'done', 'failed']);
export const mediaTypeEnum = pgEnum('media_type', ['audio', 'image']);
export const apiTypeEnum = pgEnum('api_type', ['chat', 'tts', 'image']);
export const apiStatusEnum = pgEnum('api_status', ['success', 'failure', 'timeout']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'paused',
  'scheduled_cancel',
  'canceled',
  'expired',
]);

// ---------- users (BetterAuth user 表,通过 fields 映射 name→nickname / image→avatarUrl) ----------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    uid: varchar('uid', { length: 64 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    // 仅保留用于 Phase 4 lazy 迁移:验证通过后会迁到 accounts.password,迁完可删
    passwordHash: text('password_hash'),
    nickname: varchar('nickname', { length: 50 }).notNull(),
    avatarUrl: text('avatar_url'),
    deviceFingerprint: varchar('device_fingerprint', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  },
  (t) => ({
    uidIdx: uniqueIndex('users_uid_idx').on(t.uid),
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    deviceIdx: index('users_device_idx').on(t.deviceFingerprint),
  }),
);

// ---------- sessions (BetterAuth) ----------

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('sessions_token_idx').on(t.token),
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

// ---------- accounts (BetterAuth: credential / google 等) ----------

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: varchar('provider_id', { length: 64 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('accounts_user_idx').on(t.userId),
    providerAccountIdx: uniqueIndex('accounts_provider_account_idx').on(
      t.providerId,
      t.accountId,
    ),
  }),
);

// ---------- verifications (BetterAuth: 邮箱验证 / 密码重置 token) ----------

export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    identifierIdx: index('verifications_identifier_idx').on(t.identifier),
  }),
);

// ---------- characters ----------

export const characters = pgTable('characters', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  tagline: varchar('tagline', { length: 200 }).notNull(),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  avatarUrl: text('avatar_url').notNull(),
  speaker: varchar('speaker', { length: 64 }).notNull(),
  systemPrompt: text('system_prompt').notNull(),
  appearance: text('appearance').notNull(),
  voiceStyle: varchar('voice_style', { length: 100 }),
  imageStyle: varchar('image_style', { length: 200 }),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- conversations ----------

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: varchar('character_id', { length: 32 })
      .notNull()
      .references(() => characters.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 100 }),
    messageCount: integer('message_count').notNull().default(0),
    imageCount: integer('image_count').notNull().default(0),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userListIdx: index('conversations_user_last_msg_idx').on(t.userId, t.lastMessageAt),
    userCharIdx: index('conversations_user_char_idx').on(t.userId, t.characterId),
  }),
);

// ---------- messages ----------

export const messages = pgTable(
  'messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    type: messageTypeEnum('type').notNull().default('text'),
    content: text('content').notNull(),
    rawContent: text('raw_content'),
    audioUri: text('audio_uri'),
    audioDurationMs: integer('audio_duration_ms'),
    audioStatus: audioStatusEnum('audio_status'),
    imageUri: text('image_uri'),
    imagePrompt: text('image_prompt'),
    imageStatus: imageStatusEnum('image_status'),
    clientMsgId: varchar('client_msg_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    convIdx: index('messages_conv_created_idx').on(t.conversationId, t.createdAt),
    clientMsgIdx: uniqueIndex('messages_client_msg_idx').on(t.clientMsgId),
  }),
);

// ---------- media_assets ----------

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: mediaTypeEnum('type').notNull(),
    uri: text('uri').notNull(),
    sizeBytes: integer('size_bytes'),
    prompt: text('prompt'),
    sourceText: text('source_text'),
    provider: varchar('provider', { length: 50 }),
    costCredits: integer('cost_credits'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTypeIdx: index('media_user_type_idx').on(t.userId, t.type),
  }),
);

// ---------- api_usage_logs ----------

export const apiUsageLogs = pgTable(
  'api_usage_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    apiType: apiTypeEnum('api_type').notNull(),
    status: apiStatusEnum('status').notNull(),
    latencyMs: integer('latency_ms'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    charsCount: integer('chars_count'),
    errorCode: varchar('error_code', { length: 50 }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTimeIdx: index('api_logs_user_time_idx').on(t.userId, t.createdAt),
    typeTimeIdx: index('api_logs_type_time_idx').on(t.apiType, t.createdAt),
  }),
);

// ---------- user_character_state ----------

export const userCharacterState = pgTable(
  'user_character_state',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: varchar('character_id', { length: 32 })
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    intimacyLevel: integer('intimacy_level').notNull().default(0),
    totalMessages: integer('total_messages').notNull().default(0),
    memorySummary: text('memory_summary'),
    userFacts: jsonb('user_facts').$type<Record<string, unknown>>().default({}),
    firstChatAt: timestamp('first_chat_at', { withTimezone: true }),
    lastChatAt: timestamp('last_chat_at', { withTimezone: true }),
  },
  (t) => ({
    userCharUnique: uniqueIndex('user_character_unique_idx').on(t.userId, t.characterId),
  }),
);

// ---------- subscriptions (Creem 支付订阅) ----------

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    creemSubscriptionId: text('creem_subscription_id').notNull(),
    creemCustomerId: text('creem_customer_id'),
    creemProductId: text('creem_product_id').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    // 用 Creem 事件时间避免乱序 webhook 把状态写回退
    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    creemSubIdx: uniqueIndex('subscriptions_creem_sub_idx').on(t.creemSubscriptionId),
    userStatusIdx: index('subscriptions_user_status_idx').on(t.userId, t.status),
    customerIdx: index('subscriptions_customer_idx').on(t.creemCustomerId),
  }),
);

// ---------- Relations ----------

export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  mediaAssets: many(mediaAssets),
  apiLogs: many(apiUsageLogs),
  characterStates: many(userCharacterState),
  sessions: many(sessions),
  accounts: many(accounts),
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const charactersRelations = relations(characters, ({ many }) => ({
  conversations: many(conversations),
  userStates: many(userCharacterState),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  character: one(characters, {
    fields: [conversations.characterId],
    references: [characters.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  user: one(users, { fields: [mediaAssets.userId], references: [users.id] }),
}));

export const userCharacterStateRelations = relations(userCharacterState, ({ one }) => ({
  user: one(users, { fields: [userCharacterState.userId], references: [users.id] }),
  character: one(characters, {
    fields: [userCharacterState.characterId],
    references: [characters.id],
  }),
}));

// ---------- Inferred Types ----------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type NewApiUsageLog = typeof apiUsageLogs.$inferInsert;
export type UserCharacterState = typeof userCharacterState.$inferSelect;
export type NewUserCharacterState = typeof userCharacterState.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
