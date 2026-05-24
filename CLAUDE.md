# CLAUDE.md

> 给 Claude Code（claude.ai/code）和接手本项目的所有 AI / 工程师看的项目说明书。
> 修改架构、依赖、规范时，请同步更新本文件。

---

## 1. 项目简介

**「纸片人男友」(paperboyfriend.space)** — 一个 AI 虚拟恋爱聊天 Web 应用。

- 用户登录 → 选一个有人设的虚拟男友（林屿 / 顾冽 / 苏晨 / 沈默） → 微信风格界面文字聊天
- 角色回复包含三种形态：**文字** + **自动合成语音** + **偶尔主动「发自拍」**
- 注册成功会自动收到一封欢迎信；后续可被「每日早安情书」群发触达
- 生产域名：`paperboyfriend.space`
- 本地开发端口：`3000`（macOS 上 5000 被 ControlCenter/AirPlay 占用，故改用 Next 默认 3000）

定位：娱乐型陪伴产品，不是严肃心理咨询；所有 LLM/TTS/图像产物都会落库 + 存 R2，方便审计与重放。

---

## 2. 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | Next.js 16.1.1 (App Router) | API 路由 + RSC + Client Components 混合 |
| 运行时 | Node.js（所有 API 路由显式 `runtime = 'nodejs'`） | 依赖 Node `crypto` / AWS SDK / Neon `ws` |
| 语言 | TypeScript 5.x | `strict` 开启；路径别名 `@/* → src/*` |
| UI | React 19 + shadcn/ui + Radix UI | 基础组件全在 `src/components/ui/` |
| 样式 | Tailwind CSS v4 | 主题变量在 `globals.css`；用 `cn()` 合并类名 |
| 表单 | react-hook-form + zod | 配 `@hookform/resolvers` |
| ORM | Drizzle ORM (`neon-serverless` driver) | Schema 在 `src/db/schema.ts` |
| 数据库 | Neon serverless Postgres | 通过 WebSocket 连接，需注入 `ws` |
| 对象存储 | Cloudflare R2（AWS S3 SDK 兼容） | 所有 AI 生成的音/图永久存这里 |
| AI SDK | `coze-coding-dev-sdk` | 聊天 / TTS / 图像生成统一走它 |
| 邮件 | Resend + React Email (`@react-email/components`) | 发件人 `hello@paperboyfriend.space` |
| 风控 | Cloudflare Turnstile (`@marsidev/react-turnstile`) | 注册 / 登录校验 |
| 客服 | Crisp (`src/components/crisp-chat.tsx`) | 站内悬浮聊天入口 |
| 鉴权 | scrypt 哈希密码 + HMAC-SHA256 cookie session | 见 `src/lib/auth.ts` |
| 包管理 | **pnpm 10.x（强制）** | `preinstall` 用 `only-allow` 阻止 npm/yarn |
| 部署 | 待确认（疑似扣子编程托管，见 `next.config.ts` 的 `*.dev.coze.site`） | |

---

## 3. 核心目录结构

```
fictional_boyfriend/
├── CLAUDE.md                    # ← 本文件，项目唯一说明书
├── README.md                    # 公开 README（结构上稍旧，以本文件为准）
├── .env.local.example           # 环境变量模板，复制为 .env.local 后填值
├── next.config.ts               # 禁止写死绝对路径（ESLint 强制）
├── eslint.config.mjs            # 含两条自定义 no-restricted-syntax 规则
├── drizzle.config.ts            # Drizzle CLI 配置（迁移输出到 drizzle/）
├── drizzle/                     # 自动生成的迁移 SQL，提交前检查再 push
├── scripts/                     # prepare.sh / validate.sh —— shell 脚本，ESLint 已忽略
├── public/                      # 静态资源（角色头像、favicon、manifest 等）
└── src/
    ├── app/                     # Next.js App Router
    │   ├── layout.tsx           # 全局布局 + 字体 + Crisp + Service Worker 注册
    │   ├── page.tsx             # 主入口（客户端，渲染 landing 或 chat）
    │   ├── not-found.tsx        # 自定义 404
    │   ├── manifest.ts          # PWA manifest
    │   ├── robots.ts            # robots.txt（动态）
    │   ├── globals.css          # Tailwind v4 + shadcn 主题变量
    │   ├── login/  register/    # 鉴权页面（用 AuthForm）
    │   ├── chat/                # 聊天页面壳
    │   └── api/
    │       ├── chat/route.ts    # ★ 核心 LLM 文本回复（落库）
    │       ├── tts/route.ts     # 语音合成 → R2 → 落 messages
    │       ├── image/route.ts   # 自拍图生成 → R2 → 落 messages
    │       ├── messages/        # 历史消息查询
    │       ├── auth/            # login / logout / me / register
    │       └── cron/daily-email/route.ts  # 每日情书群发，手动/定时触发
    ├── components/
    │   ├── ui/                  # shadcn 全量基础组件（优先复用，别重写）
    │   ├── landing/             # LandingPage / LandingAuth（未登录态首页）
    │   ├── CharacterSelect.tsx  # 角色选择 2x2 网格
    │   ├── ChatScreen.tsx       # ★ 聊天主界面（文字/语音/图片气泡）
    │   ├── AuthForm.tsx         # 登录 / 注册共用表单（含 Turnstile）
    │   ├── AuthHeader.tsx       # 顶部用户态栏
    │   ├── crisp-chat.tsx       # Crisp 在线客服注入
    │   └── ServiceWorkerRegister.tsx
    ├── context/
    │   └── ChatContext.tsx      # ★ sendMessage 编排 chat→tts→image 三段式
    ├── data/
    │   └── characters.ts        # ★ 角色源数据（人设 / systemPrompt / speaker / appearance）
    ├── db/
    │   ├── index.ts             # Pool 单例（globalThis 缓存，注入 ws）
    │   ├── schema.ts            # ★ 7 张表
    │   ├── repo.ts              # 仓储层（写消息时同步累加 conversations 计数）
    │   └── seed.ts              # pnpm db:seed 灌角色数据
    ├── emails/
    │   ├── WelcomeEmail.tsx     # 注册欢迎信
    │   └── DailyLoveLetter.tsx  # 每日早安情书
    ├── lib/
    │   ├── auth.ts              # scrypt + HMAC session
    │   ├── email.tsx            # sendWelcomeEmail / sendDailyLoveLetterToAll
    │   ├── r2.ts                # R2 上传封装（永久公开链接）
    │   ├── turnstile.ts         # Cloudflare Turnstile 校验
    │   ├── userId.ts            # fb_user_uid 生成 / 读写
    │   └── utils.ts             # cn() 等通用工具
    ├── hooks/                   # 自定义 hooks
    ├── types/
    │   └── chat.ts              # 聊天相关 TS 类型
    └── utils/
        ├── parseReply.ts        # ★ LLM JSON 回复三层容错解析
        └── cleanText.ts         # TTS 前的文本清理
```

★ 标注的是改动前应优先阅读的关键文件。

数据库表（`src/db/schema.ts`）：`users / characters / conversations / messages / media_assets / api_usage_logs / user_character_state`。

---

## 4. 常用命令

```bash
# —— 日常 ——
pnpm dev          # 起开发服务器（next dev --port 5000）
pnpm build        # 生产构建
pnpm start        # 起生产服务器（--port 5000）

# —— 静态检查（提交前必跑） ——
pnpm lint         # ESLint
pnpm lint:build   # ESLint --quiet（CI 用）
pnpm ts-check     # tsc --noEmit
pnpm validate     # 并行跑 ts-check + lint:build —— 提交 / 出 PR 前跑这个

# —— Drizzle（需 .env.local 配好 DATABASE_URL） ——
pnpm db:generate  # 根据 schema 生成迁移 SQL 到 drizzle/
pnpm db:push      # 直接 push schema 到 DB（开发用，跳过迁移文件）
pnpm db:studio    # 起 Drizzle Studio Web UI
pnpm db:seed      # 跑 src/db/seed.ts 灌角色数据（首次/换库后必跑）
```

**强制 pnpm**：`preinstall` 调用 `only-allow pnpm`，npm/yarn 会直接报错退出。
**Node 版本**：`engines` 仅锁定 pnpm ≥ 9，未显式声明 Node 版本；建议本地用 Next 16 兼容的 Node 20+。

> 测试命令：当前仓库**没有配置测试框架**（待确认是否需要补 Jest / Vitest / Playwright）。

---

## 5. 开发规范

### 5.1 ESLint 自定义规则（已强制，违反直接 fail）

定义在 `eslint.config.mjs`：

1. **禁止 `<head>` JSX 标签**
   → 用 Next 的 `export const metadata`；第三方 CSS / 字体走 `globals.css` 顶部 `@import` 或 `next/font`；`preload / preconnect / dns-prefetch` 用 `ReactDOM` 同名方法；JSON-LD 参考 Next 官方文档。
2. **`next.config.ts` 禁止写死绝对路径**
   → 必须用 `path.resolve(__dirname, ...)` / `import.meta.dirname` / `process.cwd()` 动态拼接。

### 5.2 路径别名

`@/*` → `./src/*`（已配 tsconfig）。内部导入一律用 `@/`，**禁止 `../../..` 这种相对路径**。

### 5.3 客户端 vs 服务端

- 需要状态 / 浏览器 API 的组件加 `'use client'`（`ChatContext`、`AuthForm`、`ChatScreen` 等）
- API 路由全部显式 `export const runtime = 'nodejs'`（依赖 Node `crypto` / AWS SDK / Neon `ws`，不可用 Edge）
- 服务端组件优先用 `async function Page()` + 直接 `await`，不要在 RSC 里写 `useEffect`

### 5.4 UI 与样式

- **优先复用 `src/components/ui/`** 的 shadcn 组件，不要从零写 `<button>`、`<input>` 这类基础元素
- 类名合并用 `cn()`（`src/lib/utils.ts`），不要手动字符串拼接
- 主题色用 CSS 变量（`bg-background` / `text-foreground` 等），不要硬编码十六进制色值

### 5.5 表单

`react-hook-form` + `zod` + `zodResolver`，schema 与组件放在一起，导出推断类型而非手写。

### 5.6 Drizzle 迁移流程

```
改 src/db/schema.ts
  → pnpm db:generate
  → 检查 drizzle/*.sql 是否符合预期
  → 开发：pnpm db:push
  → 生产：通过部署流程执行迁移（待确认是否有自动化）
```

别绕过 schema 直接在数据库改字段，`schema.ts` 是 single source of truth。

### 5.7 Git / 提交

- 提交前先 `pnpm validate`
- Commit message 风格参考最近的历史（`chore(crisp):`、`feat(ui):`、`feat(cron):` 这类带 scope 的中英文混合短句）
- 默认基于 `main`，PR 合到 `main`
- **不要在未沟通的情况下** 创建 commit / 推送 / 开 PR —— 一律走「先告知 → 用户确认 → 操作」

---

## 6. 高层架构（动手前必读）

### 6.1 一次对话的完整链路（核心！）

`ChatScreen` → `ChatContext.sendMessage` 触发三段式调用：

1. **`POST /api/chat`** — 同步：拿 LLM 文本回复并落库
2. **`POST /api/tts`** — 并行 fire-and-forget：合成语音、存 R2、再插入一条 `type='voice'` 的消息
3. **`POST /api/image`** — **仅当 chat 返回的 `imagePrompt` 非空时**触发；生成图、存 R2、插入 `type='image'` 消息

> TTS / 图片失败**不阻断**主对话流：前端 `catch` 静默，后端返回 200 + 空字段。
> 三段都对同一 `(uid, characterId)` 调 `ensureConversation` 找到或创建会话。

### 6.2 LLM JSON 协议（最容易踩坑的地方）

`src/app/api/chat/route.ts` 在 system prompt 尾部拼上 `JSON_OUTPUT_SPEC`，强制模型输出：

```json
{ "text": "...", "shouldSendImage": false, "imagePrompt": null }
```

**这一轮要不要发图，是模型在 JSON 里显式声明的**，不是后端启发式 / 关键词匹配。

`src/utils/parseReply.ts` 三层容错：
1. 直接 `JSON.parse`
2. 抠 ```` ```json ```` 代码块或 `{...}` 子串再 parse
3. 退化到老的 `[IMAGE: ...]` 标记（迁移期兼容）
4. 全失败 → 当纯文本，**不发图**

> 改 system prompt 时**绝对不能丢 JSON 格式约束**，否则 `imagePrompt` 永远是 null，「发自拍」功能直接哑火。

### 6.3 LLM 上下文构建

- 发给豆包的 `messages` = system prompt + 最近 **20 条** `type='text'` 的消息
- `type='voice'` 和 `type='image'` 是同文本的展示副本，会被过滤掉（避免重复，见 `src/app/api/chat/route.ts:50-57`）
- 模型固定 `doubao-seed-2-0-lite-260215`，`temperature = 0.9`

### 6.4 数据层

- Neon serverless Postgres + Drizzle ORM（`neon-serverless` driver）
- `src/db/index.ts` 用 `globalThis` 缓存 Pool；Node runtime 下注入 `ws` 作为 WebSocket constructor
- 仓储函数集中在 `src/db/repo.ts`：插入消息会**同步累加** `conversations.messageCount / imageCount / lastMessageAt`，不要绕过它
- 角色数据：`src/data/characters.ts` 是源头，`pnpm db:seed` 灌库；运行时 API **直接读 `getCharacterById`**（不读数据库）拿 `systemPrompt / speaker / appearance`

### 6.5 媒体存储（R2）

所有 AI 生成的音频 / 图片都过 `src/lib/r2.ts` 上传到 Cloudflare R2，**DB 里只存 `R2_PUBLIC_URL/...` 的永久公开链接**。

绝不要把第三方临时 URL（豆包返回的 expire 链接）直接写库 —— 几小时后就 404。

### 6.6 鉴权

- 密码：scrypt + 16B 随机 salt，存为 `scrypt$<saltHex>$<hashHex>` 字符串（`src/lib/auth.ts`）
- 会话：HMAC-SHA256 签名 `userId.signature`，写入 httpOnly cookie `fb_session`，30 天有效
- 签名密钥来自 `AUTH_SECRET`（fallback `DATABASE_URL`）—— **生产务必显式配 `AUTH_SECRET`**
- 注册 / 登录都过 Cloudflare Turnstile（`src/lib/turnstile.ts`）；本地无 `TURNSTILE_SECRET_KEY` 时跳过校验

**两套用户标识同时存在**：
- `users.id`（UUID，session / 外键用）
- `users.uid`（短字符串，前端 localStorage `fb_user_uid`、所有聊天 API 都用它）

两者在注册时绑定（`src/app/api/auth/register/route.ts` 给新用户分配 `uid`）。改动鉴权 / 用户相关逻辑前**先搞清楚当前函数处理的是哪一个**。

### 6.7 邮件

`src/lib/email.tsx` + `src/emails/*.tsx`（React Email）：

- `sendWelcomeEmail` — 注册成功后立即发，**失败不影响注册流程**
- `sendDailyLoveLetterToAll` — 群发每日早安信，遍历所有有 `email` 的用户，单个失败不影响其他人；情书正文由 LLM 实时生成
- 触发入口：`POST /api/cron/daily-email`，**目前依赖外部调度系统触发**（cron / Vercel Cron / 扣子定时任务，待确认）

发件人：`hello@paperboyfriend.space`。

---

## 7. 修改代码时的注意事项

### 7.1 改这些文件前请二次确认

| 文件 | 为什么要小心 |
|---|---|
| `src/app/api/chat/route.ts` | LLM JSON 协议、上下文拼接、落库三件套都在这里。改一行可能整个发图链路熄火。 |
| `src/utils/parseReply.ts` | 容错层；删掉旧 `[IMAGE:]` 兼容会让历史会话出问题。 |
| `src/db/schema.ts` | 改完必须跑 `db:generate`，并人工 review SQL 后再 push。 |
| `src/db/repo.ts` | 插消息时累加计数的逻辑，绕过会让会话列表数字错乱。 |
| `src/data/characters.ts` | 角色 systemPrompt 在这里；改了要重跑 `db:seed`。 |
| `src/lib/auth.ts` | 改 hash 格式或 session 编码会让所有老用户登录失效。 |
| `next.config.ts` / `eslint.config.mjs` | 受自定义 ESLint 规则保护，写法错了 lint 直接红。 |

### 7.2 通用准则

- **先读后改**：动一个模块前先看完 `ChatContext` + 对应 API 路由 + `repo.ts` 三处
- **保持「失败不阻断主流程」的优雅降级**：TTS / 图片 / 邮件失败一律返回 200 + 空字段，不抛
- **临时 URL 永远不写库**：图片 / 音频必须先上 R2 拿到永久链接再 insert
- **新加 API 路由**：默认 `export const runtime = 'nodejs'`，除非你能确定完全不用 Node API
- **新加表 / 字段**：走 schema.ts → generate → review SQL → push，**不要手写 SQL 直接执行**
- **新加环境变量**：同时更新本文件第 8 节 + `.env.local.example` + 部署平台的环境变量配置
- **新装依赖**：`pnpm add ...`；优先复用已有依赖（Radix / shadcn / drizzle / zod / react-hook-form），不要轻易引入功能重叠的库
- **碰到不确定的产品逻辑**：先问用户，不要按"常见做法"自己拍板

### 7.3 不要做的事

- 不要用 `npm` / `yarn` 装包（会被 preinstall 拒）
- 不要在 RSC 里写 `useState` / `useEffect`
- 不要在 `<head>` 里塞 JSX 标签（用 metadata）
- 不要在 `next.config.ts` 里写绝对路径
- 不要把豆包 / Coze 返回的临时图片 / 音频 URL 直接写进 `messages.imageUri / audioUri`
- 不要在没跟用户确认的情况下 `git push`、`gh pr create`、`git reset --hard` 等改变远端 / 不可逆的操作
- 不要在没跑过 `pnpm validate` 的情况下声明「完成了」

---

## 8. 环境变量速查

> 模板见 [`.env.local.example`](./.env.local.example) —— 复制为 `.env.local` 填值即可。下表是简表，详细注释看模板文件。

| 变量 | 必要性 | 用途 |
|---|---|---|
| `DATABASE_URL` | 必填 | Neon Postgres 连接串（带 `?sslmode=require`） |
| `AUTH_SECRET` | 生产必填 | session HMAC 签名密钥；缺省 fallback 到 `DATABASE_URL`，生产严禁裸跑 |
| `TURNSTILE_SECRET_KEY` | 生产必填 | Cloudflare Turnstile 服务端密钥；本地缺省时校验自动跳过 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 生产必填 | Turnstile 前端 site key（会暴露到浏览器） |
| `R2_ENDPOINT` | 必填 | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | 必填 | R2 凭证 |
| `R2_BUCKET_NAME` | 必填 | R2 桶名 |
| `R2_PUBLIC_URL` | 必填 | R2 公开访问前缀（落库存的就是 `${R2_PUBLIC_URL}/...`） |
| `VOLC_SPEECH_API_KEY` | 必填 | 字节火山 TTS API Key |
| `VOLC_SPEECH_RESOURCE_ID` | 可选 | TTS 资源 ID，缺省走 `seed-tts-2.0` |
| `RESEND_API_KEY` | 必填 | Resend 邮件；缺省时邮件发不出去但不阻断注册 |
| `CRON_SECRET` | 必填 | `/api/cron/daily-email` 的 Bearer Token；缺省时定时接口返回 401 |
| `NEXT_PUBLIC_CRISP_WEBSITE_ID` | 可选 | Crisp 在线客服 site ID；缺省时悬浮窗不加载 |
| `COZE_PROJECT_ENV` | 可选 | 设为 `'DEV'` 触发 layout 中的 dev-only 行为 |
| Coze SDK 相关 | 必填 | `coze-coding-dev-sdk` 通过 `new Config()` 自动从环境读取 token，具体 key 名见 SDK 文档（待确认） |

---

## 9. 输出风格要求（给 Claude 自己看）

在本项目里回答 / 改代码时，遵守以下风格：

1. **中文优先，技术词保留英文**：解释架构、写注释、commit message 用中文；变量名 / 函数名 / 文件名按代码原样。
2. **直接、少废话**：不要复述用户的问题；不要在结尾写"如果还有问题请告诉我"。
3. **改代码前先说明意图**：要改哪几个文件、为什么改，让用户能在动手前喊停。
4. **改代码后给一句话总结**：变更点 + 是否跑过 `pnpm validate`，不要长篇大论。
5. **不确定的地方写「待确认」**，不要硬编。比如部署平台、Coze 环境变量具体名、Cron 调度方来源 —— 这些当前都属于「待确认」。
6. **引用代码用 `file:line` 格式**：例如 `src/app/api/chat/route.ts:50` 让用户能直接点跳。
7. **不要随手生成 .md / 计划文档**：除非用户明确要求。
8. **破坏性操作前必须问**：删文件、`git reset --hard`、`db:push` 到生产库、改 schema 字段类型、`git push --force` 等。
9. **遵守优雅降级哲学**：写新逻辑时主动思考"这一步失败了主链路会不会崩"，倾向于返回 200 + 空字段而不是 500。
10. **本文件即唯一说明书**：架构 / 命令 / 规范有事实变化时同步更新本文件第 2/3/4/5/6/8 节，不要让它失真。

---

## 10. 关联文档

- [`README.md`](./README.md) — 面向外部的项目说明，技术细节以本文件为准
- [`.env.local.example`](./.env.local.example) — 环境变量模板
- [`drizzle/`](./drizzle/) — 数据库迁移 SQL 历史

---

**最后更新**：2026-05-24（首次按 `claude-howto/02-memory/project-CLAUDE.md` 模板重整；移除 AGENTS.md 依赖）
