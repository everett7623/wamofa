import { getCompose } from '~/wa/dom';

export function getComposeText(): string {
  const el = getCompose();
  if (!el) return '';
  return (el.innerText || el.textContent || '').replace(/\u00a0/g, ' ').replace(/\n+$/, '');
}

function selectAll(el: HTMLElement): void {
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

  const inserted = document.execCommand('insertText', false, text);
  if (inserted && composeLooksLike(text)) return 'ok';

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
    await sleep(40);
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

export async function insertComposeText(text: string): Promise<InsertResult> {
  const current = getComposeText().trim();
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
