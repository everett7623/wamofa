import type { AppState, ChatMeta, PublicState, QuickReply } from '~/lib/types';

export type ExtensionRequest =
  | { type: 'WAMOFA_GET_STATE' }
  | { type: 'WAMOFA_GET_PRIVATE' }
  | { type: 'WAMOFA_SAVE_PRIVATE'; state: AppState }
  | { type: 'WAMOFA_UPSERT_CHAT'; chatId: string; patch: Partial<ChatMeta> }
  | { type: 'WAMOFA_SAVE_TEMPLATES'; templates: QuickReply[] }
  | { type: 'WAMOFA_OPEN_OPTIONS' }
  | { type: 'WAMOFA_TRANSLATE'; text: string; targetLang: string }
  | { type: 'WAMOFA_TRANSCRIBE'; mime: string; dataBase64: string; fileName?: string }
  | { type: 'WAMOFA_TEST' };

export type OkText = { ok: true; text: string };
export type OkPublic = { ok: true; state: PublicState };
export type OkPrivate = { ok: true; privateState: AppState };
export type Fail = { ok: false; error: string };

export type ExtensionResponse = OkText | OkPublic | OkPrivate | Fail;

export function sendExtension<T extends ExtensionResponse>(
  message: ExtensionRequest,
): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}
