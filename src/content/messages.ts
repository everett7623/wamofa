import { captureVoiceAudio } from '~/content/voice';
import { getRuntimeChatId, getRuntimeState } from '~/content/runtime';
import { sendExtension } from '~/lib/messaging';
import type { PublicState } from '~/lib/types';
import {
  ENHANCED,
  findMessageBubbles,
  getMessageId,
  getMessagePane,
  getMessageText,
  isOutgoing,
  isVoiceMessage,
} from '~/wa/dom';

const translationCache = new Map<string, string>();
const transcribeCache = new Map<string, string>();
const inflight = new Set<string>();
const autoAttempted = new Set<string>();
const renderedResultKey = new Map<HTMLElement, string>();

const TRANSLATE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04ZM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12Zm-2.62 7l1.62-4.33L19.12 17h-3.24Z"/></svg>';
const VOICE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>';

export function shouldTranslate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  try {
    if (
      /^[\d\s\p{P}\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u.test(trimmed) &&
      trimmed.length < 8
    ) {
      return false;
    }
  } catch {
    if (trimmed.length < 2) return false;
  }
  return true;
}

export function clearMessageCaches(): void {
  translationCache.clear();
  transcribeCache.clear();
  inflight.clear();
  autoAttempted.clear();
  renderedResultKey.clear();
}

function cacheKey(msgId: string): string {
  const chatId = getRuntimeChatId() ?? 'unknown';
  const settings = getRuntimeState()?.settings;
  const context = settings
    ? [
        settings.providerId,
        settings.baseUrl,
        settings.model,
        settings.transcribeModel,
        settings.incomingLang,
      ].join('|')
    : 'unknown';
  return `${chatId}::${context}::${msgId}`;
}

function normalizeToolbarHost(bubble: HTMLElement): HTMLElement {
  const text = bubble.querySelector<HTMLElement>(
    'span.selectable-text.copyable-text, span.selectable-text, .copyable-text',
  );
  return (
    text?.closest<HTMLElement>('[data-pre-plain-text]') ??
    text?.parentElement ??
    bubble
  );
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
  const key = cacheKey(id);
  const previousKey = renderedResultKey.get(bubble);
  if (previousKey && previousKey !== key) {
    bubble.querySelectorAll('.wamofa-result').forEach((node) => node.remove());
    renderedResultKey.delete(bubble);
  }

  const host = normalizeToolbarHost(bubble);
  let toolbar = bubble.querySelector<HTMLElement>('.wamofa-toolbar');
  if (!toolbar) {
    bubble.setAttribute(ENHANCED, '1');
    toolbar = document.createElement('div');
    const translateBtn = document.createElement('button');
    translateBtn.className = 'wamofa-icon-btn';
    translateBtn.type = 'button';
    translateBtn.innerHTML = TRANSLATE_ICON;
    translateBtn.title = '翻译此条';
    translateBtn.setAttribute('aria-label', '翻译此条');
    translateBtn.dataset.kind = 'translate';
    translateBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void runTranslate(bubble, true);
    });
    toolbar.append(translateBtn);

    host.append(toolbar);
  }
  if (toolbar.parentElement !== host) host.append(toolbar);
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  toolbar.className = `wamofa-toolbar${isOutgoing(bubble) ? ' is-out' : ''}`;

  const existingVoice = toolbar.querySelector<HTMLButtonElement>('[data-kind="voice"]');
  if (isVoiceMessage(bubble) && !existingVoice) {
    const voiceBtn = document.createElement('button');
    voiceBtn.className = 'wamofa-icon-btn ghost';
    voiceBtn.type = 'button';
    voiceBtn.innerHTML = VOICE_ICON;
    voiceBtn.title = '转写此条';
    voiceBtn.setAttribute('aria-label', '转写此条');
    voiceBtn.dataset.kind = 'voice';
    voiceBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void runTranscribe(bubble);
    });
    toolbar.append(voiceBtn);
  } else if (!isVoiceMessage(bubble) && existingVoice) {
    existingVoice.remove();
  }

  const cached = translationCache.get(key);
  if (cached) renderResult(bubble, cached, false, key);

  const chatId = getRuntimeChatId() ?? '';
  const auto =
    state.chats[chatId]?.autoTranslate ?? state.settings.autoTranslateIncoming;
  if (auto && !isOutgoing(bubble) && !cached && !autoAttempted.has(key)) {
    void runTranslate(bubble, false);
  }
}

async function runTranslate(bubble: HTMLElement, force: boolean): Promise<void> {
  const state = getRuntimeState();
  if (!state) return;

  const id = getMessageId(bubble);
  const key = cacheKey(id);

  // 先尝试从持久化存储读取
  if (!force && !translationCache.has(key)) {
    try {
      const { getTranslation } = await import('~/lib/storage');
      const cached = await getTranslation(key);
      if (cached) {
        translationCache.set(key, cached);
        renderResult(bubble, cached, false, key);
        return;
      }
    } catch {
      // 继续正常翻译流程
    }
  }

  if (
    !force &&
    (translationCache.has(key) || inflight.has(key) || autoAttempted.has(key))
  ) {
    return;
  }

  const text = getMessageText(bubble);
  if (!shouldTranslate(text)) return;
  if (!state.settings.hasKey) {
    const credential =
      state.settings.authMode === 'projectKey' ? 'Project Key' : 'API Key';
    renderResult(bubble, `请先在 WAMofa 选项里填写 ${credential}`, true, key);
    return;
  }

  if (!force) autoAttempted.add(key);
  inflight.add(key);
  setBusy(bubble, '翻译', true);
  try {
    const res = await sendExtension({
      type: 'WAMOFA_TRANSLATE',
      text,
      targetLang: state.settings.incomingLang,
    });
    if (!res.ok || !('text' in res)) {
      renderResult(bubble, res.ok ? '翻译失败' : res.error, true, key);
      return;
    }
    translationCache.set(key, res.text);
    renderResult(bubble, res.text, false, key);

    // 保存到持久化存储
    try {
      const { saveTranslation } = await import('~/lib/storage');
      await saveTranslation(key, res.text);
    } catch {
      // 保存失败不影响显示
    }
  } catch (error) {
    renderResult(
      bubble,
      error instanceof Error ? error.message : String(error),
      true,
      key,
    );
  } finally {
    inflight.delete(key);
    if (isCurrentBubble(bubble, key)) setBusy(bubble, '翻译', false);
  }
}

async function runTranscribe(bubble: HTMLElement): Promise<void> {
  const state = getRuntimeState();
  if (!state) return;

  const id = getMessageId(bubble);
  const key = cacheKey(id);
  const cached = transcribeCache.get(key);
  if (cached) {
    renderResult(bubble, cached, false, key);
    return;
  }
  if (!state.settings.hasKey) {
    const credential =
      state.settings.authMode === 'projectKey' ? 'Project Key' : 'API Key';
    renderResult(bubble, `请先在 WAMofa 选项里填写 ${credential}`, true, key);
    return;
  }

  const requestKey = `voice::${key}`;
  if (inflight.has(requestKey)) return;
  inflight.add(requestKey);
  setBusy(bubble, '转写', true);
  try {
    const audio = await captureVoiceAudio(bubble);
    if (!audio) {
      renderResult(bubble, '找不到语音文件。请先点播放，再点转写。', true, key);
      return;
    }
    const transcribe = await sendExtension({
      type: 'WAMOFA_TRANSCRIBE',
      mime: audio.mime,
      dataBase64: audio.dataBase64,
    });
    if (!transcribe.ok || !('text' in transcribe)) {
      renderResult(
        bubble,
        transcribe.ok ? '转写失败' : transcribe.error,
        true,
        key,
      );
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
    transcribeCache.set(key, output);
    translationCache.set(key, output);
    renderResult(bubble, output, false, key);
  } catch (error) {
    renderResult(
      bubble,
      error instanceof Error ? error.message : String(error),
      true,
      key,
    );
  } finally {
    inflight.delete(requestKey);
    if (isCurrentBubble(bubble, key)) setBusy(bubble, '转写', false);
  }
}

function isCurrentBubble(bubble: HTMLElement, expectedKey: string): boolean {
  return bubble.isConnected && cacheKey(getMessageId(bubble)) === expectedKey;
}

function setBusy(bubble: HTMLElement, label: string, busy: boolean): void {
  const btn = [...bubble.querySelectorAll<HTMLButtonElement>('button.wamofa-icon-btn')].find(
    (el) =>
      (label === '翻译' ? el.dataset.kind === 'translate' : el.dataset.kind === 'voice') ||
      el.title === (label === '翻译' ? '翻译此条' : '转写此条'),
  );
  if (!btn) return;
  btn.disabled = busy;
  if (busy) {
    btn.dataset.old = btn.innerHTML;
    btn.textContent = '…';
  } else {
    btn.innerHTML =
      btn.dataset.old || (label === '翻译' ? TRANSLATE_ICON : VOICE_ICON);
  }
}

function renderResult(
  bubble: HTMLElement,
  text: string,
  isError: boolean,
  expectedKey: string,
): void {
  if (!isCurrentBubble(bubble, expectedKey)) return;
  const msgId = getMessageId(bubble);
  const key = cacheKey(msgId);
  const lastKey = renderedResultKey.get(bubble);
  let box = bubble.querySelector<HTMLElement>('.wamofa-result');

  // Prevent duplicate inserts when the same message bubble is re-processed.
  if (box && lastKey === key && box.textContent === text) {
    box.classList.toggle('is-error', isError);
    return;
  }

  const duplicates = bubble.querySelectorAll<HTMLElement>('.wamofa-result');
  if (duplicates.length > 1) {
    duplicates.forEach((item, index) => {
      if (index > 0) item.remove();
    });
    box = bubble.querySelector<HTMLElement>('.wamofa-result');
  }

  if (!box) {
    box = document.createElement('div');
    const outgoing = isOutgoing(bubble);
    box.className = `wamofa-result${outgoing ? ' is-out' : ''}`;
    bubble.append(box);
  }
  renderedResultKey.set(bubble, key);
  box.classList.toggle('is-error', isError);
  box.setAttribute('role', isError ? 'alert' : 'note');
  box.setAttribute('aria-label', isError ? 'WAMofa 错误' : 'WAMofa 处理结果');
  box.textContent = text;
}
