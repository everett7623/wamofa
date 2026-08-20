import {
  DEFAULT_STATE,
  emptyChatMeta,
  type AppState,
  type ChatMeta,
  type PublicState,
} from '~/lib/types';

const KEY = 'wamofa';

function mergeState(raw: unknown): AppState {
  const parsed = (raw ?? {}) as Partial<AppState>;
  return {
    settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
    templates: parsed.templates?.length ? parsed.templates : DEFAULT_STATE.templates,
    tagPalette: parsed.tagPalette?.length ? parsed.tagPalette : DEFAULT_STATE.tagPalette,
    chats: parsed.chats ?? {},
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
  const { apiKey, ...rest } = state.settings;
  return {
    settings: {
      ...rest,
      hasKey: Boolean(apiKey.trim()),
    },
    templates: state.templates,
    tagPalette: state.tagPalette,
    chats: state.chats,
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
