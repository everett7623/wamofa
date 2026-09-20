# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

WAMofa 是 WhatsApp Web 浏览器扩展（WXT + React 19 + Tailwind 4，支持 Chrome/Firefox），提供 AI 翻译/译出、客户备注与标签、快捷回复、语音转写、快速开聊。定位是「纯本地助手」：不存号码、不上云、不群发。

## 开发命令

```bash
npm run dev              # 开发模式（Chrome），输出到 .output/chrome-mv3-dev
npm run dev:firefox      # Firefox 开发模式
npm run build            # 生产构建，输出到 .output/chrome-mv3
npm run zip              # 打包为 .zip
npm run compile          # TypeScript 类型检查（tsc --noEmit）
```

- **没有测试框架**。CI（`.github/workflows/ci.yml`）只跑 `npm run compile` + `npm run build`，提交前至少保证这两步通过。
- 需要验证纯逻辑（如 `src/lib/phone.ts`）时，可把文件拷到临时目录用 `node xxx.mjs` 直接 `import './phone.ts'`（Node ≥ 22 自带类型剥离）。
- 加载扩展时**必须选择** `.output/chrome-mv3`（生产）或 `.output/chrome-mv3-dev`（开发），不能选仓库根目录。改完代码：`npm run build` → `chrome://extensions` 点重新加载 → 刷新 `web.whatsapp.com`。

## 发版约定

每次功能/修复都要同步以下四处，缺一不可（历史上多次漏掉 `package-lock.json` 和 `wxt.config.ts`）：

1. `package.json` 的 `version`
2. `package-lock.json` 顶部两处 `version`（第 3 行与第 9 行）
3. `wxt.config.ts` 的 `manifest.version`
4. `CHANGELOG.md` 顶部新增条目，沿用现有分节：`⚠️ 使用变化` / `✨ 功能` / `🐛 Bug 修复` / `🐛 数据安全`，写清「现象 → 根因」

版本号语义：修 Bug 升修订号，新功能升次版本。根目录的 `版本号管理规范.md`、`发布总结.md` 等多份 `.md` 是早期人工记录，其中提到的 `src/lib/import-export.ts` 已不存在，以本文件为准。

## 架构要点

### 三个运行环境与通信

```
content script (web.whatsapp.com)      popup / options 页
        │  sendExtension()                    │
        └──────────────► background ◄─────────┘
                        (Service Worker)
                          │ storage.ts / ai.ts
                          ▼
              chrome.storage.local  ·  AI 提供商 HTTP API
```

- 所有 AI 调用与状态读写都在 **background**（`src/entrypoints/background.ts`）里按 `WAMOFA_*` 消息类型分发；消息协议与响应类型定义在 `src/lib/messaging.ts`，新增消息类型先改这里的 union。
- Content script 只能拿到 `toPublicState()` 的结果（`PublicState`，不含 `apiKey`/`projectKey`）；只有 options 页通过 `WAMOFA_GET_PRIVATE` 读完整 `AppState`。
- Content script 内的「全局状态」放在 `src/content/runtime.ts`（当前 `PublicState` + 当前 chatId），非 React 模块（`messages.ts`、`scan.ts`）从这里读，不要再穿参数。

### 存储键的拆分（`src/lib/storage.ts`）

- 主配置键 `wamofa`（设置、模板、标签、会话元数据）与翻译缓存键 `wamofa_tx` **必须分开**：content script 高频写译文，若写在主键上会触发 `storage.onChanged` → 全量刷新 + 重扫 DOM，并与 background 的读-改-写互相覆盖导致备注丢失（0.2.17 的事故）。
- 写入走 `writeChain` / `txChain` 串行化；翻译缓存有 7 天 TTL 与 500 条上限。
- Content script 只监听 `changes.wamofa`，忽略 `wamofa_tx` 的变化。

### 会话身份键（`src/lib/chat-keys.ts`）

会话元数据以 `phone:<号码>` 或 `title:<标题>` 为键。能解析到号码时优先 `phone:`，否则退回 `title:`；`resolveChatLookup()` 统一按「phone → title → 当前 chatId」顺序查找，`migrateTitleToPhone()` 在号码首次解析成功时把 `title:` 数据并入 `phone:`。所有读写会话元数据的地方（HeaderBar、chat-list、OverlayApp）都必须经过这两个函数，不要自己拼键。

### Content script 生命周期（`src/entrypoints/content/index.tsx`）

```
waitForApp() → injectPageStyles() → refresh()(取 PublicState)
  → bindScanObserver() → initShortcuts() → 监听 wxt:locationchange / storage.onChanged
  → createShadowRootUi(OverlayApp) → runScan()
```

- 两套样式两个去处：`entrypoints/content/style.css` 通过 `cssInjectionMode: 'ui'` 只进 Shadow Root（给 `OverlayApp` 及其子组件）；`src/content/page-styles.ts` 里的 `PAGE_CSS` 注入 WhatsApp **光 DOM**（给消息气泡内的译文框、聊天列表圆点、右栏让位等）。改「长在 WhatsApp 元素上」的样式去 `page-styles.ts`，改面板样式去 `style.css`。
- Shadow host 是 `position: fixed; inset: 0; pointer-events: none` 的全屏层，面板自己开启 `pointer-events`；`isolateEvents` 拦住键盘事件避免 WhatsApp 抢焦点。
- 切换会话（`wxt:locationchange` 或状态刷新时 chatId 变化）要调用 `clearMessageCaches()`，否则上一个会话的译文渲染状态会串到下一个会话。

### 扫描机制（`src/content/scan.ts`）

`MutationObserver`（挂在 `#app`）→ `scheduleScan()`（setTimeout debounce + requestAnimationFrame 合并）→ `runScan()` 依次执行 `enhanceMessages` / `enhanceChatList` / `enhanceHeaderInsights`。新增「往 WhatsApp DOM 上挂东西」的模块，在 `runScan()` 里注册即可，并用 `data-wamofa-enhanced` 标记已处理元素避免重复注入。`voice.ts` 不是独立扫描项，由 `messages.ts` 在识别到语音气泡时调用。

### WhatsApp DOM 策略（`src/wa/`）

WhatsApp Web 的 DOM 频繁变动，**新版已移除大部分 `data-testid`**，因此：

- `dom.ts` 中每个查找函数都是「多候选选择器按优先级层叠」，`data-testid` 只作为第一候选，必须同时提供类名/属性/结构回退（`getCompose()` 有 6+ 候选）。
- 判断「是否处于媒体预览」等状态时不依赖对方标记，用几何判定（`isMediaPreviewOpen()`）。
- 消息方向用 `isOutgoing()` / `isIncoming()` 明确标记判断；自动翻译要求**明确的来消息标记**，证据不足时不动手（`!isOutgoing()` 曾把刚发出的消息误判为来消息）。
- 号码只在运行时从 DOM 解析（`contact-phone.ts` / `getHeaderPhone()`），配合 `libphonenumber-js` 显示归属地（`lib/phone-insights.ts`），不落盘。

### 快捷键（`src/content/shortcuts.ts`）

全部使用 `Alt+Shift+<字母>` 组合（`Ctrl+Shift+R/I/T` 被浏览器占用，页面脚本拦不到）：`R` 快捷回复、`I` 客户档案、`T` 智能译出、`H` 隐藏译文、`Alt+Shift+Enter` 就地译出。按键匹配用与布局无关的 `event.code`（macOS 下 `Alt+R` 的 `event.key` 是 `®`）。组件通过 `registerShortcut()` 注册、卸载时 `unregisterShortcut()`。

### 快速开聊（`src/lib/phone.ts`）

只接受以 `+` 或 `00` 开头、自带国家码的号码，`normalizePhone()` 输出不含 `+` 的纯数字，拼成官方 `https://web.whatsapp.com/send?phone=` 链接。**不做默认区号补全**——设置里的 `defaultCountryCode` 现在只用于输入框示例。popup（`entrypoints/popup/App.tsx`）与页内面板（`content/OpenChatPanel.tsx`）共用 `buildOpenChatRequest()` / `phoneFormatHint()`，改文案改这一处。

## AI 提供商（`src/lib/providers.ts`）

`PROVIDERS` 预设决定 UI 与请求方式：`chatProtocol` 为 `openai-chat` 或 `anthropic-messages`，转写为 `openai-transcriptions` 或 `xai-stt`；`preferredAuthMode: 'projectKey'` 用于 Sub2API 这类自建网关（自定义 header/scheme）。当前预设：OpenAI、Claude、DeepSeek（默认）、Gemini、Grok、Dots AI、Sub2API、自定义 OpenAI 兼容接口。

添加新提供商：在 `PROVIDERS` 增加预设 → 支持语音则 `supportsTranscribe: true` 并填 `transcribePath/transcribeProtocol` → 旧 id/模型名的兼容映射放 `normalizeProviderId()` / `legacyModelMap` → 实际请求在 `src/lib/ai.ts` 里按协议分支，通常不需要改。

## TypeScript / WXT 注意事项

- `browser`、`defineContentScript`、`createShadowRootUi`、`defineBackground` 等是 WXT **自动导入**的全局，不要手写 import；`Browser.storage.StorageChange` 这类类型也来自自动导入。
- 路径别名 `~/` 与 `@/` 均指向 `src/`。
- tsconfig 继承 `.wxt/tsconfig.json`：`strict` + `noUncheckedIndexedAccess`（`match[1]`、`arr[i]` 都是 `T | undefined`）+ `verbatimModuleSyntax`（仅类型必须 `import type`）。
- 仓库 `core.autocrlf=true`，工作区文件为 CRLF；用 shell 工具改文件后 `git diff` 若整文件变红，先检查换行符。

## 重要约束

1. **不保存号码**：仅从 DOM 实时解析用于显示归属地/生成会话键
2. **纯本地**：备注、标签、模板、翻译缓存都在 `chrome.storage.local`，无云端同步/导出
3. **不群发**：设计上无批量发送、自动回复、定时发送；「译出」只替换输入框文本，绝不代替用户发送
4. **密钥隔离**：API Key 仅 background 可读，content script 只能拿 `PublicState`

## 调试

- Content script 日志：在 WhatsApp Web 页面打开 DevTools
- Background 日志：`chrome://extensions` → WAMofa 详情 → **Service Worker**
- Storage 内容：DevTools → Application → Local Storage → `chrome-extension://...`，主键 `wamofa`，翻译缓存 `wamofa_tx`
- 脱离扩展环境预览 popup：给页面注入 `globalThis.chrome = { runtime: { sendMessage: async () => ({ ok: true, state: {...} }) }, tabs: {...} }` 的 mock 后用静态服务器打开 `.output/chrome-mv3/popup.html`
