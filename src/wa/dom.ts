export const NS = 'wamofa';

function first(selectors: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(selectors);
}

function all(selectors: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selectors)];
}

export function getMain(): HTMLElement | null {
  return first('#main');
}

export function getHeader(): HTMLElement | null {
  return first('#main header');
}

export function getFooter(): HTMLElement | null {
  return first('#main footer');
}

export function getCompose(): HTMLElement | null {
  return (
    first('#main footer [contenteditable="true"][data-tab]') ??
    first('#main footer [contenteditable="true"][role="textbox"]') ??
    first('#main footer [contenteditable="true"]')
  );
}

export function getHeaderTitle(): string {
  const header = getHeader();
  if (!header) return '';
  const titled =
    header.querySelector<HTMLElement>('[data-testid="conversation-info-header-chat-title"]') ??
    header.querySelector<HTMLElement>('span[dir="auto"][title]') ??
    header.querySelector<HTMLElement>('span[title]');
  const title = titled?.getAttribute('title') || titled?.textContent || '';
  return title.trim();
}

export function getActiveChatId(): string | null {
  try {
    const phone = new URL(location.href).searchParams.get('phone');
    if (phone) return `phone:${phone.replace(/\D/g, '')}`;
  } catch {
    // ignore invalid URL
  }
  const title = getHeaderTitle();
  if (title) return `title:${title}`;
  return null;
}

export function getMessagePane(): HTMLElement | null {
  return (
    first('#main [data-testid="conversation-panel-messages"]') ??
    first('#main div[role="application"]') ??
    first('#main .copyable-area') ??
    getMain()
  );
}

export function findMessageBubbles(root: ParentNode = document): HTMLElement[] {
  const classic = all('.message-in, .message-out', root);
  if (classic.length) return classic;

  const testid = all('[data-testid="msg-container"]', root);
  if (testid.length) return testid;

  return all('[data-id]', root).filter((el) => {
    const id = el.getAttribute('data-id') || '';
    return /^(true|false)_/.test(id) || Boolean(el.querySelector('span.selectable-text'));
  });
}

export function isOutgoing(el: HTMLElement): boolean {
  if (el.classList.contains('message-out') || el.closest('.message-out')) return true;
  if (el.classList.contains('message-in') || el.closest('.message-in')) return false;
  const id = el.getAttribute('data-id') || '';
  return id.startsWith('true_');
}

export function getMessageId(el: HTMLElement): string {
  return (
    el.getAttribute('data-id') ||
    el.getAttribute('data-testid') ||
    `node-${el.textContent?.slice(0, 24) ?? 'unknown'}`
  );
}

export function getMessageText(el: HTMLElement): string {
  const nodes = el.querySelectorAll(
    'span.selectable-text.copyable-text, span.selectable-text, .copyable-text span',
  );
  const parts = [...nodes]
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean);
  if (parts.length) {
    return [...new Set(parts)].join('\n').trim();
  }
  return '';
}

export function isVoiceMessage(el: HTMLElement): boolean {
  if (el.querySelector('audio')) return true;
  if (el.querySelector('[data-testid="audio-play"]')) return true;
  const label = el.querySelector('button[aria-label]')?.getAttribute('aria-label') ?? '';
  if (/voice|audio|语音|音频|ptt/i.test(label)) return true;
  return Boolean(el.querySelector('canvas') && el.querySelector('button'));
}

export function getChatListItems(): HTMLElement[] {
  const pane = first('#pane-side');
  if (!pane) return [];
  const items = all('[role="listitem"], [role="row"]', pane);
  if (items.length) return items;
  return all('[data-testid="cell-frame-container"]', pane);
}

export function getChatListItemTitle(item: HTMLElement): string {
  const titled =
    item.querySelector<HTMLElement>('span[dir="auto"][title]') ??
    item.querySelector<HTMLElement>('[title]');
  return (titled?.getAttribute('title') || titled?.textContent || '').trim();
}

export function isDarkTheme(): boolean {
  const sample = getMain() ?? document.body;
  const color = getComputedStyle(sample).backgroundColor;
  const match = color.match(/\d+/g);
  if (!match || match.length < 3) return false;
  const [r, g, b] = match.map(Number);
  if (r == null || g == null || b == null) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
}

export async function waitForApp(isAborted?: () => boolean): Promise<void> {
  if (first('#app')) return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setInterval(() => {
      if (isAborted?.()) {
        window.clearInterval(timer);
        reject(new Error('aborted'));
        return;
      }
      if (first('#app')) {
        window.clearInterval(timer);
        resolve();
      }
    }, 300);
  });
}
