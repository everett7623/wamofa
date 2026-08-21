import './style.css';
import ReactDOM from 'react-dom/client';
import { OverlayApp } from '~/content/OverlayApp';
import { clearMessageCaches } from '~/content/messages';
import { bindHeaderInsights } from '~/content/header-insights';
import { bindScanObserver, runScan, scheduleScan } from '~/content/scan';
import { injectPageStyles } from '~/content/page-styles';
import { setRuntimeChatId, setRuntimeState } from '~/content/runtime';
import { sendExtension } from '~/lib/messaging';
import type { PublicState } from '~/lib/types';
import { getActiveChatId, waitForApp } from '~/wa/dom';

export default defineContentScript({
  matches: ['https://web.whatsapp.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    await waitForApp(() => ctx.isInvalid);
    injectPageStyles();

    let state: PublicState | null = null;
    let lastChatId: string | null = null;
    let renderUi: ((next: PublicState) => void) | null = null;

    const applyState = (next: PublicState) => {
      state = next;
      setRuntimeState(next);
      const chatId = getActiveChatId();
      if (chatId !== lastChatId) {
        lastChatId = chatId;
        setRuntimeChatId(chatId);
        clearMessageCaches();
      }
      renderUi?.(next);
      scheduleScan(0);
    };

    const refresh = async () => {
      const res = await sendExtension({ type: 'WAMOFA_GET_STATE' });
      if (res.ok && 'state' in res) applyState(res.state);
    };
    await refresh();

    bindScanObserver(ctx);
    bindHeaderInsights(ctx);

    const { initShortcuts } = await import('~/content/shortcuts');
    initShortcuts(ctx);

    ctx.addEventListener(window, 'wxt:locationchange', () => {
      const chatId = getActiveChatId();
      if (chatId !== lastChatId) {
        lastChatId = chatId;
        setRuntimeChatId(chatId);
        clearMessageCaches();
      }
      scheduleScan(80);
    });

    const handleStorageChange = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'local' && changes.wamofa) void refresh();
    };
    browser.storage.onChanged.addListener(handleStorageChange);
    ctx.onInvalidated(() => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    });

    const ui = await createShadowRootUi(ctx, {
      name: 'wamofa-overlay',
      position: 'overlay',
      zIndex: 2147483647,
      isolateEvents: ['keydown', 'keyup', 'keypress'],
      onMount(container, _shadow, shadowHost) {
        Object.assign((shadowHost as HTMLElement).style, {
          position: 'fixed',
          inset: '0',
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
        });
        const app = document.createElement('div');
        container.append(app);
        const root = ReactDOM.createRoot(app);
        renderUi = (next: PublicState) => {
          root.render(
            <OverlayApp
              state={next}
              onState={applyState}
            />,
          );
        };
        if (state) renderUi(state);
        void refresh();
        return root;
      },
      onRemove(root) {
        renderUi = null;
        root?.unmount();
      },
    });
    ui.mount();
    runScan();
  },
});
