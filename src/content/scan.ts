import { enhanceChatList } from '~/content/chat-list';
import { enhanceHeaderInsights } from '~/content/header-insights';
import { enhanceMessages } from '~/content/messages';
import { getRuntimeState } from '~/content/runtime';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

let timer: number | null = null;
let raf: number | null = null;

export function scheduleScan(delayMs = 120): void {
  if (timer != null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    if (raf != null) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(runScan);
  }, delayMs);
}

export function runScan(): void {
  raf = null;
  const state = getRuntimeState();
  if (!state) return;
  enhanceMessages(state);
  enhanceChatList(state);
  enhanceHeaderInsights();
}

export function bindScanObserver(ctx: ContentScriptContext): void {
  const root = document.getElementById('app') ?? document.body;
  const observer = new MutationObserver(() => scheduleScan());
  observer.observe(root, { childList: true, subtree: true });
  ctx.onInvalidated(() => observer.disconnect());
}
