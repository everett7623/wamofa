# WAMofa

个人用的 WhatsApp Web 安全辅助扩展：AI 翻译、快捷回复、本地备注/标签、语音转写。纯本地、开源、不群发。

官网：[wamofa.com](https://wamofa.com) · 源码：[github.com/everett7623/wamofa](https://github.com/everett7623/wamofa)

WAMofa 是独立项目，与 WhatsApp 官方无关联。

---

## ✨ 核心功能

### 🌍 AI 翻译
- **来消息翻译**: 气泡下显示译文，可按会话开关自动翻译
- **输入翻译**: 预览后替换，不自动发送，避免误操作
- **翻译历史**: 刷新页面后翻译结果仍保留（7 天缓存）

### ⚡ 快捷回复
- 管理常用话术模板，一键插入 WhatsApp 输入框
- 支持搜索过滤
- **快捷键**: `Ctrl+Shift+R` 快速打开

### 📞 联系人增强
- **号码归属地**: 自动识别国家/地区、时区、当地时间
- **工作时间提示**: 显示对方是否在工作时间（09:00-18:00）
- **手动输入号码**: 自动识别失败时可手动修正
- **本地备注**: 记录客户需求、跟进事项（仅本机存储）
- **标签系统**: 自定义颜色标签分类客户

### 🎙️ 语音转写
- 点击语音消息自动转写（支持 OpenAI Whisper）
- 转写后可再次翻译

### ⌨️ 全局快捷键
- `Ctrl+Shift+R` - 快捷回复面板
- `Ctrl+Shift+I` - 客户档案
- `Ctrl+Shift+T` - 翻译面板
- `Esc` - 关闭面板

### 💾 数据管理
- **导出备份**: 一键导出客户资料、快捷回复、标签到 JSON
- **导入恢复**: 从 JSON 导入并智能去重合并
- **跨设备同步**: 手动迁移数据到其他电脑

---

## 🚫 不做什么

为了安全和合规，WAMofa **不提供**以下功能：

- ❌ 群发、定时发送、自动回复
- ❌ 查号、导出群成员
- ❌ 云同步、对话历史上传
- ❌ 修改 WhatsApp 发送逻辑

---

## 📦 安装

### 前置要求
- Node.js 20+
- Chrome 或 Firefox 浏览器

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/everett7623/wamofa.git
cd wamofa

# 安装依赖
npm install

# 构建生产版本
npm run build
```

### 加载到浏览器

**Chrome**:
1. 打开 `chrome://extensions`
2. 打开"开发者模式"
3. 点击"加载已解压的扩展程序"
4. **必须选择** `.output/chrome-mv3`（不是项目根目录）
5. 确认版本显示为 `0.1.12` 或更高

**Firefox**:
```bash
npm run dev:firefox
```
在 `about:debugging#/runtime/this-firefox` 加载 `.output/firefox-mv2`

### 开发调试

```bash
npm run dev              # Chrome 开发模式
npm run dev:firefox      # Firefox 开发模式
```

修改代码后：
1. 运行 `npm run build`
2. 在 `chrome://extensions` 点击扩展的**重新加载**按钮
3. **刷新 WhatsApp Web 标签页**

---

## 🔧 配置

### 1. 打开选项页
安装后点击扩展图标 → "选项" 或右键扩展图标 → "选项"

### 2. 配置 AI 接口

WAMofa 支持多种 AI 服务商：

#### 官方服务商

| 服务商 | 文本翻译 | 语音转写 | 默认模型 |
|--------|----------|----------|----------|
| **OpenAI** | ✅ | ✅ Whisper | gpt-4o |
| **Claude** | ✅ | ❌ | claude-3-5-sonnet-20241022 |
| **DeepSeek** | ✅ | ❌ | deepseek-chat |
| **Gemini** | ✅ | ❌ | gemini-2.0-flash-exp |
| **Grok** | ✅ | ❌ | grok-beta |

#### 自定义接口

选择 **"自定义"**，填写任意 OpenAI 兼容的 API：
- Base URL
- 模型名称
- API Key 或 Project Key

WAMofa 支持多种 AI 服务商：

填写配置后点击 **"测试连接"** 验证配置是否正确。

---

## 💡 使用技巧

### 翻译来消息
1. 打开任意 WhatsApp 会话
2. 点击右侧 WAMofa 面板中的"客户档案"
3. 开启"自动翻译来消息"（仅对当前客户生效）
4. 或点击消息气泡下方的翻译按钮手动翻译

### 智能译出
1. 在 WhatsApp 输入框输入中文
2. 点击右侧面板"智能译出"
3. 预览译文，确认无误后点击"替换 WhatsApp 输入框"
4. 手动点击发送

### 快捷回复
1. 在选项页预设常用话术
2. 按 `Ctrl+Shift+R` 或点击右侧面板"快捷回复"
3. 点击模板自动插入输入框

### 客户档案
1. 点击右侧面板"客户档案"
2. 查看号码归属地、时区、当地时间
3. 如果号码识别错误，点击号码区域手动输入
4. 添加备注和标签

### 语音转写
1. 点击语音消息的**播放按钮**（确保音频已加载）
2. 点击转写按钮（麦克风图标）
3. 等待转写完成（支持中英文等多语言）

---

## 🔒 隐私与安全

### 数据存储
- ✅ **本地存储**: 所有数据存储在 `chrome.storage.local`，不上传服务器
- ✅ **API Key 隔离**: 密钥仅在 Background Script 可读，Content Script 无权访问
- ✅ **导出安全**: 导出的 JSON 文件不包含 API Key

### API 调用
- ✅ 扩展后台直连你填写的 AI 服务商（OpenAI、DeepSeek 等）
- ✅ WAMofa 不提供中转服务，不记录你的请求内容
- ✅ 翻译历史仅存本地，7 天后自动清理

### 合规性
- ✅ 不违反 WhatsApp 使用条款
- ✅ 不群发、不自动回复、不爬取数据
- ✅ 使用 WhatsApp 原生输入框，不修改发送逻辑

---

## 🛠️ 开发

### 项目结构
```
src/
├── entrypoints/         # 扩展入口
│   ├── background.ts    # Service Worker，处理 AI 请求
│   ├── content/         # 注入 WhatsApp Web 的脚本
│   ├── options/         # 选项页
│   └── popup/           # 工具栏弹出页
├── content/             # Content Script 组件
│   ├── OverlayApp.tsx   # 主 UI 容器
│   ├── HeaderBar.tsx    # 客户档案面板
│   ├── ComposeBar.tsx   # 智能译出面板
│   ├── QuickReplyPanel.tsx  # 快捷回复面板
│   ├── messages.ts      # 消息翻译逻辑
│   ├── voice.ts         # 语音转写
│   └── shortcuts.ts     # 快捷键管理
├── lib/                 # 核心库
│   ├── storage.ts       # 数据存储
│   ├── ai.ts            # AI API 调用
│   ├── providers.ts     # AI 服务商配置
│   ├── phone-insights.ts  # 号码归属地识别
│   └── import-export.ts # 数据导入导出
└── wa/                  # WhatsApp DOM 操作
    ├── dom.ts           # 选择器和元素查找
    └── compose.ts       # 输入框文本插入
```

### 技术栈
- **框架**: WXT (Web Extension Tools)
- **UI**: React 19 + TypeScript
- **样式**: Tailwind CSS 4
- **构建**: Vite
- **号码识别**: libphonenumber-js

### 命令
```bash
npm run dev              # 开发模式（Chrome）
npm run dev:firefox      # 开发模式（Firefox）
npm run build            # 生产构建
npm run zip              # 打包为 .zip
npm run compile          # TypeScript 类型检查
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发规范
1. 代码注释使用简体中文
2. Commit message 使用简体中文
3. 技术术语保持英文原文
4. 遵循 `CLAUDE.md` 中的架构约定

---

## 📄 许可

MIT License

---

## 🙏 鸣谢

- [WXT](https://wxt.dev/) - 现代化的浏览器扩展框架
- [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) - 电话号码解析
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

---

## 📞 联系

- 官网: [wamofa.com](https://wamofa.com)
- GitHub: [github.com/everett7623/wamofa](https://github.com/everett7623/wamofa)
- Issues: [github.com/everett7623/wamofa/issues](https://github.com/everett7623/wamofa/issues)

