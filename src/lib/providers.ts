export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  transcribeModel: string;
  supportsTranscribe: boolean;
  hint: string;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    transcribeModel: 'whisper-1',
    supportsTranscribe: true,
    hint: '官方 OpenAI，支持文本翻译与 Whisper 转写。',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: '性价比高，仅文本翻译，不支持语音转写。',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    transcribeModel: '',
    supportsTranscribe: false,
    hint: 'Google OpenAI 兼容接口。仅文本翻译。',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    transcribeModel: 'whisper-large-v3',
    supportsTranscribe: true,
    hint: '速度快，支持文本与 Whisper 转写。',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    transcribeModel: 'FunAudioLLM/SenseVoiceSmall',
    supportsTranscribe: true,
    hint: '国内可用。文本翻译 + SenseVoice 转写。',
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

export function getProvider(id: string): ProviderPreset {
  const found = PROVIDERS.find((item) => item.id === id);
  if (found) return found;
  const fallback = PROVIDERS[0];
  if (!fallback) {
    throw new Error('缺少服务商预设');
  }
  return fallback;
}
