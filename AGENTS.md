# 纸片人男友 - AI虚拟恋爱聊天

## 项目概述

AI虚拟恋爱聊天产品：用户选择一个有人设的虚拟男友角色，通过文字聊天互动。角色会回复文字、发语音消息、还会主动发"自拍照片"。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **AI SDK**: coze-coding-dev-sdk (LLM + TTS + 图像生成)

## 目录结构

```
├── public/                     # 静态资源
├── scripts/                    # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts   # 对话生成 API (LLM)
│   │   │   ├── tts/route.ts    # 语音合成 API
│   │   │   └── image/route.ts  # 图像生成 API
│   │   ├── layout.tsx          # 全局布局
│   │   ├── page.tsx            # 主页面（客户端路由）
│   │   └── globals.css         # 全局样式
│   ├── components/
│   │   ├── ui/                 # Shadcn UI 组件库
│   │   ├── CharacterSelect.tsx # 角色选择界面
│   │   └── ChatScreen.tsx      # 聊天主界面（含消息气泡/语音/图片）
│   ├── context/
│   │   └── ChatContext.tsx      # 聊天状态管理
│   ├── data/
│   │   └── characters.ts       # 角色数据和系统提示词
│   ├── types/
│   │   └── chat.ts             # TypeScript 类型定义
│   ├── utils/
│   │   ├── parseReply.ts       # 解析 LLM 回复（提取 [IMAGE:] 标记）
│   │   └── cleanText.ts        # 文本清理（TTS用）
│   ├── hooks/                  # 自定义 Hooks
│   └── lib/utils.ts            # 通用工具函数
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心功能

1. **角色选择界面**: 4个预设角色卡片（林屿/顾冽/苏晨/沈默），2x2网格布局
2. **微信风格聊天界面**: 左侧角色消息/右侧用户消息，文字+语音+图片
3. **LLM 对话**: 角色扮演对话，支持完整对话历史记忆
4. **TTS 语音**: 每条回复自动生成语音，不同角色不同声线
5. **AI自拍**: LLM 通过 [IMAGE:] 标记触发图片生成，约3-5轮一次

## API 接口

- `POST /api/chat` - 对话生成（参数: characterId, messages）
- `POST /api/tts` - 语音合成（参数: text, speaker, uid）
- `POST /api/image` - 图像生成（参数: prompt, characterId, uid）

## 构建和测试命令

```bash
pnpm ts-check    # TypeScript 类型检查
pnpm lint:build  # ESLint 检查
pnpm build       # 构建
pnpm dev         # 开发服务器
```

## 关键设计决策

- 使用 `doubao-seed-2-0-lite-260215` 模型平衡性能与成本
- 对话历史限制最近20条消息，避免上下文过长
- TTS/图像生成失败不影响文字消息展示（优雅降级）
- 使用 `isGeneratingRef` 防止重复请求
- 语音波形高度使用预定义数组，避免渲染中使用 Math.random()
