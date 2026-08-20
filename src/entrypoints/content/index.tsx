import './style.css';
import ReactDOM from 'react-dom/client';
import { OverlayApp } from '~/content/OverlayApp';
import { enhanceChatList } from '~/content/chat-list';
import { enhanceMessages } from '~/content/messages';
import { injectPageStyles } from '~/content/page-styles';
import { sendExtension } from '~/lib/messaging';
import type { PublicState } from '~/lib/types';
import { waitForApp } from '~/wa/dom';

export default defineContentScript({
  matches: ['https://web.whatsapp.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    await waitForApp(() => ctx.isInvalid);
    injectPageStyles();

    let state: PublicState | null = null;
    const refresh = async () => {
      const res = await sendExtension({ type: 'WAMOFA_GET_STATE' });
      if (res.ok && 'state' in res) {
        state = res.state;
        enhanceMessages(state);
        enhanceChatList(state);
      }
    };
    await refresh();

    const observer = new MutationObserver(() => {
      if (!state) return;
      enhanceMessages(state);
      enhanceChatList(state);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());

    browser.storage.onChanged.addListener(() => {
      void refresh();
    });

    const ui = await createShadowRootUi(ctx, {
      name: 'wamofa-overlay',
      position: 'overlay',
      zIndex: 2147483000,
      isolateEvents: true,
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
        const render = (next: PublicState) => {
          state = next;
          root.render(
            <OverlayApp
              state={next}
              onState={(updated) => {
                state = updated;
                render(updated);
                enhanceChatList(updated);
              }}
            />,
          );
        };
        if (state) render(state);
        void refresh().then(() => {
          if (state) render(state);
        });
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
