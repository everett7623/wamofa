# WAMofa

个人用的 WhatsApp Web 安全辅助扩展：AI 翻译、快捷回复、本地备注/标签、语音转写。纯本地、开源、不群发。

官网：[wamofa.com](https://wamofa.com) · 源码：[github.com/everett7623/wamofa](https://github.com/everett7623/wamofa)

WAMofa 是独立项目，与 WhatsApp、Meta、WhatFa 均无关联。

## 做什么

- 来消息翻译（气泡下显示译文，可按会话开关）
- 输入翻译（预览后替换，不自动发送）
- 快捷回复模板
- 不保存号码，用官方 `web.whatsapp.com/send?phone=` 开聊
- 联系人备注 / 标签（仅本机）
- 语音消息点击转写，并可再翻译

## 不做什么

群发、定时发送、自动回复、查号、导出群成员、云同步、对话历史上传。

## 安装

需要 Node.js 20+。

```bash
npm install
npm run build
```

1. Chrome 打开 `chrome://extensions`
2. 打开开发者模式
3. 加载已解压的扩展程序，选 `.output/chrome-mv3`
4. 打开扩展选项，填入 OpenAI 兼容的 API Key
5. 打开 [WhatsApp Web](https://web.whatsapp.com/)

开发调试：

```bash
npm run dev
```

## AI 接口

扩展后台直连你填写的服务商，Key 存在 `chrome.storage.local`。

预设：OpenAI、DeepSeek、Gemini、Groq、硅基流动，也可自填 Base URL 和模型。

语音转写走 `/v1/audio/transcriptions`。DeepSeek / Gemini 仅文本；OpenAI、Groq、硅基流动可转写。

## 许可

MIT
