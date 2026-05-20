# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

「纸片人男友」— AI 虚拟恋爱聊天 Web 应用。用户选角色 → 文字聊天 → 角色回复文字 + 自动生成语音 + 偶尔主动「发自拍」。生产域名 `paperboyfriend.space`，开发端口 `5000`。

## 常用命令

```bash
pnpm dev          # 起开发服务器 (next dev --port 5000)
pnpm build        # 生产构建
pnpm start        # 起生产服务器 (--port 5000)
pnpm lint         # ESLint
pnpm lint:build   # ESLint quiet mode (CI 用)
pnpm ts-check     # tsc 类型检查 (不输出文件)
pnpm validate     # ts-check + lint:build 并行 — 提交前跑这个

# Drizzle (DATABASE_URL 必须配在 .env.local)
pnpm db:generate  # 根据 schema 生成迁移 SQL 到 drizzle/
pnpm db:push      # 直接 push schema 到 DB (开发用，跳过迁移)
pnpm db:studio    # 起 Drizzle Studio
pnpm db:seed      # 跑 src/db/seed.ts 灌角色数据
```

**必须用 pnpm**，`preinstall` 脚本会用 `only-allow` 阻止 npm/yarn。

## 高层架构

### 一次对话的完整链路

`ChatScreen` → `ChatContext.sendMessage` 触发三段式调用：

1. `POST /api/chat` — 同步：拿 LLM 文本回复并落库
2. `POST /api/tts` — 并行 fire-and-forget：合成语音、存 R2、落库为 `type='voice'` 的新消息
3. `POST /api/image` — 仅当 chat 返回 `imagePrompt` 非空时触发；生成图、存 R2、落库为 `type='image'`

TTS/图片失败不阻断主对话流（前端 catch 静默，后端返回 200 + 空字段）。三段都对同一 `(uid, characterId)` 调 `ensureConversation` 找到或创建会话。

### LLM JSON 协议（关键）

`src/app/api/chat/route.ts` 把 `JSON_OUTPUT_SPEC` 拼到 system prompt 后，强制模型输出 `{"text", "shouldSendImage", "imagePrompt"}`。**判断「这一轮要不要发图」由模型在 JSON 里显式声明**，不是后端启发式。

`src/utils/parseReply.ts` 容错三层：
1. 直接 `JSON.parse`
2. 抠 ```` ```json ```` 代码块或 `{...}` 子串再 parse
3. 退化到老的 `[IMAGE: ...]` 标记（迁移期兼容）
4. 全失败 → 当纯文本，不发图

改 system prompt 时注意 JSON 格式约束不能丢，否则 `imagePrompt` 永远是 null。

### LLM 上下文构建

发给 doubao 的 `messages` = system prompt + 最近 20 条 **text 类型** 消息。`voice` 和 `image` 是同文本的展示副本，过滤掉避免重复（见 `chat/route.ts:50-57`）。

模型固定 `doubao-seed-2-0-lite-260215`，temperature `0.9`。

### 数据层

- **Neon serverless Postgres** + **Drizzle ORM** (`neon-serverless` driver)
- `src/db/index.ts` 用 `globalThis` 缓存 Pool；Node runtime 下注入 `ws` 作为 WebSocket constructor
- Schema 在 `src/db/schema.ts`：`users / characters / conversations / messages / media_assets / api_usage_logs / user_character_state`
- 仓储函数都集中在 `src/db/repo.ts`；插入消息会同步累加 `conversations.messageCount/imageCount/lastMessageAt`
- 角色（`characters` 表）由 `src/data/characters.ts` 提供源数据，通过 `pnpm db:seed` 灌库；运行时 LLM 路由直接读 `getCharacterById` 拿 `systemPrompt` / `speaker` / `appearance`，不读数据库

### 媒体存储（R2）

所有 AI 生成的音频/图片都过 `src/lib/r2.ts` → Cloudflare R2，DB 里只存 `R2_PUBLIC_URL/...` 的永久公开链接。绝不要把临时 URL 直接写库。需要的环境变量：`R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_URL`。

### 鉴权

- 密码：scrypt + 16B salt，存 `scrypt$<saltHex>$<hashHex>` 格式（`src/lib/auth.ts`）
- 会话：HMAC-SHA256 签名 `userId.signature`，写入 httpOnly cookie `fb_session`，30 天
- 签名密钥来自 `AUTH_SECRET`（fallback `DATABASE_URL`）— 生产务必显式配 `AUTH_SECRET`
- 注册/登录都过 **Cloudflare Turnstile** 校验（`src/lib/turnstile.ts`）；本地无 `TURNSTILE_SECRET_KEY` 时跳过

注意：同时存在两套用户标识 —— `users.id` (UUID，session 用) 和 `users.uid` (前端 localStorage 的 `fb_user_uid`，所有聊天 API 用)。两者由注册流程绑定（`register/route.ts:50` 给新用户分配 `uid`）。

### 邮件

`src/lib/email.tsx` 用 Resend + React Email：
- `sendWelcomeEmail` — 注册成功后发，失败不影响注册
- `sendDailyLoveLetterToAll` — 群发每日早安信，遍历有 email 的用户、单个失败不影响其他人；情书内容由 LLM 实时生成

发件人 `hello@paperboyfriend.space`。**目前没有定时器接线**，群发要手动触发。

## 项目约定

### ESLint 自定义规则（`eslint.config.mjs`）

1. **禁止 `<head>` JSX 标签** — 用 Next 的 `metadata` 导出；CSS/字体走 `globals.css` 的 `@import` 或 `next/font`
2. **`next.config.ts` 里禁止写死绝对路径** — 必须用 `path.resolve(__dirname, ...)` 等动态拼接

### 路径与别名

`@/*` → `./src/*`（tsconfig 已配）。所有内部导入用 `@/`，不要用相对路径回溯。

### 客户端 vs 服务端

- 聊天状态 (`ChatContext`)、表单 (`AuthForm`) 等用 `'use client'`
- API 路由全部 `runtime = 'nodejs'`（TTS/Image/Auth 路由显式声明，因为依赖 Node crypto / AWS SDK / Neon ws）

### Drizzle migration 流程

改 `src/db/schema.ts` → `pnpm db:generate` 生成 SQL → 检查 `drizzle/*.sql` → `pnpm db:push`（开发）或部署到生产。

## 环境变量速查

`.env.local` 至少需要：
- `DATABASE_URL` — Neon postgres connection string
- `AUTH_SECRET` — session 签名密钥
- `RESEND_API_KEY` — 邮件
- `VOLC_SPEECH_API_KEY` (+ 可选 `VOLC_SPEECH_RESOURCE_ID`) — 字节 TTS
- `R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_URL`
- `TURNSTILE_SECRET_KEY`（+ 前端 site key 见组件）
- Coze SDK 通过 `Config()` 自动从环境读 token，需要的 key 见 `coze-coding-dev-sdk` 文档

## AGENTS.md

仓库根目录有一份 `AGENTS.md`，是给「扣子编程」CLI 的同源说明，结构上和本文件重叠但更早期。修改架构时两边都要同步。
