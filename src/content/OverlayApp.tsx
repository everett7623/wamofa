import { useEffect, useRef, useState } from 'react';
import { ComposeBar } from '~/content/ComposeBar';
import { HeaderBar } from '~/content/HeaderBar';
import { OpenChatPanel } from '~/content/OpenChatPanel';
import { QuickReplyPanel } from '~/content/QuickReplyPanel';
import { RightRail, type RailPanel } from '~/content/RightRail';
import { setRuntimeChatId } from '~/content/runtime';
import { registerShortcut, unregisterShortcut, type ShortcutHandler } from '~/content/shortcuts';
import { isExtensionAlive } from '~/lib/extension-context';
import { sendExtension } from '~/lib/messaging';
import { langLabel } from '~/lib/langs';
import { parsePhoneFromChatId, parseTitleFromChatId, resolveChatLookup } from '~/lib/chat-keys';
import { getComposeText, setComposeText } from '~/wa/compose';
import type { PublicState } from '~/lib/types';
import { setTranslationsHidden } from '~/content/messages';
import {
  getActiveChatId,
  getHeaderPhone,
  getHeaderTitle,
  isDarkTheme,
  isMediaPreviewOpen,
} from '~/wa/dom';

interface Props {
  state: PublicState;
  onState: (state: PublicState) => void;
}

function sameConversation(prev: string | null, next: string | null, title: string): boolean {
  if (!prev || !next || prev === next) return prev === next;
  const prevPhone = parsePhoneFromChatId(prev);
  const nextPhone = parsePhoneFromChatId(next);
  if (prevPhone && nextPhone && prevPhone === nextPhone) return true;
  const prevTitle = parseTitleFromChatId(prev);
  const nextTitle = parseTitleFromChatId(next);
  if (prevTitle && nextPhone && title && prevTitle === title) return true;
  if (nextTitle && prevPhone && title && nextTitle === title) return true;
  return false;
}

export function OverlayApp({ state, onState }: Props) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [headerPhone, setHeaderPhone] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);
  const [translationsHidden, setTranslationsHiddenState] = useState(false);
  const [toast, setToast] = useState('');
  const [activePanel, setActivePanel] = useState<RailPanel>(null);
  const chatIdRef = useRef<string | null>(null);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      if (!isExtensionAlive()) {
        window.clearInterval(timer);
        window.removeEventListener('resize', tick);
        return;
      }
      const id = getActiveChatId();
      const nextTitle = getHeaderTitle();
      const prev = chatIdRef.current;
      chatIdRef.current = id;
      setChatId(id);
      setTitle(nextTitle);
      setHeaderPhone(getHeaderPhone());
      setDark(isDarkTheme());
      setRuntimeChatId(id);

      // title: → phone: for the same contact: migrate meta, keep panel open.
      if (prev && id && prev !== id && sameConversation(prev, id, nextTitle)) {
        if (id.startsWith('phone:') && prev.startsWith('title:')) {
          void sendExtension({
            type: 'WAMOFA_UPSERT_CHAT',
            chatId: id,
            patch: {},
            aliasTitle: nextTitle || parseTitleFromChatId(prev),
          }).then((res) => {
            if (res.ok && 'state' in res) onState(res.state);
          });
        }
        return;
      }
    };
    // 先注册再同步执行一次：挂载即失效时 tick 里的 clearInterval 才有目标可清
    timer = window.setInterval(tick, 1500);
    window.addEventListener('resize', tick);
    tick();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', tick);
    };
  }, [onState]);

  useEffect(() => {
    setTranslationsHidden(translationsHidden);
  }, [translationsHidden]);

  useEffect(() => () => setTranslationsHidden(false), []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = isMediaPreviewOpen();
        setMediaPreviewOpen((current) => (current === next ? current : next));
      });
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
    });
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Close panel only when conversation identity truly changes.
  const lastStableRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastStableRef.current;
    lastStableRef.current = chatId;
    if (!prev || !chatId) {
      if (!chatId) setActivePanel(null);
      return;
    }
    if (!sameConversation(prev, chatId, title)) {
      setActivePanel(null);
    }
  }, [chatId, title]);

  // Ctrl+Shift+R / I / T 分别被浏览器占用（硬刷新、开发者工具、恢复标签页），
  // 页面脚本无法拦截，因此统一改用 Alt+Shift 组合。
  useEffect(() => {
    const bindings: ShortcutHandler[] = [
      {
        action: 'open-quick-reply',
        keys: ['alt', 'shift', 'r'],
        description: '打开快捷回复面板',
        handler: () => {
          if (chatId) setActivePanel('quick');
        },
      },
      {
        action: 'open-customer-info',
        keys: ['alt', 'shift', 'i'],
        description: '打开客户档案',
        handler: () => {
          if (chatId) setActivePanel('info');
        },
      },
      {
        action: 'open-translate-panel',
        keys: ['alt', 'shift', 't'],
        description: '打开翻译面板',
        handler: () => {
          if (chatId) setActivePanel('translate');
        },
      },
      {
        action: 'translate-compose',
        keys: ['alt', 'shift', 'enter'],
        description: '把输入框内容译成发出语言',
        handler: () => translateComposeRef.current(),
      },
      {
        action: 'toggle-translations',
        keys: ['alt', 'shift', 'h'],
        description: '隐藏或显示翻译结果',
        handler: () => {
          setTranslationsHiddenState((current) => !current);
        },
      },
    ];
    for (const binding of bindings) registerShortcut(binding);
    return () => {
      for (const binding of bindings) unregisterShortcut(binding.keys);
    };
  }, [chatId]);

  useEffect(() => {
    if (!activePanel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePanel(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel]);

  const composeBusyRef = useRef(false);

  /**
   * 把 WhatsApp 输入框里的内容就地译成该会话的发出语言。
   * 只替换文本、不代替用户发送：译文发出去就撤不回来，报价和规格必须过一眼。
   */
  async function translateCompose() {
    if (composeBusyRef.current) return;
    const text = getComposeText().trim();
    if (!text) {
      setToast('输入框是空的');
      return;
    }
    if (!state.settings.hasKey) {
      setToast('请先在 WAMofa 设置里填写 API Key');
      return;
    }
    const { meta } = resolveChatLookup(state.chats, { chatId, title, phone: headerPhone });
    const targetLang = meta.outgoingLang ?? state.settings.outgoingLang;
    composeBusyRef.current = true;
    setToast(`正在译成${langLabel(targetLang)}…`);
    try {
      const res = await sendExtension({ type: 'WAMOFA_TRANSLATE', text, targetLang });
      if (!res.ok || !('text' in res)) {
        setToast(res.ok ? '翻译失败' : res.error);
        return;
      }
      const written = await setComposeText(res.text);
      if (written === 'clipboard') setToast('已复制译文，请粘贴到输入框');
      else if (written === 'fail') setToast('无法写入输入框');
      else setToast('已替换为译文，确认后按 Enter 发送');
    } catch {
      setToast('翻译请求失败，请检查网络与接口配置');
    } finally {
      composeBusyRef.current = false;
    }
  }

  // 快捷键在 [chatId] 变化时才重新注册，这里用 ref 让 handler 始终拿到最新的 state。
  const translateComposeRef = useRef<() => void>(() => {});
  translateComposeRef.current = () => {
    void translateCompose();
  };

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
    open: { title: '快速开聊', subtitle: '不存号码，官方 send 链接' },
  } as const;
  const currentPanel = activePanel ? panelMeta[activePanel] : null;

  return (
    <>
      {panelOpen ? (
        <div
          className={`wm-side-panel ${dark ? 'is-dark' : ''} ${mediaPreviewOpen ? 'is-media-preview' : ''}`}
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
              <ComposeBar
                chatId={chatId}
                title={title}
                headerPhone={headerPhone}
                state={state}
                onToast={setToast}
              />
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
            {activePanel === 'open' ? (
              <OpenChatPanel
                state={state}
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
        mediaPreviewOpen={mediaPreviewOpen}
        translationsHidden={translationsHidden}
        chatReady={Boolean(chatId)}
        configured={state.settings.hasKey}
        onToggle={setActivePanel}
        onToggleTranslations={() => {
          setTranslationsHiddenState((current) => {
            const next = !current;
            setToast(next ? '已隐藏译文，可直接截图' : '已恢复译文显示');
            return next;
          });
        }}
        onSettings={() => void openSettings()}
      />

      {toast ? <div className="wm-toast">{toast}</div> : null}
    </>
  );
}
