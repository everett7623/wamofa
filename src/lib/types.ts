export interface AiSettings {
  providerId: string;
  authMode: 'apiKey' | 'projectKey';
  apiKey: string;
  projectKey: string;
  projectKeyHeader: string;
  projectKeyScheme: 'bearer' | 'raw';
  baseUrl: string;
  model: string;
  transcribeModel: string;
  incomingLang: string;
  outgoingLang: string;
  autoTranslateIncoming: boolean;
  defaultCountryCode: string;
}

/**
 * 单个服务商记住的凭据与接口配置。切换服务商时整组存取，
 * 这样每家各记各的 Key / Base URL / 模型，换来换去不用重填。
 * 全局偏好（语言、自动翻译、默认区号）不在这里，始终跟随 settings。
 */
export interface ProviderProfile {
  authMode: 'apiKey' | 'projectKey';
  apiKey: string;
  projectKey: string;
  projectKeyHeader: string;
  projectKeyScheme: 'bearer' | 'raw';
  baseUrl: string;
  model: string;
  transcribeModel: string;
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
}

export interface TagDef {
  id: string;
  name: string;
  color: string;
}

export interface ChatMeta {
  note: string;
  tagIds: string[];
  outgoingLang?: string;
  autoTranslate?: boolean;
  manualPhone?: string;
}

export interface AppState {
  settings: AiSettings;
  /** 各服务商各自记住的凭据/接口配置，键为 providerId。只在 background 可读，不进 PublicState。 */
  providerProfiles: Record<string, ProviderProfile>;
  templates: QuickReply[];
  tagPalette: TagDef[];
  chats: Record<string, ChatMeta>;
}

export interface PublicState {
  settings: Omit<AiSettings, 'apiKey' | 'projectKey'> & { hasKey: boolean };
  templates: QuickReply[];
  tagPalette: TagDef[];
  chats: Record<string, ChatMeta>;
}

export const DEFAULT_SETTINGS: AiSettings = {
  providerId: 'deepseek',
  authMode: 'apiKey',
  apiKey: '',
  projectKey: '',
  projectKeyHeader: 'Authorization',
  projectKeyScheme: 'bearer',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  transcribeModel: '',
  incomingLang: 'zh',
  outgoingLang: 'en',
  autoTranslateIncoming: false,
  defaultCountryCode: '86',
};

export const DEFAULT_TAGS: TagDef[] = [
  { id: 'important', name: '重要', color: '#b42318' },
  { id: 'todo', name: '待办', color: '#b54708' },
  { id: 'friend', name: '朋友', color: '#1b9e77' },
];

export const DEFAULT_TEMPLATES: QuickReply[] = [
  { id: 'wait', title: 'One moment', body: 'One moment, let me check.' },
  { id: 'thanks', title: 'Got it', body: 'Got it, thank you.' },
  { id: 'hello', title: 'Hello', body: 'Hello! How can I help you today?' },
];

/** Legacy Chinese defaults — migrate once to English. */
export const LEGACY_ZH_TEMPLATES: QuickReply[] = [
  { id: 'wait', title: '稍等', body: '稍等，我看一下。' },
  { id: 'thanks', title: '收到', body: '收到，谢谢。' },
];

export const DEFAULT_STATE: AppState = {
  settings: DEFAULT_SETTINGS,
  providerProfiles: {},
  templates: DEFAULT_TEMPLATES,
  tagPalette: DEFAULT_TAGS,
  chats: {},
};

export function emptyChatMeta(): ChatMeta {
  return { note: '', tagIds: [] };
}

/** 从当前激活的 settings 抽出该服务商要记住的那部分配置。 */
export function profileFromSettings(settings: AiSettings): ProviderProfile {
  return {
    authMode: settings.authMode,
    apiKey: settings.apiKey,
    projectKey: settings.projectKey,
    projectKeyHeader: settings.projectKeyHeader,
    projectKeyScheme: settings.projectKeyScheme,
    baseUrl: settings.baseUrl,
    model: settings.model,
    transcribeModel: settings.transcribeModel,
  };
}
