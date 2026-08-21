# Sub2API/NewAPI 配置故障排查指南

## 问题：返回 HTML 而非 JSON

### 错误信息
```
Unexpected token '<', "<!doctype "... is not valid JSON
```

### 原因分析
API 返回了 HTML 页面而不是 JSON，通常是以下原因：

1. **Base URL 配置错误**
   - ❌ 错误: `https://api.example.com` (缺少 /v1)
   - ✅ 正确: `https://api.example.com/v1`

2. **鉴权失败**
   - API Key 或 Project Key 错误
   - Header 名称不匹配
   - Token 格式不正确

3. **服务商不支持**
   - 部分中转服务不完全兼容 OpenAI API

---

## ✅ 正确配置步骤

### Sub2API 配置示例

```
服务商: Sub2API
鉴权方式: Project Key（Sub2API/NewAPI）
Base URL: https://api.sub2api.com/v1  ← 必须以 /v1 结尾
Project Key: sk-xxxxxxxxxxxxx
Header 名称: Authorization
格式: Bearer <ProjectKey>
文本模型: gpt-4o-mini
```

### NewAPI 配置示例

```
服务商: NewAPI
鉴权方式: Project Key（Sub2API/NewAPI）
Base URL: https://api.newapi.com/v1  ← 必须以 /v1 结尾
Project Key: sk-xxxxxxxxxxxxx
Header 名称: Authorization
格式: Bearer <ProjectKey>
文本模型: gpt-4o-mini
```

---

## 🔍 故障排查清单

### 1. 检查 Base URL
```bash
# 正确格式
https://api.example.com/v1
https://sub2api.example.com/v1
https://newapi.example.com/v1

# 错误格式（会导致 HTML 错误）
https://api.example.com       ← 缺少 /v1
https://api.example.com/      ← 缺少 v1
https://api.example.com/api   ← 错误路径
```

### 2. 检查鉴权配置

**API Key 模式**:
- 鉴权方式: `API Key`
- Header: 自动设置为 `Authorization: Bearer <API_KEY>`

**Project Key 模式**:
- 鉴权方式: `Project Key（Sub2API/NewAPI）`
- Header 名称: `Authorization` (大小写敏感)
- 格式: `Bearer <ProjectKey>` (注意空格)

### 3. 测试端点可用性

在浏览器或命令行测试：
```bash
curl -X POST https://api.example.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}'
```

如果返回 HTML，说明：
- URL 错误
- 鉴权失败
- 服务不可用

---

## 🛠️ v0.2.1 修复内容

### 改进的错误提示

现在返回 HTML 时会显示详细提示：
```
HTTP 401: API 返回 HTML 而非 JSON，请检查：
1. Base URL 是否正确（应以 /v1 结尾）
2. API Key 或 Project Key 是否正确
3. 鉴权方式是否匹配（API Key vs Project Key）
```

### 内容类型检查

在解析 JSON 前检查 `Content-Type`：
```
API 返回非 JSON 格式 (text/html)，请检查：
1. Base URL 是否正确（应以 /v1 结尾，如 https://api.example.com/v1）
2. 鉴权配置是否正确
3. 服务商是否支持 OpenAI 兼容格式
```

### 选项页配置提示

增强了 Project Key 模式的配置说明：
- Base URL 必须以 `/v1` 结尾
- 常见鉴权配置示例
- HTML 错误排查提示

---

## 📝 常见服务商配置

### 官方 OpenAI
```
Base URL: https://api.openai.com/v1
API Key: sk-xxxxx
模型: gpt-4o-mini
```

### DeepSeek
```
Base URL: https://api.deepseek.com/v1
API Key: sk-xxxxx
模型: deepseek-chat
```

### 硅基流动
```
Base URL: https://api.siliconflow.cn/v1
API Key: sk-xxxxx
模型: Qwen/Qwen2.5-7B-Instruct
```

### Sub2API (中转)
```
Base URL: https://your-sub2api-domain.com/v1  ← 你的实际域名
Project Key: 从 Sub2API 获取
Header: Authorization
格式: Bearer <ProjectKey>
模型: gpt-4o-mini (根据 Sub2API 支持的模型)
```

### NewAPI (中转)
```
Base URL: https://your-newapi-domain.com/v1  ← 你的实际域名
API Key 或 Project Key: 从 NewAPI 获取
模型: gpt-4o-mini (根据 NewAPI 支持的模型)
```

---

## 💡 排查建议

1. **先测试官方 OpenAI**
   - 如果官方 API 正常，说明扩展代码没问题
   - 问题出在中转服务配置

2. **检查中转服务文档**
   - 每个中转服务的配置可能略有不同
   - 确认是否支持 OpenAI 兼容格式
   - 确认正确的 Base URL 和鉴权方式

3. **使用浏览器开发者工具**
   - 打开 `chrome://extensions`
   - 点击 WAMofa 的 "Service Worker"
   - 查看网络请求和响应详情

4. **联系服务商支持**
   - 如果配置正确但仍报错
   - 提供错误信息给服务商排查

---

**更新时间**: 2026-08-21  
**版本**: v0.2.1 (修复中)
