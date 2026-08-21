import { getCompose } from '~/wa/dom';

export function getComposeText(): string {
  const el = getCompose();
  if (!el) return '';
  return (el.innerText || el.textContent || '').replace(/\u00a0/g, ' ').replace(/\n+$/, '').trim();
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

  el.focus();
  selectAll(el);

  if (tryInsertText(el, text) && composeLooksLike(text)) return 'ok';

  try {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    el.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    await sleep(60);
    if (composeLooksLike(text)) return 'ok';
  } catch {
    // WhatsApp may ignore synthetic paste
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'clipboard';
  } catch {
    return 'fail';
  }
}

function tryInsertText(el: HTMLElement, text: string): boolean {
  try {
    el.dispatchEvent(
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      }),
    );
  } catch {
    // older browsers
  }

  const inserted = document.execCommand('insertText', false, text);
  if (inserted) return true;

  try {
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertText',
        data: text,
      }),
    );
  } catch {
    // ignore
  }

  return composeLooksLike(text);
}

export async function insertComposeText(text: string): Promise<InsertResult> {
  const current = getComposeText();
  const next = current ? `${current}\n${text}` : text;
  return setComposeText(next);
}

function composeLooksLike(text: string): boolean {
  const actual = getComposeText();
  const probe = text.slice(0, Math.min(12, text.length));
  return probe.length === 0 || actual.includes(probe);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
