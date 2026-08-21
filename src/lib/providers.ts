export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  transcribeModel: string;
  supportsTranscribe: boolean;
  hint: string;
}

export interface ProviderSeedSettings {
  providerId: string;
  baseUrl: string;
  model: string;
  transcribeModel: string;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    transcribeModel: 'whisper-1',
    supportsTranscribe: true,
    hint: '官方 OpenAI，支持文本翻译与 Whisper 转写。',
  },
  {
    id: 'claude',
    name: 'Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'Anthropic Claude，强大的文本翻译能力，不支持语音转写。',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: '高性价比，仅文本翻译，不支持语音转写。',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash-exp',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'Google OpenAI 兼容接口。仅文本翻译。',
  },
  {
    id: 'grok',
    name: 'Grok',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-beta',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'xAI 官方接口，使用最新 Grok 模型进行文本翻译。',
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    model: '',
    transcribeModel: '',
    supportsTranscribe: true,
    hint: '任意 OpenAI 兼容接口，自填 Base URL 与模型名。',
  },
];

export function normalizeProviderId(id: string): string {
  return id === 'groq' || id === 'grop' ? 'grok' : id;
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

export function getProviderSeedSettings(id: string): ProviderSeedSettings {
  const preset = getProvider(id);
  return {
    providerId: preset.id,
    baseUrl: preset.baseUrl,
    model: preset.model,
    transcribeModel: preset.supportsTranscribe ? preset.transcribeModel : '',
  };
}
