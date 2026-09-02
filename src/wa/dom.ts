import { getSavedContactPhone } from '~/wa/contact-phone';

export const NS = 'wamofa';
export const ENHANCED = 'data-wamofa-enhanced';

function first(selectors: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(selectors);
}

function all(selectors: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selectors)];
}

function queryFirst(root: ParentNode, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const hit = root.querySelector<HTMLElement>(selector);
    if (hit) return hit;
  }
  return null;
}

export function getMain(): HTMLElement | null {
  return first('#main');
}

export function getHeader(): HTMLElement | null {
  return (
    queryFirst(document, [
      '#main header[data-testid="conversation-header"]',
      '#main header',
    ]) ?? null
  );
}

export function getFooter(): HTMLElement | null {
  return first('#main footer');
}

/**
 * WhatsApp renders image/document composition in a transient media editor.
 * Its selectors have changed over time, so keep the check marker-based and
 * require a visible send control before treating a media viewer as active.
 */
export function isMediaPreviewOpen(): boolean {
  const sidebarWidth = 68;
  const sendSelector = [
    '[data-testid="compose-btn-send"]',
    '[data-testid="send"]',
    '[data-icon="send"]',
    '[data-icon="send-light"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="发送"]',
    '[role="button"][aria-label*="Send"]',
    '[role="button"][aria-label*="发送"]',
  ].join(',');

  const mediaMarkerSelector = [
    '[data-testid="media-viewer"]',
    '[data-testid="media-viewer-container"]',
    '[data-testid="media-preview"]',
    '[data-testid="media-editor"]',
    '[data-testid="attachment-preview"]',
    '[data-testid="document-preview"]',
    '[data-testid="upload-preview"]',
    '[data-testid*="media-viewer"]',
    '[data-testid*="attachment-preview"]',
    '[data-testid*="document-preview"]',
  ].join(',');

  const visibleSendControls = [...document.querySelectorAll<HTMLElement>(sendSelector)]
    .filter(isVisible);

  const markers = [...document.querySelectorAll<HTMLElement>(mediaMarkerSelector)]
    .filter(isVisible);

  // 优先相信带发送键的显式媒体标记。
  if (markers.some((marker) => visibleSendControls.some((send) => marker.contains(send)))) {
    return true;
  }

  // #main 已经让出了右侧栏的宽度，聊天界面内的控件不会越过这条边界；
  // 越界的一定是脱离 #main 的全屏浮层（媒体 / 文件编辑器）。
  // 这里不能再要求 markers 非空：新版 WhatsApp 移除了大部分 data-testid，
  // markers 为空时发送键照样被压在右侧栏底下。
  const coveredEdge = window.innerWidth - sidebarWidth;
  if (visibleSendControls.some((send) => send.getBoundingClientRect().right > coveredEdge)) {
    return true;
  }

  return railCoversNativeControl(sidebarWidth);
}

/**
 * 兜底：直接探测右侧栏底部压住了什么。
 * elementsFromPoint 返回该点上的所有层叠元素，跳过扩展自己的 shadow 宿主后，
 * 若仍有原生可点击控件，说明我们正遮住它（发送键就是这种情况）。
 * 不依赖任何 WhatsApp 类名或 data-testid，因此不会随对方改版失效。
 */
function railCoversNativeControl(sidebarWidth: number): boolean {
  if (typeof document.elementsFromPoint !== 'function') return false;
  const x = window.innerWidth - Math.round(sidebarWidth / 2);
  const height = window.innerHeight;
  for (const y of [height - 40, height - 70, height - 100]) {
    if (y < 0) continue;
    for (const element of document.elementsFromPoint(x, y)) {
      // 扩展 UI 挂在 shadow 宿主上，命中的是宿主本身。
      if (element.tagName.startsWith('WAMOFA')) continue;
      if (element.closest('.wm-right-rail, .wm-side-panel')) continue;
      if (element.closest('button, [role="button"]')) return true;
    }
  }
  return false;
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function getCompose(): HTMLElement | null {
  const footer = getFooter();
  const scopes: ParentNode[] = footer ? [footer, document] : [document];
  const selectors = [
    '[data-testid="conversation-compose-box-input"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-tab]',
    '#main footer div[contenteditable="true"]',
    '#main div[contenteditable="true"][spellcheck="true"]',
  ];
  for (const scope of scopes) {
    const hit = queryFirst(scope, selectors);
    if (hit) return hit;
  }
  return null;
}

export function getHeaderTitle(): string {
  const header = getHeader();
  if (!header) return '';
  const titled =
    header.querySelector<HTMLElement>('[data-testid="conversation-info-header-chat-title"]') ??
    header.querySelector<HTMLElement>('span[dir="auto"][title]') ??
    header.querySelector<HTMLElement>('span[title]');
  const fromAttr = titled?.getAttribute('title')?.trim() ?? '';
  const fromText = (titled?.textContent ?? '').trim();
  // WA often renders a saved name and its flag in separate sibling nodes.
  let preferred = preferRicherTitle(fromAttr, fromText);

  if (!preferred || looksLikeIcon(preferred)) {
    const spans = [...header.querySelectorAll<HTMLElement>('span[dir="auto"], span[title]')];
    for (const span of spans) {
      const candidate = preferRicherTitle(
        span.getAttribute('title')?.trim() ?? '',
        (span.textContent ?? '').trim(),
      );
      if (!candidate || looksLikeIcon(candidate)) continue;
      preferred = preferRicherTitle(preferred, candidate);
    }
  }

  if (!preferred || looksLikeIcon(preferred)) return '';
  const metadata = [
    header.textContent ?? '',
    ...[...header.querySelectorAll<HTMLElement>('[title], [aria-label], img[alt]')].map(
      (node) =>
        `${node.getAttribute('title') ?? ''} ${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('alt') ?? ''}`,
    ),
  ].join(' ');
  const flag = extractFirstFlag(metadata);
  return flag && !preferred.includes(flag) ? `${preferred}${flag}` : preferred;
}

function preferRicherTitle(a: string, b: string): string {
  const score = (s: string) =>
    (hasFlagEmoji(s) ? 4 : 0) + (extractPhoneFromText(s) ? 2 : 0) + Math.min(s.length, 40) / 40;
  if (!a) return b;
  if (!b) return a;
  return score(b) > score(a) ? b : a;
}

function hasFlagEmoji(text: string): boolean {
  return /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(text) || /[\u{1F3F4}]/u.test(text);
}

function extractFirstFlag(text: string): string {
  try {
    return text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)?.[0] ?? '';
  } catch {
    return '';
  }
}

/** Best-effort phone from URL / DOM data-id / header / title digits. */
export function getHeaderPhone(): string | null {
  try {
    const fromUrl = new URL(location.href).searchParams.get('phone');
    if (fromUrl) {
      const digits = fromUrl.replace(/\D/g, '');
      if (digits.length >= 8) return digits;
    }
  } catch {
    // ignore
  }

  const title = getHeaderTitle();
  const fromTitle = extractPhoneFromText(title);
  if (fromTitle) return fromTitle;

  const fromDom = extractPhoneFromWaDom();
  if (fromDom) return fromDom;

  // Saved contacts increasingly expose only an @lid privacy id in the DOM.
  // Resolve the real PN from WhatsApp's same-origin, read-only model storage.
  const fromSavedContact = getSavedContactPhone(title);
  if (fromSavedContact) return fromSavedContact;

  const header = getHeader();
  if (!header) return null;

  const candidates = [
    ...header.querySelectorAll<HTMLElement>('[title], span[dir="auto"], a, [data-testid]'),
  ];
  for (const el of candidates) {
    const raw = `${el.getAttribute('title') ?? ''} ${el.textContent ?? ''} ${el.getAttribute('href') ?? ''}`.trim();
    const digits = extractPhoneFromText(raw);
    if (digits) return digits;
  }
  return null;
}

export function getActiveChatId(): string | null {
  try {
    const phone = new URL(location.href).searchParams.get('phone');
    if (phone) return `phone:${phone.replace(/\D/g, '')}`;
  } catch {
    // ignore invalid URL
  }

  const title = getHeaderTitle();

  // Groups must stay on a stable title key — never bind to a participant PN.
  if (isGroupChat()) {
    return title ? `title:${title}` : null;
  }

  const resolved = getHeaderPhone();
  if (resolved) return `phone:${resolved}`;
  if (title) return `title:${title}`;
  return null;
}

/** Best-effort group detection from header / message ids. */
export function isGroupChat(): boolean {
  const header = getHeader();
  if (header) {
    const subtitle =
      header.querySelector<HTMLElement>('[data-testid="chat-subtitle"]')?.textContent ??
      header.querySelector<HTMLElement>('span[title]')?.nextElementSibling?.textContent ??
      '';
    if (/人|members|participants|在线|click here|点此查看/i.test(subtitle)) return true;
    if (header.querySelector('[data-testid="group-info-drawer-section"], [data-icon="default-group"]')) {
      return true;
    }
  }

  const main = getMain();
  if (!main) return false;
  const sample = [...main.querySelectorAll<HTMLElement>('[data-id]')].slice(0, 40);
  let groupHits = 0;
  for (const node of sample) {
    const id = node.getAttribute('data-id') ?? '';
    if (/@g\.us/i.test(id)) groupHits += 1;
    if (groupHits >= 2) return true;
  }
  return false;
}

/** Pull international digits only from contact-scoped DOM, never message IDs. */
function extractPhoneFromWaDom(): string | null {
  const sources: string[] = [];

  const selected =
    document.querySelector<HTMLElement>(
      '#pane-side [aria-selected="true"], #pane-side [data-selected="true"]',
    ) ??
    document.querySelector<HTMLElement>(
      '#pane-side [aria-current="page"], #pane-side div[role="listitem"][aria-selected="true"]',
    );
  if (selected) {
    const cell =
      selected.closest<HTMLElement>('[data-id], [data-testid="cell-frame-container"]') ??
      selected;
    sources.push(cell.getAttribute('data-id') ?? '');
    cell.querySelectorAll<HTMLElement>('[data-id]').forEach((n) => {
      sources.push(n.getAttribute('data-id') ?? '');
    });
  }

  const header = getHeader();
  if (header) {
    header.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
      sources.push(node.getAttribute('data-id') ?? '');
    });
    header.querySelectorAll<HTMLAnchorElement>('a[href*="phone"], a[href*="wa.me"]').forEach((a) => {
      sources.push(a.href);
    });
  }

  const contactRoots = document.querySelectorAll<HTMLElement>(
    '[data-testid="contact-info-drawer"], [data-testid="drawer-middle"], [data-testid="drawer-right"]',
  );
  for (const root of contactRoots) {
    if (!isVisible(root)) continue;
    const exactNodes = root.querySelectorAll<HTMLElement>('span[dir="auto"], [title], a[href]');
    for (const node of exactNodes) {
      const raw = `${node.getAttribute('title') ?? ''} ${(node.textContent ?? '').trim()} ${node.getAttribute('href') ?? ''}`;
      const exact = extractExactPhone(raw);
      if (exact) return exact;
    }
  }

  for (const raw of sources) {
    const phone = extractPhoneFromWaId(raw);
    if (phone) return phone;
  }

  // Never infer from message participant IDs in group chats.
  if (isGroupChat()) return null;
  return extractPhoneFromCurrentMessageIds();
}

/** Recover a saved contact's phone from strict direct-chat message IDs. */
function extractPhoneFromCurrentMessageIds(): string | null {
  const main = getMain();
  if (!main) return null;
  const counts = new Map<string, number>();
  const nodes = main.querySelectorAll<HTMLElement>(
    '.message-in[data-id], .message-out[data-id], [data-testid="msg-container"][data-id], .message-in [data-id], .message-out [data-id]',
  );
  for (const node of nodes) {
    const raw = node.getAttribute('data-id') ?? '';
    const match = raw.match(/^(?:true|false)_(\d{7,15})@(?:c\.us|s\.whatsapp\.net)(?:_|$)/i);
    const phone = match?.[1];
    if (!phone) continue;
    counts.set(phone, (counts.get(phone) ?? 0) + 1);
  }

  let best = '';
  let bestCount = 0;
  for (const [phone, count] of counts) {
    if (count <= bestCount) continue;
    best = phone;
    bestCount = count;
  }
  return best || null;
}

function extractExactPhone(raw: string): string | null {
  const text = raw.trim();
  const phoneOnly = text.match(/^\s*(?:tel:)?\+?[\d\s()-]{7,22}\s*$/i);
  if (!phoneOnly) return null;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/** Parse `false_6011...@c.us_...`, `6011...@c.us`, `wa.me/6011...`, etc. */
function extractPhoneFromWaId(raw: string): string | null {
  if (!raw) return null;
  const patterns = [
    /(?:^|[_\s/])(\d{8,15})@(?:c\.us|s\.whatsapp\.net)\b/i,
    /(?:wa\.me\/|phone=)(\+?\d{8,15})/i,
    /\+(\d{8,15})\b/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (!m?.[1]) continue;
    const digits = m[1].replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) return digits;
  }
  return null;
}

function extractPhoneFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\+?\d[\d\s()-]{6,}\d/);
  if (match) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) return digits;
  }
  const normalized = text.replace(/[^\d+]/g, '');
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

export function getMessagePane(): HTMLElement | null {
  return (
    queryFirst(document, [
      '#main [data-testid="conversation-panel-messages"]',
      '#main div[role="application"]',
      '#main .copyable-area',
      '#main',
    ]) ?? null
  );
}

export function findMessageBubbles(root: ParentNode = document): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const out: HTMLElement[] = [];

  const push = (el: HTMLElement) => {
    const row = normalizeBubble(el);
    if (!row || seen.has(row)) return;
    seen.add(row);
    out.push(row);
  };

  for (const el of all('.message-in, .message-out', root)) push(el);
  if (out.length) return out;

  for (const el of all('[data-testid="msg-container"]', root)) push(el);
  if (out.length) return out;

  for (const el of all('[data-id]', root)) {
    const id = el.getAttribute('data-id') || '';
    if (/^(true|false)_/.test(id) || el.querySelector('span.selectable-text, span[dir="ltr"], span[dir="rtl"]')) {
      push(el);
    }
  }
  return out;
}

function normalizeBubble(el: HTMLElement): HTMLElement | null {
  if (el.matches('.message-in, .message-out, [data-testid="msg-container"]')) return el;
  return (
    el.closest<HTMLElement>('.message-in, .message-out, [data-testid="msg-container"]') ?? el
  );
}

export function isOutgoing(el: HTMLElement): boolean {
  const row = normalizeBubble(el) ?? el;

  // Check class names
  if (row.classList.contains('message-out') || row.closest('.message-out')) return true;
  if (row.classList.contains('message-in') || row.closest('.message-in')) return false;

  // Check data-id prefix
  const id = row.getAttribute('data-id') || '';
  if (id.startsWith('true_')) return true;
  if (id.startsWith('false_')) return false;

  // Check aria-label
  const aria = row.getAttribute('aria-label') ?? '';
  if (/you|sent|outgoing|你/i.test(aria)) return true;

  // Additional check: right-aligned messages are usually outgoing
  // WhatsApp uses flex justify-end for outgoing messages
  const parent = row.parentElement;
  if (parent) {
    const style = getComputedStyle(parent);
    if (style.justifyContent === 'flex-end' || style.justifyContent === 'end') return true;
  }

  return false;
}

/**
 * 明确判定为「收到的消息」。
 * 自动翻译必须用它而不是 !isOutgoing()：消息刚发出的一瞬间 WhatsApp 还没打上
 * message-out 标记，此时 isOutgoing 返回 false，自己发的内容会被当成来消息翻译，
 * 而 autoAttempted 只记一次，错误结果就固定下来了。
 * 证据不足时宁可不翻译——手动点按钮始终可用。
 */
export function isIncoming(el: HTMLElement): boolean {
  const row = normalizeBubble(el) ?? el;
  if (row.classList.contains('message-in') || row.closest('.message-in')) return true;
  const id = row.getAttribute('data-id') || '';
  return id.startsWith('false_');
}

export function getMessageId(el: HTMLElement): string {
  const row = normalizeBubble(el) ?? el;
  const ids = [
    row.getAttribute('data-id') ?? '',
    ...[...row.querySelectorAll<HTMLElement>('[data-id]')].map(
      (node) => node.getAttribute('data-id') ?? '',
    ),
  ].filter(Boolean);
  const messageId =
    ids.find((id) => /^(true|false)_/.test(id)) ??
    ids.find((id) => /@(c\.us|s\.whatsapp\.net|g\.us)\b/i.test(id)) ??
    ids[0];
  if (messageId) return messageId;

  const prePlain = [
    ...row.querySelectorAll<HTMLElement>('[data-pre-plain-text]'),
  ]
    .map((node) => node.getAttribute('data-pre-plain-text') ?? '')
    .filter(Boolean)
    .join('|');
  const direction = isOutgoing(row) ? 'out' : 'in';
  return `node-${hashText(`${direction}|${prePlain}|${getMessageText(row)}`)}`;
}

function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

export function getMessageText(el: HTMLElement): string {
  const row = normalizeBubble(el) ?? el;
  // `.copyable-text span` 会一并选中时间戳那个 span，必须和 tier2 用同一套过滤，
  // 否则 bestUniqueText 会把 "11:07" 拼到正文后面一起送去翻译。
  const tier1 = [...row.querySelectorAll<HTMLElement>(
    'span.selectable-text.copyable-text, span.selectable-text, .copyable-text span',
  )]
    .filter((node) => !isWamofaNode(node))
    .map((node) => node.textContent?.trim() ?? '')
    .filter((text) => text && !looksLikeIcon(text) && !looksLikeTimestamp(text));
  if (tier1.length) return bestUniqueText(tier1);

  const tier2 = [...row.querySelectorAll<HTMLElement>('span[dir="ltr"], span[dir="rtl"]')]
    .filter((node) => !isWamofaNode(node))
    .map((node) => node.textContent?.trim() ?? '')
    .filter((text) => text && !looksLikeIcon(text) && !looksLikeTimestamp(text));
  if (tier2.length) return bestUniqueText(tier2);

  return collectFilteredText(row);
}

function bestUniqueText(parts: string[]): string {
  const uniq = [...new Set(parts)];
  const outermost = uniq.filter(
    (part) => !uniq.some((other) => other !== part && other.includes(part)),
  );
  return outermost.join('\n').trim();
}

function isWamofaNode(node: Node): boolean {
  const parent = node instanceof Element ? node : node.parentElement;
  return Boolean(parent?.closest('.wamofa-toolbar, .wamofa-result'));
}

function collectFilteredText(root: HTMLElement): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const chunks: string[] = [];
  while (walker.nextNode()) {
    if (isWamofaNode(walker.currentNode)) continue;
    const text = walker.currentNode.textContent?.trim() ?? '';
    if (!text || looksLikeIcon(text) || looksLikeTimestamp(text)) continue;
    chunks.push(text);
  }
  return chunks.join(' ').trim();
}

function looksLikeIcon(text: string): boolean {
  return /^[\uE000-\uF8FF\u200B-\u200D\uFEFF]+$/.test(text) || /^wds-/.test(text);
}

function looksLikeTimestamp(text: string): boolean {
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return true;
  // 必须含 : 或 /，否则 "1000"、"1,000" 这类数量和报价会被当成时间戳丢掉
  if (/[:/]/.test(text) && /^[\d:/\s,APM]+$/i.test(text)) return true;
  // 中文界面的 12 小时制：下午3:20 / 上午 9:05
  if (/^(上午|下午|凌晨|早上|中午|晚上)\s*\d{1,2}:\d{2}$/.test(text)) return true;
  // 气泡角落的状态词，同样不属于正文
  return /^(已编辑|Edited|已转发|Forwarded)$/i.test(text);
}

export function isVoiceMessage(el: HTMLElement): boolean {
  const row = normalizeBubble(el) ?? el;
  if (row.querySelector('audio')) return true;
  if (row.querySelector('[data-testid="audio-play"], [data-testid="ptt-play-button"]')) return true;
  const label =
    row.querySelector('button[aria-label]')?.getAttribute('aria-label') ??
    row.getAttribute('aria-label') ??
    '';
  if (/voice|audio|语音|音频|ptt|message audio/i.test(label)) return true;
  return Boolean(
    row.querySelector('canvas') && row.querySelector('button:not(.wamofa-icon-btn)'),
  );
}

export function getChatListItems(): HTMLElement[] {
  const pane = first('#pane-side');
  if (!pane) return [];
  const items = all('[data-testid="cell-frame-container"]', pane);
  if (items.length) return items;
  return all('[role="listitem"], [role="row"]', pane);
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
