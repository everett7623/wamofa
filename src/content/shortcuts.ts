/**
 * 快捷键管理模块
 * 提供全局快捷键支持，不干扰 WhatsApp 原生功能
 */

export type ShortcutAction =
  | 'translate-selected'
  | 'open-quick-reply'
  | 'open-customer-info'
  | 'open-translate-panel'
  | 'toggle-translations';

export interface ShortcutHandler {
  action: ShortcutAction;
  keys: string[];
  description: string;
  handler: () => void;
}

const handlers = new Map<string, ShortcutHandler>();

const MODIFIERS = ['ctrl', 'shift', 'alt'] as const;

/** 归一化组合键：修饰键按固定顺序排列，注册顺序不再影响匹配。 */
function normalizeCombo(keys: string[]): string {
  const lower = keys.map((item) => item.toLowerCase());
  const mods = MODIFIERS.filter((item) => lower.includes(item));
  const rest = lower.filter((item) => !MODIFIERS.includes(item as typeof MODIFIERS[number]));
  return [...mods, ...rest].join('+');
}

/**
 * 注册快捷键
 */
export function registerShortcut(config: ShortcutHandler): void {
  handlers.set(normalizeCombo(config.keys), config);
}

/**
 * 注销快捷键
 */
export function unregisterShortcut(keys: string[]): void {
  handlers.delete(normalizeCombo(keys));
}

/**
 * 检查是否在输入框内
 */
function isInInputContext(): boolean {
  const active = document.activeElement;
  if (!active) return false;

  const tag = active.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((active as HTMLElement).contentEditable === 'true') return true;

  return false;
}

/**
 * 处理键盘事件
 */
export function handleKeyDown(event: Event): void {
  if (!(event instanceof KeyboardEvent)) return;

  // 在 WhatsApp 输入框内时，不拦截快捷键（除了全局快捷键）
  const inInput = isInInputContext();

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');

  // 标准化按键名。按住 Alt 时 event.key 在部分布局会变成特殊字符
  // （如 macOS 的 Alt+R 得到 ®），因此字母/数字优先用与布局无关的 event.code。
  let key = event.key.toLowerCase();
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3).toLowerCase();
  else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  else if (key === ' ') key = 'space';

  // 排除修饰键本身
  if (['control', 'shift', 'alt', 'meta'].includes(key)) return;

  parts.push(key);
  const combo = parts.join('+');

  const handler = handlers.get(combo);
  if (!handler) return;

  // 在输入框内时，只允许全局快捷键（如打开面板）
  if (
    inInput &&
    ![
      'open-quick-reply',
      'open-customer-info',
      'open-translate-panel',
      'toggle-translations',
    ].includes(handler.action)
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  handler.handler();
}

/**
 * 初始化快捷键监听
 */
export function initShortcuts(ctx: { addEventListener: (target: EventTarget, type: string, handler: EventListener) => void }): void {
  ctx.addEventListener(window, 'keydown', handleKeyDown);
}

/**
 * 获取所有已注册的快捷键
 */
export function getRegisteredShortcuts(): ShortcutHandler[] {
  return Array.from(handlers.values());
}
