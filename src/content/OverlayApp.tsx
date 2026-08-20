import { useEffect, useState } from 'react';
import { ComposeBar } from '~/content/ComposeBar';
import { HeaderBar } from '~/content/HeaderBar';
import type { PublicState } from '~/lib/types';
import { getActiveChatId, getFooter, getHeader, getHeaderTitle, isDarkTheme } from '~/wa/dom';

interface Props {
  state: PublicState;
  onState: (state: PublicState) => void;
}

export function OverlayApp({ state, onState }: Props) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [headerRect, setHeaderRect] = useState<DOMRect | null>(null);
  const [footerRect, setFooterRect] = useState<DOMRect | null>(null);
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const tick = () => {
      const header = getHeader();
      const footer = getFooter();
      const id = getActiveChatId();
      setHeaderRect(header?.getBoundingClientRect() ?? null);
      setFooterRect(footer?.getBoundingClientRect() ?? null);
      setChatId(id);
      setTitle(getHeaderTitle());
      setDark(isDarkTheme());
      window.__WAMOFA_CHAT_ID__ = id ?? undefined;
    };
    tick();
    const timer = window.setInterval(tick, 400);
    window.addEventListener('resize', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', tick);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="wm-root">
      {chatId && headerRect && headerRect.width > 80 ? (
        <div
          className="wm-header-slot"
          style={{
            top: headerRect.bottom,
            left: headerRect.left,
            width: headerRect.width,
          }}
        >
          <HeaderBar
            chatId={chatId}
            title={title}
            dark={dark}
            state={state}
            onState={onState}
          />
        </div>
      ) : null}
      {chatId && footerRect && footerRect.width > 80 ? (
        <div
          className="wm-footer-slot"
          style={{
            top: footerRect.top - 8,
            left: footerRect.left + 12,
            transform: 'translateY(-100%)',
          }}
        >
          <ComposeBar chatId={chatId} state={state} onToast={setToast} />
        </div>
      ) : null}
      {toast ? <div className="wm-toast">{toast}</div> : null}
    </div>
  );
}
