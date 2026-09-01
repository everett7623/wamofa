import { getCompose } from '~/wa/dom';

export function getComposeText(): string {
  const el = getCompose();
  if (!el) return '';
  return normalizeComposeText(el.innerText || el.textContent || '');
}

function selectAll(el: HTMLElement): void {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export type InsertResult = 'ok' | 'clipboard' | 'fail';

export async function setComposeText(text: string): Promise<InsertResult> {
  const el = getCompose();
  if (!el) return 'fail';
  const target = normalizeComposeText(text);

  el.focus();
  selectAll(el);

  tryInsertText(target);
  // Some WhatsApp builds handle the editor's input event and report false
  // even though the model update is applied asynchronously.
  await sleep(80);
  if (composeMatches(target)) return 'ok';

  try {
    selectAll(el);
    const data = new DataTransfer();
    data.setData('text/plain', target);
    el.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    await sleep(80);
    if (composeMatches(target)) return 'ok';
  } catch {
    // WhatsApp may ignore synthetic paste
  }

  try {
    await navigator.clipboard.writeText(target);
    return 'clipboard';
  } catch {
    return 'fail';
  }
}

function tryInsertText(text: string): boolean {
  try {
    // execCommand performs the DOM edit and emits the editor input events.
    // Dispatching beforeinput ourselves makes WhatsApp apply the same text twice.
    return document.execCommand('insertText', false, text);
  } catch {
    return false;
  }
}

export async function insertComposeText(text: string): Promise<InsertResult> {
  const current = getComposeText();
  const next = current ? `${current}\n${text}` : text;
  return setComposeText(next);
}

function composeMatches(text: string): boolean {
  return getComposeText() === normalizeComposeText(text);
}

function normalizeComposeText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
