import type { PublicState } from '~/lib/types';

let state: PublicState | null = null;
let chatId: string | null = null;

export function setRuntimeState(next: PublicState): void {
  state = next;
}

export function getRuntimeState(): PublicState | null {
  return state;
}

export function setRuntimeChatId(id: string | null): void {
  if (chatId !== id) {
    chatId = id;
  }
  window.__WAMOFA_CHAT_ID__ = id ?? undefined;
}

export function getRuntimeChatId(): string | null {
  return chatId;
}

declare global {
  interface Window {
    __WAMOFA_CHAT_ID__?: string;
  }
}
