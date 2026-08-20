import { sendExtension } from '~/lib/messaging';
import type { PublicState } from '~/lib/types';
import {
  findMessageBubbles,
  getMessageId,
  getMessagePane,
  getMessageText,
  isOutgoing,
  isVoiceMessage,
} from '~/wa/dom';
import { captureVoiceAudio } from '~/content/voice';

const translationCache = new Map<string, string>();
const transcribeCache = new Map<string, string>();
const inflight = new Set<string>();

export function shouldTranslate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  try {
    if (/^[\d\s\p{P}\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u.test(trimmed) && trimmed.length < 8) {
      return false;
    }
  } catch {
    if (trimmed.length < 2) return false;
  }
  return true;
}

export function enhanceMessages(state: PublicState): void {
  const pane = getMessagePane();
  if (!pane) return;
  for (const bubble of findMessageBubbles(pane)) {
    enhanceBubble(bubble, state);
  }
}

function enhanceBubble(bubble: HTMLElement, state: PublicState): void {
  if (!bubble.isConnected) return;
  const id = getMessageId(bubble);
  if (!bubble.querySelector(':scope > .wamofa-toolbar, .wamofa-toolbar')) {
    const outgoing = isOutgoing(bubble);
    const toolbar = document.createElement('div');
    toolbar.className = `wamofa-toolbar${outgoing ? ' is-out' : ''}`;

    const translateBtn = document.createElement('button');
    translateBtn.className = 'wamofa-chip';
    translateBtn.type = 'button';
    translateBtn.textContent = '翻译';
    translateBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void runTranslate(bubble, state, true);
    });
    toolbar.append(translateBtn);

    if (isVoiceMessage(bubble)) {
      const voiceBtn = document.createElement('button');
      voiceBtn.className = 'wamofa-chip ghost';
      voiceBtn.type = 'button';
      voiceBtn.textContent = '转写';
      voiceBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void runTranscribe(bubble, state);
      });
      toolbar.append(voiceBtn);
    }

    const anchor =
      bubble.querySelector('.copyable-text') ??
      bubble.querySelector('[data-testid="msg-container"]') ??
      bubble;
    anchor.append(toolbar);
  }

  const cached = translationCache.get(id);
  if (cached) renderResult(bubble, cached, false);

  const auto =
    state.chats[window.__WAMOFA_CHAT_ID__ ?? '']?.autoTranslate ??
    state.settings.autoTranslateIncoming;
  if (auto && !isOutgoing(bubble) && !cached) {
    void runTranslate(bubble, state, false);
  }
}

async function runTranslate(
  bubble: HTMLElement,
  state: PublicState,
  force: boolean,
): Promise<void> {
  const id = getMessageId(bubble);
  if (!force && (translationCache.has(id) || inflight.has(id))) return;
  const text = getMessageText(bubble);
  if (!shouldTranslate(text)) return;
  if (!state.settings.hasKey) {
    renderResult(bubble, '请先在 WAMofa 选项里填写 API Key', true);
    return;
  }
  inflight.add(id);
  setBusy(bubble, '翻译', true);
  try {
    const res = await sendExtension({
      type: 'WAMOFA_TRANSLATE',
      text,
      targetLang: state.settings.incomingLang,
    });
    if (!res.ok || !('text' in res)) {
      renderResult(bubble, res.ok ? '翻译失败' : res.error, true);
      return;
    }
    translationCache.set(id, res.text);
    renderResult(bubble, res.text, false);
  } finally {
    inflight.delete(id);
    setBusy(bubble, '翻译', false);
  }
}

async function runTranscribe(bubble: HTMLElement, state: PublicState): Promise<void> {
  const id = getMessageId(bubble);
  const cached = transcribeCache.get(id);
  if (cached) {
    renderResult(bubble, cached, false);
    return;
  }
  if (!state.settings.hasKey) {
    renderResult(bubble, '请先在 WAMofa 选项里填写 API Key', true);
    return;
  }
  setBusy(bubble, '转写', true);
  try {
    const audio = await captureVoiceAudio(bubble);
    if (!audio) {
      renderResult(bubble, '找不到语音文件。请先点播放，再点转写。', true);
      return;
    }
    const transcribe = await sendExtension({
      type: 'WAMOFA_TRANSCRIBE',
      mime: audio.mime,
      dataBase64: audio.dataBase64,
    });
    if (!transcribe.ok || !('text' in transcribe)) {
      renderResult(bubble, transcribe.ok ? '转写失败' : transcribe.error, true);
      return;
    }
    let output = transcribe.text;
    const translated = await sendExtension({
      type: 'WAMOFA_TRANSLATE',
      text: output,
      targetLang: state.settings.incomingLang,
    });
    if (translated.ok && 'text' in translated && translated.text !== output) {
      output = `${transcribe.text}\n${translated.text}`;
    }
    transcribeCache.set(id, output);
    translationCache.set(id, output);
    renderResult(bubble, output, false);
  } catch (error) {
    renderResult(
      bubble,
      error instanceof Error ? error.message : String(error),
      true,
    );
  } finally {
    setBusy(bubble, '转写', false);
  }
}

function setBusy(bubble: HTMLElement, label: string, busy: boolean): void {
  const btn = [...bubble.querySelectorAll('button.wamofa-chip')].find(
    (el) => el.textContent === label || el.textContent === '...',
  ) as HTMLButtonElement | undefined;
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? '...' : label;
}

function renderResult(bubble: HTMLElement, text: string, isError: boolean): void {
  let box = bubble.querySelector<HTMLElement>('.wamofa-result');
  if (!box) {
    box = document.createElement('div');
    const outgoing = isOutgoing(bubble);
    box.className = `wamofa-result${outgoing ? ' is-out' : ''}`;
    const toolbar = bubble.querySelector('.wamofa-toolbar');
    if (toolbar) toolbar.after(box);
    else bubble.append(box);
  }
  box.classList.toggle('is-error', isError);
  box.textContent = text;
}

declare global {
  interface Window {
    __WAMOFA_CHAT_ID__?: string;
  }
}
