# WAMofa

WhatsApp Web 工作台助手：AI 翻译、客户备注标签、快捷回复、语音转写。纯本地存储，开源，不群发。

官网：[wamofa.com](https://wamofa.com) · 隐私政策：[wamofa.com/privacy](https://wamofa.com/privacy) · 源码：[github.com/everett7623/wamofa](https://github.com/everett7623/wamofa)

WAMofa 是独立项目，与 WhatsApp 官方无关联。

---

## ✨ 核心功能

### 🌍 AI 智能翻译
- **来消息翻译**: 消息旁点击翻译，或按联系人开启自动翻译
- **智能译出**: 输入内容翻译后预览，确认再替换到输入框（不自动发送）
- **翻译历史**: 刷新页面后译文保留约 7 天

### ⚡ 快捷回复
- 预设常用话术，一键插入输入框
- 面板内支持搜索过滤
- **快捷键**: `Alt+Shift+R`

### 📇 客户档案
- **号码与时区**: 顶栏/档案显示国家、当地时间、工作时间提示
- **手动修正**: 识别不准时可手动填写号码
- **本地备注与标签**: 仅存在本机浏览器

### 📞 不存号码开聊
- 扩展 popup 或 WhatsApp 页内右侧栏「开聊」
- 使用官方 `web.whatsapp.com/send?phone=` 链接，不写入通讯录

### 🎙️ 语音转写
- 点击语音消息转写（需支持转写的 AI 厂商，如 OpenAI Whisper）
- 转写结果可再次翻译

### ⌨️ 快捷键
- `Alt+Shift+R` — 快捷回复
- `Alt+Shift+I` — 客户档案
- `Alt+Shift+T` — 智能译出
- `Alt+Shift+H` — 隐藏/显示译文（方便截图）
- `Esc` — 关闭面板

---

## 🚫 不做什么

- ❌ 群发、定时发送、自动回复
- ❌ 查号、导出群成员
- ❌ 云同步、数据导出/备份、对话历史上传
- ❌ 修改 WhatsApp 发送逻辑

---

## 📦 安装

### 前置要求
- Node.js 20+
- Chrome 或 Firefox

```bash
git clone https://github.com/everett7623/wamofa.git
cd wamofa
npm install
npm run build
```

**Chrome**: `chrome://extensions` → 开发者模式 → 加载 **`.output/chrome-mv3`**（不是仓库根目录）

修改代码后：重新加载扩展 → 刷新 WhatsApp Web 标签页。

---

## 🔧 配置

点击扩展图标 → 选项，配置 AI 服务商与 API Key。支持 OpenAI、Claude、DeepSeek、智谱 GLM、通义千问、Gemini、Grok、Sub2API 及自定义 OpenAI 兼容接口。

---

## 💡 使用技巧

### 翻译来消息
开启客户档案中的「自动翻译来消息」，或点击消息旁的翻译按钮。

### 智能译出
输入中文 → 右栏「译出」→ 预览 → 替换到输入框 → 手动发送。

### 快捷回复
选项页维护模板；会话中 `Alt+Shift+R` 或右栏「快捷」插入。

### 快速开聊
右栏「开聊」或扩展 popup 输入号码，跳转官方 send 链接。号码需以 `+` 或 `00` 开头并包含国家码（如 `+92 333 8483463`），不会自动补区号。

---

## 🔒 隐私

完整说明见 [wamofa.com/privacy](https://wamofa.com/privacy)。

- 备注、标签、模板、翻译历史均存 `chrome.storage.local`
- API Key 仅在 Background 可读
- 不提供云端备份或导出；换浏览器/换电脑需重新配置（符合「纯本地助手」定位）

---

## 🛠️ 开发

```bash
npm run dev          # Chrome 开发
npm run build        # 生产构建
npm run compile      # 类型检查
```

详见仓库内 `CLAUDE.md`。

---

## 📄 许可

MIT License
