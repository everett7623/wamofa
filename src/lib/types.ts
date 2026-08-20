export interface AiSettings {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  transcribeModel: string;
  incomingLang: string;
  outgoingLang: string;
  autoTranslateIncoming: boolean;
  defaultCountryCode: string;
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
}

export interface AppState {
  settings: AiSettings;
  templates: QuickReply[];
  tagPalette: TagDef[];
  chats: Record<string, ChatMeta>;
}

export interface PublicState {
  settings: Omit<AiSettings, 'apiKey'> & { hasKey: boolean };
  templates: QuickReply[];
  tagPalette: TagDef[];
  chats: Record<string, ChatMeta>;
}

export const DEFAULT_SETTINGS: AiSettings = {
  providerId: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
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
  { id: 'wait', title: '稍等', body: '稍等，我看一下。' },
  { id: 'thanks', title: '收到', body: '收到，谢谢。' },
];

export const DEFAULT_STATE: AppState = {
  settings: DEFAULT_SETTINGS,
  templates: DEFAULT_TEMPLATES,
  tagPalette: DEFAULT_TAGS,
  chats: {},
};

export function emptyChatMeta(): ChatMeta {
  return { note: '', tagIds: [] };
}
