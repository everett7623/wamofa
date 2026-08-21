import { useEffect, useState } from 'react';
import { ComposeBar } from '~/content/ComposeBar';
import { HeaderBar } from '~/content/HeaderBar';
import { QuickReplyPanel } from '~/content/QuickReplyPanel';
import { RightRail, type RailPanel } from '~/content/RightRail';
import { setRuntimeChatId } from '~/content/runtime';
import { initShortcuts, registerShortcut } from '~/content/shortcuts';
import { sendExtension } from '~/lib/messaging';
import type { PublicState } from '~/lib/types';
import {
  getActiveChatId,
  getHeaderPhone,
  getHeaderTitle,
  isDarkTheme,
} from '~/wa/dom';

interface Props {
  state: PublicState;
  onState: (state: PublicState) => void;
}

export function OverlayApp({ state, onState }: Props) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [headerPhone, setHeaderPhone] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState('');
  const [activePanel, setActivePanel] = useState<RailPanel>(null);

  useEffect(() => {
    const tick = () => {
      const id = getActiveChatId();
      setChatId(id);
      setTitle(getHeaderTitle());
      setHeaderPhone(getHeaderPhone());
      setDark(isDarkTheme());
      setRuntimeChatId(id);
    };
    tick();

    // 降低轮询频率：1.5 秒一次，减少 DOM 查询开销
    const timer = window.setInterval(tick, 1500);
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

  useEffect(() => {
    setActivePanel(null);
  }, [chatId]);

  useEffect(() => {
    // 注册快捷键
    registerShortcut({
      action: 'open-quick-reply',
      keys: ['ctrl', 'shift', 'r'],
      description: '打开快捷回复面板',
      handler: () => {
        if (chatId) setActivePanel('quick');
      },
    });

    registerShortcut({
      action: 'open-customer-info',
      keys: ['ctrl', 'shift', 'i'],
      description: '打开客户档案',
      handler: () => {
        if (chatId) setActivePanel('info');
      },
    });

    registerShortcut({
      action: 'open-translate-panel',
      keys: ['ctrl', 'shift', 't'],
      description: '打开翻译面板',
      handler: () => {
        if (chatId) setActivePanel('translate');
      },
    });
  }, [chatId]);

  useEffect(() => {
    if (!activePanel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePanel(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel]);

  async function openSettings() {
    const res = await sendExtension({ type: 'WAMOFA_OPEN_OPTIONS' });
    if (!res.ok) {
      try {
        window.open(browser.runtime.getURL('/options.html'), '_blank');
      } catch {
        setToast('无法打开设置页');
      }
    }
  }

  const panelOpen = activePanel !== null;

  const panelMeta = {
    info: { title: '客户档案', subtitle: chatId ? title || '当前会话' : '等待选择会话' },
    translate: { title: '智能译出', subtitle: chatId ? `发送给 ${title || '当前客户'}` : '等待选择会话' },
    quick: { title: '快捷回复', subtitle: `${state.templates.length} 条可用话术` },
  } as const;
  const currentPanel = activePanel ? panelMeta[activePanel] : null;

  return (
    <>
      {panelOpen ? (
        <div
          className={`wm-side-panel ${dark ? 'is-dark' : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="wm-panel-head">
            <div className="wm-panel-heading">
              <span className="wm-panel-eyebrow">WAMofa Workspace</span>
              <span className="wm-panel-head-title">{currentPanel?.title}</span>
              <span className="wm-panel-subtitle">{currentPanel?.subtitle}</span>
            </div>
            <button
              type="button"
              className="wm-panel-close"
              aria-label="关闭"
              onClick={() => setActivePanel(null)}
            >
              ×
            </button>
          </div>
          <div className="wm-panel-body">
            {activePanel === 'info' && chatId ? (
              <HeaderBar
                chatId={chatId}
                title={title}
                headerPhone={headerPhone}
                dark={dark}
                state={state}
                onState={onState}
              />
            ) : null}
            {activePanel === 'info' && !chatId ? (
              <p className="wm-panel-section wm-panel-muted">请先打开一个聊天</p>
            ) : null}
            {activePanel === 'translate' && chatId ? (
              <ComposeBar chatId={chatId} state={state} onToast={setToast} />
            ) : null}
            {activePanel === 'translate' && !chatId ? (
              <p className="wm-panel-section wm-panel-muted">请先打开一个聊天</p>
            ) : null}
            {activePanel === 'quick' ? (
              <QuickReplyPanel
                state={state}
                onState={onState}
                onToast={setToast}
                onClose={() => setActivePanel(null)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <RightRail
        active={activePanel}
        dark={dark}
        chatReady={Boolean(chatId)}
        configured={state.settings.hasKey}
        onToggle={setActivePanel}
        onSettings={() => void openSettings()}
      />

      {toast ? <div className="wm-toast">{toast}</div> : null}
    </>
  );
}
