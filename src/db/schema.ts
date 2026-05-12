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

// ---------- users ----------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    uid: varchar('uid', { length: 64 }).notNull(),
    nickname: varchar('nickname', { length: 50 }),
    avatarUrl: text('avatar_url'),
    deviceFingerprint: varchar('device_fingerprint', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  },
  (t) => ({
    uidIdx: uniqueIndex('users_uid_idx').on(t.uid),
    deviceIdx: index('users_device_idx').on(t.deviceFingerprint),
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

// ---------- Relations ----------

export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  mediaAssets: many(mediaAssets),
  apiLogs: many(apiUsageLogs),
  characterStates: many(userCharacterState),
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
