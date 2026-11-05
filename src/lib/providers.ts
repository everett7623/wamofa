export type ChatProtocol = 'openai-chat' | 'anthropic-messages';
export type TranscribeProtocol = 'openai-transcriptions' | 'xai-stt';

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  chatProtocol: ChatProtocol;
  chatPath: string;
  modelsPath?: string;
  transcribeModel: string;
  transcribePath?: string;
  transcribeProtocol?: TranscribeProtocol;
  transcribeModelRequired?: boolean;
  supportsTranscribe: boolean;
  hint: string;
  preferredAuthMode?: 'apiKey' | 'projectKey';
  configurableAuth?: boolean;
  configurableBaseUrl?: boolean;
  apiKeyHeader?: string;
  apiKeyScheme?: 'bearer' | 'raw';
  projectKeyHeader?: string;
  projectKeyScheme?: 'bearer' | 'raw';
  modelOptions?: string[];
  transcribeModelOptions?: string[];
  legacyModelMap?: Record<string, string>;
}

export interface ProviderSeedSettings {
  providerId: string;
  authMode: 'apiKey' | 'projectKey';
  projectKeyHeader: string;
  projectKeyScheme: 'bearer' | 'raw';
  baseUrl: string;
  model: string;
  transcribeModel: string;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-6-luna',
    chatProtocol: 'openai-chat',
    chatPath: 'v1/chat/completions',
    modelsPath: 'v1/models',
    transcribeModel: 'gpt-transcribe',
    transcribePath: 'v1/audio/transcriptions',
    transcribeProtocol: 'openai-transcriptions',
    transcribeModelRequired: true,
    supportsTranscribe: true,
    hint: 'OpenAI 官方接口；文本走 Chat Completions，语音走 Transcriptions。高频翻译建议 GPT-6 Luna（最低成本档）。',
    preferredAuthMode: 'apiKey',
    modelOptions: ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra'],
    transcribeModelOptions: ['gpt-transcribe'],
    // 转写模型与文本模型共用这张表（名字不冲突）；GPT-4o / 4.1 与旧转写模型官方已排期关停。
    legacyModelMap: {
      'gpt-5.6-luna': 'gpt-6-luna',
      'gpt-5.6-terra': 'gpt-6.1-terra',
      'gpt-5.6-sol': 'gpt-6.1-sol',
      'gpt-4.1': 'gpt-6-luna',
      'gpt-4.1-mini': 'gpt-6-luna',
      'gpt-4o': 'gpt-6-luna',
      'gpt-4o-mini': 'gpt-6-luna',
      'gpt-4o-mini-transcribe': 'gpt-transcribe',
      'gpt-4o-transcribe': 'gpt-transcribe',
      'whisper-1': 'gpt-transcribe',
    },
  },
  {
    id: 'claude',
    name: 'Claude',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-5-5',
    chatProtocol: 'anthropic-messages',
    chatPath: 'v1/messages',
    modelsPath: 'v1/models',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'Anthropic 官方 Messages API；使用 x-api-key 和 anthropic-version 请求头。高频翻译可选 Haiku 5.5，更快更省。',
    preferredAuthMode: 'apiKey',
    apiKeyHeader: 'x-api-key',
    apiKeyScheme: 'raw',
    modelOptions: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-5-5'],
    legacyModelMap: {
      'claude-3-5-sonnet-20241022': 'claude-sonnet-5-5',
      'claude-3-7-sonnet-latest': 'claude-sonnet-5-5',
      'claude-sonnet-5': 'claude-sonnet-5-5',
      'claude-opus-5': 'claude-opus-5-5',
      'claude-fable-5': 'claude-fable-5-1',
      'claude-haiku-4-5': 'claude-haiku-5-5',
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    chatProtocol: 'openai-chat',
    chatPath: 'chat/completions',
    modelsPath: 'models',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'DeepSeek OpenAI 兼容接口；Flash（V4.1）适合高频翻译，V4 Pro 适合更复杂文本。翻译请求会关闭思考模式。',
    preferredAuthMode: 'apiKey',
    modelOptions: ['deepseek-flash', 'deepseek-v4-pro'],
    legacyModelMap: {
      'deepseek-chat': 'deepseek-flash',
      'deepseek-reasoner': 'deepseek-flash',
      'deepseek-v4-flash': 'deepseek-flash',
    },
  },
  {
    id: 'zhipu',
    name: '智谱 GLM（Z.AI）',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'glm-4.7-flash',
    chatProtocol: 'openai-chat',
    chatPath: 'chat/completions',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: '智谱官方 OpenAI 兼容接口。默认国际站 api.z.ai；国内开放平台或 Coding Plan 可改 Base URL。高频翻译建议 GLM-4.7-Flash（免费，翻译时关闭思考）；GLM-5.3 / 5.3-Flash 强制思考，更强但更慢。',
    preferredAuthMode: 'apiKey',
    configurableBaseUrl: true,
    modelOptions: [
      'glm-4.7-flash',
      'glm-5.3-flash',
      'glm-5.3',
      'glm-5.2',
      'glm-5-turbo',
      'glm-4.7',
      'glm-4.5-flash',
      'glm-4.5-air',
    ],
    legacyModelMap: {
      'glm-4-flash': 'glm-4.5-flash',
      'glm-4-air': 'glm-4.5-air',
      'glm-4-plus': 'glm-5.3',
      glm4: 'glm-4.7-flash',
    },
  },
  {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-flash',
    chatProtocol: 'openai-chat',
    chatPath: 'chat/completions',
    modelsPath: 'models',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: '阿里云 DashScope 的 OpenAI 兼容接口。默认国内北京节点；国际站把 Base URL 改成 dashscope-intl.aliyuncs.com/compatible-mode/v1。高频翻译建议 Flash，翻译请求会关闭思考模式。',
    preferredAuthMode: 'apiKey',
    configurableBaseUrl: true,
    modelOptions: ['qwen3.8-flash', 'qwen3.7-plus', 'qwen3.8-max'],
    // qwen-flash / plus / max 已归入旧版、不再推荐；qwen-turbo 已下线。
    legacyModelMap: {
      'qwen-flash': 'qwen3.8-flash',
      'qwen-plus': 'qwen3.7-plus',
      'qwen-max': 'qwen3.8-max',
      'qwen-turbo': 'qwen3.8-flash',
    },
  },
  {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.8-flash',
    chatProtocol: 'openai-chat',
    chatPath: 'chat/completions',
    modelsPath: 'models',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'Google Gemini 的 OpenAI 兼容接口；使用 Authorization Bearer 鉴权。',
    preferredAuthMode: 'apiKey',
    modelOptions: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'],
    legacyModelMap: {
      'gemini-2.0-flash-exp': 'gemini-3.8-flash',
      'gemini-2.0-flash': 'gemini-3.8-flash',
      'gemini-2.5-flash': 'gemini-3.8-flash',
      'gemini-3.5-flash': 'gemini-3.8-flash',
      'gemini-3.6-flash': 'gemini-3.8-flash',
      'gemini-3.7-flash': 'gemini-3.8-flash',
    },
  },
  {
    id: 'grok',
    name: 'Grok（xAI）',
    baseUrl: 'https://api.x.ai',
    model: 'grok-4.7',
    chatProtocol: 'openai-chat',
    chatPath: 'v1/chat/completions',
    modelsPath: 'v1/models',
    transcribeModel: '',
    transcribePath: 'v1/stt',
    transcribeProtocol: 'xai-stt',
    transcribeModelRequired: false,
    supportsTranscribe: true,
    hint: 'xAI 官方接口；支持 Grok 文本模型和无需模型名的 /v1/stt 语音转写。',
    preferredAuthMode: 'apiKey',
    modelOptions: ['grok-4.7'],
    legacyModelMap: {
      'grok-beta': 'grok-4.7',
      'grok-2-latest': 'grok-4.7',
      'grok-4-latest': 'grok-4.7',
      'grok-4.3': 'grok-4.7',
      'grok-4.5': 'grok-4.7',
      'grok-4.6': 'grok-4.7',
    },
  },
  {
    id: 'dots',
    name: 'Dots AI',
    baseUrl: 'https://note3-prev-api.askdiandian.com',
    model: 'dots3-note-prev',
    chatProtocol: 'openai-chat',
    chatPath: 'v1/chat/completions',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'Dots OpenAI 兼容接口；请求 /v1/chat/completions，并通过 api-key 请求头认证。',
    preferredAuthMode: 'apiKey',
    apiKeyHeader: 'api-key',
    apiKeyScheme: 'raw',
    modelOptions: ['dots3-note-prev'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.cn/anthropic',
    model: 'MiniMax-M3',
    chatProtocol: 'anthropic-messages',
    chatPath: 'v1/messages',
    modelsPath: 'v1/models',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'MiniMax 官方推荐 Anthropic Messages 兼容接口；鉴权用 Authorization Bearer。默认国内 api.minimax.cn；国际站可改 Base URL 为 https://api.minimax.io/anthropic。高频翻译建议 M3（默认不开 thinking）；M3.1-Flash 会强制 thinking，更慢更耗 token。',
    preferredAuthMode: 'apiKey',
    configurableBaseUrl: true,
    apiKeyHeader: 'Authorization',
    apiKeyScheme: 'bearer',
    modelOptions: ['MiniMax-M3', 'MiniMax-M3.1-Flash'],
  },
  {
    id: 'sub2api',
    name: 'Sub2API（自建网关）',
    baseUrl: '',
    model: '',
    chatProtocol: 'openai-chat',
    chatPath: 'v1/chat/completions',
    modelsPath: 'v1/models',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: '填写你的 Sub2API 根地址或 /v1 地址；网关会按 API Key 分组和模型名自动路由。',
    preferredAuthMode: 'apiKey',
    configurableAuth: true,
    configurableBaseUrl: true,
    apiKeyHeader: 'Authorization',
    apiKeyScheme: 'bearer',
    projectKeyHeader: 'Authorization',
    projectKeyScheme: 'bearer',
    modelOptions: [
      'gpt-6-luna',
      'gpt-6.1-terra',
      'gpt-6.1-sol',
      'claude-sonnet-5-5',
      'gemini-3.8-flash',
      'grok-4.7',
      'deepseek-flash',
      'glm-4.7-flash',
      'glm-5.3',
      'qwen3.8-flash',
      'qwen3.7-plus',
    ],
  },
  {
    id: 'custom',
    name: '其他 OpenAI 兼容接口（高级）',
    baseUrl: '',
    model: '',
    chatProtocol: 'openai-chat',
    chatPath: 'chat/completions',
    modelsPath: 'models',
    transcribeModel: '',
    transcribePath: 'audio/transcriptions',
    transcribeProtocol: 'openai-transcriptions',
    transcribeModelRequired: true,
    supportsTranscribe: true,
    hint: '填写包含版本前缀的 Base URL（通常以 /v1 结尾），也可直接填写完整 chat/completions 地址。',
    preferredAuthMode: 'apiKey',
    configurableAuth: true,
    configurableBaseUrl: true,
    modelOptions: [
      'gpt-6-luna',
      'claude-sonnet-5-5',
      'gemini-3.8-flash',
      'grok-4.7',
      'deepseek-flash',
      'glm-4.7-flash',
      'glm-5.3',
      'qwen3.8-flash',
    ],
    // whisper-1 仍是多数自建/第三方转写服务的通用模型名，保留
    transcribeModelOptions: ['gpt-transcribe', 'whisper-1'],
  },
  {
    id: 'custom-anthropic',
    name: '其他 Anthropic 兼容接口（高级）',
    baseUrl: '',
    model: '',
    chatProtocol: 'anthropic-messages',
    chatPath: 'v1/messages',
    modelsPath: 'v1/models',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: '填写 Anthropic Messages 兼容的 Base URL（如官方 https://api.anthropic.com，或网关的 /anthropic）。也可直接填写完整 /v1/messages 地址。官方 Claude 用 x-api-key；部分网关用 Bearer，可在鉴权方式里切换。',
    preferredAuthMode: 'apiKey',
    configurableAuth: true,
    configurableBaseUrl: true,
    apiKeyHeader: 'x-api-key',
    apiKeyScheme: 'raw',
    projectKeyHeader: 'Authorization',
    projectKeyScheme: 'bearer',
    modelOptions: [
      'claude-sonnet-5-5',
      'claude-opus-5-5',
      'claude-haiku-5-5',
      'MiniMax-M3',
      'MiniMax-M3.1-Flash',
    ],
  },
];

export function normalizeProviderId(id: string): string {
  if (id === 'groq' || id === 'grop') return 'grok';
  if (id === 'zai' || id === 'zhipuai' || id === 'glm' || id === 'bigmodel') return 'zhipu';
  if (id === 'dashscope' || id === 'tongyi') return 'qwen';
  if (id === 'minimaxi' || id === 'minimax-cn') return 'minimax';
  return id;
}

export function getProvider(id: string): ProviderPreset {
  const normalized = normalizeProviderId(id);
  const found = PROVIDERS.find((item) => item.id === normalized);
  if (found) return found;
  const fallback = PROVIDERS[0];
  if (!fallback) {
    throw new Error('缺少服务商预设');
  }
  return fallback;
}

export function normalizeProviderModel(providerId: string, model: string): string {
  const provider = getProvider(providerId);
  return provider.legacyModelMap?.[model] ?? model;
}

/**
 * 翻译是短文本高频请求，新一代模型默认开启思考，会明显拖慢速度、多耗 token。
 * 只对官方支持关闭/压低思考的厂商追加参数；网关与自定义接口原样透传，不猜参数。
 */
export function translationBodyExtras(providerId: string, model: string): Record<string, unknown> {
  const id = model.trim().toLowerCase();
  switch (normalizeProviderId(providerId)) {
    case 'deepseek':
      return { thinking: { type: 'disabled' } };
    case 'qwen':
      return { enable_thinking: false };
    case 'zhipu':
      // GLM-5.3 / 5.3-Flash 是强制思考，关不掉，不发参数
      return id.startsWith('glm-5.3') ? {} : { thinking: { type: 'disabled' } };
    case 'claude':
      // Claude 5 系列的思考无法关闭，只能压低 effort；Haiku 4.5 等旧模型不认 effort，传了会 400
      return /^claude-(opus|sonnet|haiku|fable)-5/.test(id)
        ? { output_config: { effort: 'low' } }
        : {};
    default:
      return {};
  }
}

export function getProviderSeedSettings(id: string): ProviderSeedSettings {
  const preset = getProvider(id);
  return {
    providerId: preset.id,
    authMode: preset.preferredAuthMode ?? 'apiKey',
    projectKeyHeader: preset.projectKeyHeader ?? 'Authorization',
    projectKeyScheme: preset.projectKeyScheme ?? 'bearer',
    baseUrl: preset.baseUrl,
    model: preset.model,
    transcribeModel: preset.supportsTranscribe ? preset.transcribeModel : '',
  };
}
