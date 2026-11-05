import {
  mergeChatMeta,
  migrateTitleToPhone,
  parsePhoneFromChatId,
  parseTitleFromChatId,
  phoneChatKey,
  titleChatKey,
} from '~/lib/chat-keys';
import {
  DEFAULT_STATE,
  DEFAULT_TEMPLATES,
  emptyChatMeta,
  LEGACY_ZH_TEMPLATES,
  profileFromSettings,
  type AiSettings,
  type AppState,
  type ChatMeta,
  type ProviderProfile,
  type PublicState,
  type QuickReply,
} from '~/lib/types';
import {
  getProvider,
  getProviderSeedSettings,
  normalizeProviderId,
  normalizeProviderModel,
} from '~/lib/providers';

const KEY = 'wamofa';
const TEMPLATES_MIGRATED_FLAG = 'wamofa_templates_migrated_v2';

/**
 * 翻译缓存独立成键，不与主配置同居一个 storage key。
 * content script 高频写入译文；若写在 KEY 上，每次写入都会触发
 * storage.onChanged -> 全量刷新 + 重新扫描 DOM，并与 background 的
 * 读-改-写互相覆盖，导致备注/标签丢失。
 */
const TX_KEY = 'wamofa_tx';
const TX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TX_MAX_ENTRIES = 500;

let writeChain: Promise<unknown> = Promise.resolve();
let txChain: Promise<unknown> = Promise.resolve();
let templateMigrationDone = false;

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

async function readStoredState(): Promise<AppState> {
  const result = await browser.storage.local.get(KEY);
  return mergeState(result[KEY]);
}

/**
 * 旧版中文默认话术只迁一次。必须走 writeChain：此前这次写入
 * 不排队，会和正在保存的备注用两份快照互相覆盖。
 */
async function migrateLegacyTemplates(): Promise<void> {
  if (templateMigrationDone) return;
  try {
    const flag = await browser.storage.local.get(TEMPLATES_MIGRATED_FLAG);
    if (flag[TEMPLATES_MIGRATED_FLAG]) {
      templateMigrationDone = true;
      return;
    }
    const result = await browser.storage.local.get(KEY);
    const raw = result[KEY] as Partial<AppState> | undefined;
    if (!raw?.templates || !isLegacyZhTemplates(raw.templates)) {
      await browser.storage.local.set({ [TEMPLATES_MIGRATED_FLAG]: true });
      templateMigrationDone = true;
      return;
    }
    const current = mergeState(raw);
    await browser.storage.local.set({
      [KEY]: { ...current, templates: DEFAULT_TEMPLATES },
      [TEMPLATES_MIGRATED_FLAG]: true,
    });
    templateMigrationDone = true;
  } catch {
    // 忽略一次性迁移失败，下次再试
  }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

let migrationQueue: Promise<void> | null = null;

function ensureMigration(): Promise<void> {
  if (templateMigrationDone) return Promise.resolve();
  if (!migrationQueue) {
    migrationQueue = enqueue(() => migrateLegacyTemplates()).finally(() => {
      migrationQueue = null;
    });
  }
  return migrationQueue;
}

/**
 * 把一条已保存的服务商档案补齐、归一：旧厂商 id、旧模型名都在这里映射，
 * 缺失字段用该厂商的种子默认值补上，Key 去空白。非激活厂商的档案也走这里，
 * 这样切过去时模型名已经是当前一代，不会拿着停用模型直接报错。
 */
function sanitizeProfile(id: string, value: Partial<ProviderProfile>): ProviderProfile {
  const seed = getProviderSeedSettings(id);
  return {
    authMode: value.authMode === 'projectKey' ? 'projectKey' : 'apiKey',
    apiKey: value.apiKey?.trim() ?? '',
    projectKey: value.projectKey?.trim() ?? '',
    projectKeyHeader: value.projectKeyHeader?.trim() || seed.projectKeyHeader,
    projectKeyScheme: value.projectKeyScheme === 'raw' ? 'raw' : 'bearer',
    baseUrl: value.baseUrl ?? seed.baseUrl,
    model: normalizeProviderModel(id, value.model?.trim() || seed.model),
    transcribeModel: normalizeProviderModel(id, value.transcribeModel ?? seed.transcribeModel),
  };
}

/** 读取时归一所有已存档案；旧 id 合并到新 id 时，保留带凭据的那一份。 */
function buildProviderProfiles(raw: unknown): Record<string, ProviderProfile> {
  const parsed = (raw ?? {}) as Record<string, Partial<ProviderProfile>>;
  const out: Record<string, ProviderProfile> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!value || typeof value !== 'object') continue;
    const id = normalizeProviderId(key);
    const candidate = sanitizeProfile(id, value);
    const existing = out[id];
    if (!existing || (!existing.apiKey && !existing.projectKey)) {
      out[id] = candidate;
    }
  }
  return out;
}

function mergeSettings(parsed: Partial<AppState>): AiSettings {
  const parsedSettings = (parsed.settings ?? {}) as Partial<AppState['settings']>;
  const normalizedProviderId = normalizeProviderId(
    parsedSettings.providerId ?? DEFAULT_STATE.settings.providerId,
  );
  const providerWasMigrated = Boolean(
    parsedSettings.providerId && parsedSettings.providerId !== normalizedProviderId,
  );
  const defaults = getProviderSeedSettings(normalizedProviderId);
  const provider = getProvider(normalizedProviderId);
  const configuredModel = parsedSettings.model?.trim() || defaults.model;
  const normalizedModel = normalizeProviderModel(normalizedProviderId, configuredModel);
  const parsedApiKey = parsedSettings.apiKey?.trim() ?? '';
  const parsedProjectKey = parsedSettings.projectKey?.trim() ?? '';
  const fixedCredential = parsedSettings.authMode === 'projectKey'
    ? parsedProjectKey || parsedApiKey
    : parsedApiKey || parsedProjectKey;
  return {
    ...DEFAULT_STATE.settings,
    ...parsedSettings,
    apiKey: !provider.configurableAuth && defaults.authMode === 'apiKey'
      ? fixedCredential
      : parsedSettings.apiKey ?? DEFAULT_STATE.settings.apiKey,
    projectKey: !provider.configurableAuth && defaults.authMode === 'projectKey'
      ? fixedCredential
      : parsedSettings.projectKey ?? DEFAULT_STATE.settings.projectKey,
    providerId: defaults.providerId,
    authMode: provider.configurableAuth && !providerWasMigrated
      ? parsedSettings.authMode ?? defaults.authMode
      : defaults.authMode,
    projectKeyHeader: provider.configurableAuth && !providerWasMigrated
      ? parsedSettings.projectKeyHeader ?? defaults.projectKeyHeader
      : defaults.projectKeyHeader,
    projectKeyScheme: provider.configurableAuth && !providerWasMigrated
      ? parsedSettings.projectKeyScheme ?? defaults.projectKeyScheme
      : defaults.projectKeyScheme,
    baseUrl: provider.configurableBaseUrl && !providerWasMigrated
      ? parsedSettings.baseUrl ?? defaults.baseUrl
      : defaults.baseUrl,
    model: providerWasMigrated ? defaults.model : normalizedModel,
    // 转写模型同样走 legacyModelMap：官方停用旧转写模型后，已保存的配置会直接报错
    transcribeModel: providerWasMigrated
      ? defaults.transcribeModel
      : normalizeProviderModel(
          normalizedProviderId,
          parsedSettings.transcribeModel ?? defaults.transcribeModel,
        ),
  };
}

function mergeState(raw: unknown): AppState {
  const parsed = (raw ?? {}) as Partial<AppState>;
  const settings = mergeSettings(parsed);
  // 激活厂商的档案始终以归一后的 settings 为准，覆盖存档里可能过时的那份。
  const providerProfiles = buildProviderProfiles(parsed.providerProfiles);
  providerProfiles[settings.providerId] = profileFromSettings(settings);
  return {
    settings,
    providerProfiles,
    templates: resolveTemplates(parsed),
    tagPalette: Array.isArray(parsed.tagPalette)
      ? parsed.tagPalette
      : DEFAULT_STATE.tagPalette,
    chats: parsed.chats ?? {},
  };
}

export async function getState(): Promise<AppState> {
  await ensureMigration();
  return readStoredState();
}

export async function setState(next: AppState): Promise<AppState> {
  // 落盘前把当前激活厂商的凭据/配置同步进档案表，任何写入路径都保持该厂商档案最新。
  const synced: AppState = {
    ...next,
    providerProfiles: {
      ...next.providerProfiles,
      [next.settings.providerId]: profileFromSettings(next.settings),
    },
  };
  await browser.storage.local.set({ [KEY]: synced });
  return synced;
}

/** Serialize all read-modify-write storage updates to avoid lost races. */
export function patchState(
  patcher: (current: AppState) => AppState,
): Promise<AppState> {
  return enqueue(async () => {
    await migrateLegacyTemplates();
    const current = await readStoredState();
    return setState(patcher(current));
  });
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
  };
}

export async function upsertChat(
  chatId: string,
  patch: Partial<ChatMeta>,
  options?: { aliasTitle?: string | null },
): Promise<AppState> {
  return patchState((current) => {
    let chats = { ...current.chats };
    const phone = parsePhoneFromChatId(chatId);
    const titleHint = options?.aliasTitle?.trim() || parseTitleFromChatId(chatId);

    // When writing under phone:, fold any leftover title: meta into it first.
    if (phone && titleHint) {
      chats = migrateTitleToPhone(chats, titleHint, phone);
    } else if (phone) {
      // Also fold any title keys that already stored this manual/phone overlap.
      for (const [key, meta] of Object.entries(chats)) {
        if (!key.startsWith('title:')) continue;
        if (meta.manualPhone?.replace(/\D/g, '') === phone) {
          chats = migrateTitleToPhone(chats, key.slice(6), phone);
        }
      }
    }

    const targetKey = phone ? phoneChatKey(phone) : chatId;
    const prev = chats[targetKey] ?? emptyChatMeta();
    chats[targetKey] = { ...prev, ...patch };

    // 折叠残留的 title 别名到 phone 键，再删除别名（本次写入的值优先）。
    if (phone && titleHint) {
      const titleKey = titleChatKey(titleHint);
      if (titleKey !== targetKey && chats[titleKey]) {
        chats[targetKey] = mergeChatMeta(chats[titleKey], chats[targetKey]);
        delete chats[titleKey];
      }
    }

    return { ...current, chats };
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

interface TranslationRecord {
  text: string;
  timestamp: number;
}

type TranslationCache = Record<string, TranslationRecord>;

async function readTranslationCache(): Promise<TranslationCache> {
  const result = await browser.storage.local.get(TX_KEY);
  const raw = result[TX_KEY];
  return raw && typeof raw === 'object' ? (raw as TranslationCache) : {};
}

/** 丢弃过期记录，并在超出条数上限时保留最近的 TX_MAX_ENTRIES 条。 */
function pruneTranslations(cache: TranslationCache): TranslationCache {
  const cutoff = Date.now() - TX_TTL_MS;
  const fresh = Object.entries(cache).filter(
    ([, value]) =>
      typeof value?.text === 'string' &&
      typeof value.timestamp === 'number' &&
      value.timestamp >= cutoff,
  );
  if (fresh.length > TX_MAX_ENTRIES) {
    fresh.sort((a, b) => b[1].timestamp - a[1].timestamp);
    fresh.length = TX_MAX_ENTRIES;
  }
  return Object.fromEntries(fresh);
}

/** 译文缓存写入自成一条串行链，不触碰主配置键。 */
export async function saveTranslation(msgId: string, text: string): Promise<void> {
  const run = txChain.then(async () => {
    const cache = await readTranslationCache();
    cache[msgId] = { text, timestamp: Date.now() };
    await browser.storage.local.set({ [TX_KEY]: pruneTranslations(cache) });
  });
  txChain = run.then(
    () => undefined,
    () => undefined,
  );
  await run;
}

export async function getTranslation(msgId: string): Promise<string | null> {
  const record = (await readTranslationCache())[msgId];
  if (!record) return null;
  if (record.timestamp < Date.now() - TX_TTL_MS) return null;
  return record.text;
}
