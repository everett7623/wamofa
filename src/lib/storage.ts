import {
  DEFAULT_STATE,
  DEFAULT_TEMPLATES,
  emptyChatMeta,
  LEGACY_ZH_TEMPLATES,
  type AppState,
  type ChatMeta,
  type PublicState,
  type QuickReply,
} from '~/lib/types';
import { getProviderSeedSettings, normalizeProviderId } from '~/lib/providers';

const KEY = 'wamofa';

function isLegacyZhTemplates(templates: QuickReply[]): boolean {
  if (templates.length !== LEGACY_ZH_TEMPLATES.length) return false;
  return LEGACY_ZH_TEMPLATES.every((legacy, i) => {
    const item = templates[i];
    return item?.id === legacy.id && item.title === legacy.title && item.body === legacy.body;
  });
}

function resolveTemplates(parsed: Partial<AppState>): QuickReply[] {
  if (!Array.isArray(parsed.templates)) return DEFAULT_TEMPLATES;
  if (isLegacyZhTemplates(parsed.templates)) return DEFAULT_TEMPLATES;
  return parsed.templates;
}

function mergeState(raw: unknown): AppState {
  const parsed = (raw ?? {}) as Partial<AppState>;
  const parsedSettings = (parsed.settings ?? {}) as Partial<AppState['settings']>;
  const normalizedProviderId = normalizeProviderId(
    parsedSettings.providerId ?? DEFAULT_STATE.settings.providerId,
  );
  const providerWasMigrated = Boolean(
    parsedSettings.providerId && parsedSettings.providerId !== normalizedProviderId,
  );
  const defaults = getProviderSeedSettings(normalizedProviderId);
  const modelWasMigrated =
    providerWasMigrated ||
    (normalizedProviderId === 'grok' && parsedSettings.model === 'grok-4-latest');
  return {
    settings: {
      ...DEFAULT_STATE.settings,
      ...parsedSettings,
      providerId: defaults.providerId,
      baseUrl: providerWasMigrated
        ? defaults.baseUrl
        : parsedSettings.baseUrl ?? defaults.baseUrl,
      model: modelWasMigrated
        ? defaults.model
        : parsedSettings.model ?? defaults.model,
      transcribeModel: providerWasMigrated
        ? defaults.transcribeModel
        : parsedSettings.transcribeModel ?? defaults.transcribeModel,
    },
    templates: resolveTemplates(parsed),
    tagPalette: Array.isArray(parsed.tagPalette)
      ? parsed.tagPalette
      : DEFAULT_STATE.tagPalette,
    chats: parsed.chats ?? {},
    translationHistory: parsed.translationHistory ?? {},
  };
}

export async function getState(): Promise<AppState> {
  const result = await browser.storage.local.get(KEY);
  return mergeState(result[KEY]);
}

export async function setState(next: AppState): Promise<AppState> {
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export async function patchState(
  patcher: (current: AppState) => AppState,
): Promise<AppState> {
  const current = await getState();
  const next = patcher(current);
  return setState(next);
}

export function toPublicState(state: AppState): PublicState {
  const { apiKey, projectKey, ...rest } = state.settings;
  const hasCredential =
    state.settings.authMode === 'projectKey'
      ? Boolean(projectKey.trim())
      : Boolean(apiKey.trim());
  return {
    settings: {
      ...rest,
      hasKey: hasCredential,
    },
    templates: state.templates,
    tagPalette: state.tagPalette,
    chats: state.chats,
    translationHistory: state.translationHistory || {},
  };
}

export async function upsertChat(
  chatId: string,
  patch: Partial<ChatMeta>,
): Promise<AppState> {
  return patchState((current) => {
    const prev = current.chats[chatId] ?? emptyChatMeta();
    return {
      ...current,
      chats: {
        ...current.chats,
        [chatId]: { ...prev, ...patch },
      },
    };
  });
}

export async function saveTemplates(templates: QuickReply[]): Promise<AppState> {
  return patchState((current) => ({
    ...current,
    templates: templates
      .map((item) => ({
        id: item.id.trim() || crypto.randomUUID(),
        title: item.title.trim(),
        body: item.body.trim(),
      }))
      .filter((item) => item.title && item.body),
  }));
}

export async function saveTranslation(
  msgId: string,
  text: string,
): Promise<void> {
  await patchState((current) => {
    const history = { ...current.translationHistory };
    history[msgId] = { text, timestamp: Date.now() };

    // 清理 7 天前的翻译记录
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [key, value] of Object.entries(history)) {
      if (value.timestamp < sevenDaysAgo) {
        delete history[key];
      }
    }

    return { ...current, translationHistory: history };
  });
}

export async function getTranslation(msgId: string): Promise<string | null> {
  const state = await getState();
  const record = state.translationHistory?.[msgId];
  if (!record) return null;

  // 检查是否过期（7 天）
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (record.timestamp < sevenDaysAgo) return null;

  return record.text;
}
