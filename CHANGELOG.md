# 更新日志

## [0.2.5] - 2026-08-21

### 🐛 Bug 修复
- **翻译按钮位置**：修复 PDF/图片等文档消息的翻译按钮位置不一致问题
- **消息类型判断**：改进 `isOutgoing` 判断逻辑，添加 flex 布局检查
- **工具栏挂载点**：统一文本和文档消息的工具栏挂载容器

### 🎨 UI 优化
- 调整翻译按钮位置（right: -70px），避免被消息气泡遮挡

---

## [0.2.4] - 2026-08-21

### ✨ 新增功能
- **Claude 支持**：添加 Claude API 鉴权（x-api-key header）
- **Provider 迁移**：自动迁移已删除的 providers（Sub2API/NewAPI）

### 🐛 Bug 修复
- 移除 UI 中的 Sub2API/NewAPI 引用
- 修复 `normalizeProviderId` 函数（grop → grok）
- 改进错误提示，说明转写服务需求

### 🎨 样式优化
- 使用 CSS 变量统一侧边栏宽度（--wamofa-sidebar-width: 68px）
- 改进右侧边栏响应式布局

### 📝 文档
- 创建 CLAUDE.md 项目文档
- 优化 README.md 项目描述

---

## [0.2.3] - 之前版本

### 初始功能
- WhatsApp Web 消息翻译
- 语音消息转写
- 多 AI 提供商支持（OpenAI、DeepSeek、Gemini、Grok）
- 号码归属地和时区显示
- 快捷回复面板
