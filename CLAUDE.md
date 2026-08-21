# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

WAMofa 是 WhatsApp Web 浏览器扩展，提供 AI 翻译、快捷回复、本地备注和语音转写功能。使用 WXT 框架构建，支持 Chrome/Firefox。

## 开发命令

```bash
npm run dev              # 开发模式（Chrome），输出到 .output/chrome-mv3-dev
npm run dev:firefox      # Firefox 开发模式
npm run build            # 生产构建，输出到 .output/chrome-mv3
npm run zip              # 打包为 .zip 文件
npm run compile          # TypeScript 类型检查（不生成代码）
```

**开发工作流**：
1. 修改代码后运行 `npm run build`（或保持 `npm run dev` 运行）
2. 在 `chrome://extensions` 点击扩展的**重新加载**按钮
3. 刷新 WhatsApp Web 标签页（`web.whatsapp.com`）

加载扩展时**必须选择** `.output/chrome-mv3`（生产）或 `.output/chrome-mv3-dev`（开发），不能选仓库根目录。

## 架构要点

### 扩展结构（WXT 框架）

```
src/entrypoints/
  background.ts           # Service Worker，处理所有 AI 请求
  content/index.tsx       # 注入 WhatsApp Web 的主入口
  options/App.tsx         # 选项页（设置 AI Key）
  popup/App.tsx           # 工具栏弹出页

src/content/              # Content script UI 组件和逻辑
  OverlayApp.tsx          # 顶层 React 容器（Shadow DOM）
  HeaderBar.tsx           # 会话头部增强（备注/标签/翻译开关）
  ComposeBar.tsx          # 输入框工具栏（翻译/快捷回复）
  messages.ts             # 消息气泡翻译注入
  scan.ts                 # DOM 扫描调度器（MutationObserver）
  header-insights.ts      # 号码归属地显示
  voice.ts                # 语音消息转写

src/lib/
  storage.ts              # chrome.storage.local 封装
  ai.ts                   # AI 翻译/转写 API 调用
  providers.ts            # AI 提供商配置（OpenAI/DeepSeek/...）
  types.ts                # TypeScript 类型定义
  messaging.ts            # content ↔ background 消息协议

src/wa/                   # WhatsApp DOM 操作
  dom.ts                  # 核心选择器和元素查找
  compose.ts              # 输入框文本插入
  contact-phone.ts        # 联系人号码提取
```

### 通信流程

```
Content Script → sendExtension() → Background → AI API
                                  ↓
Content Script ← response ←────────┘
```

- **Content script** 不直接调用 AI API，所有请求通过 `sendExtension()` 发送到 background
- **Background** 从 `chrome.storage.local` 读取 API Key，调用 AI 提供商，返回结果
- **Storage** 变更通过 `chrome.storage.onChanged` 触发 content script 刷新状态

### WhatsApp DOM 交互

WhatsApp Web 是高度动态的 React 应用，DOM 结构经常变化。关键策略：

1. **选择器层叠**（`src/wa/dom.ts`）：
   - 每个查找函数使用多个选择器候选（按优先级）
   - 优先使用 `data-testid`，回退到 CSS 类/属性组合
   - 示例：`getCompose()` 有 6+ 个候选选择器

2. **扫描机制**（`src/content/scan.ts`）：
   - `MutationObserver` 监听 DOM 变化，debounce 后调度扫描
   - `messages.ts`、`voice.ts` 等模块注册扫描回调
   - 每次导航（`wxt:locationchange`）和 storage 变化触发扫描

3. **增强标记**：
   - 已处理元素设置 `data-wamofa-enhanced="true"` 避免重复处理
   - 清除缓存时调用 `clearMessageCaches()` 重置状态

4. **Shadow DOM 隔离**：
   - UI 组件渲染在 Shadow Root，避免与 WhatsApp 样式冲突
   - Tailwind CSS 仅作用于 Shadow DOM 内部

## AI 提供商

`src/lib/providers.ts` 定义支持的 AI 服务商：

- **OpenAI**：文本 + 语音转写
- **DeepSeek**（默认）：仅文本
- **Gemini**、**Grok**、**硅基流动**

添加新提供商：
1. 在 `PROVIDERS` 数组添加配置
2. 设置 `supportsTranscribe: true`（如果支持 `/v1/audio/transcriptions`）
3. `normalizeProviderId()` 处理别名映射

## 重要约束

1. **不保存号码**：扩展不存储联系人电话号码，仅从 DOM 实时解析用于显示归属地
2. **纯本地**：备注、标签存在 `chrome.storage.local`，不上传云端
3. **不群发**：设计上无批量发送、自动回复、定时发送功能
4. **安全第一**：API Key 仅在 background script 可读，content script 仅能获取 `toPublicState()`（无密钥）

## 调试

- Content script 日志：在 WhatsApp Web 页面打开 DevTools
- Background script 日志：`chrome://extensions` → WAMofa 详情 → **Service Worker** → 查看
- Storage 内容：DevTools → Application → Storage → Local Storage → `chrome-extension://...`
