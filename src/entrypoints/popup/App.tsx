import { useEffect, useState } from 'react';
import { sendExtension } from '~/lib/messaging';
import { normalizePhone, whatsappSendUrl } from '~/lib/phone';
import { getProvider } from '~/lib/providers';
import type { PublicState } from '~/lib/types';

export default function App() {
  const [state, setState] = useState<PublicState | null>(null);
  const [phone, setPhone] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    void sendExtension({ type: 'WAMOFA_GET_STATE' }).then((res) => {
      if (res.ok && 'state' in res) setState(res.state);
    });
  }, []);

  async function openChat() {
    const cc = state?.settings.defaultCountryCode ?? '86';
    const normalized = normalizePhone(phone, cc);
    if (!normalized) {
      setHint('请输入有效号码');
      return;
    }
    const url = whatsappSendUrl(normalized);
    try {
      const tabs = await browser.tabs.query({ url: '*://web.whatsapp.com/*' });
      if (tabs[0]?.id) {
        await browser.tabs.update(tabs[0].id, { url, active: true });
        if (tabs[0].windowId != null) {
          try {
            await browser.windows.update(tabs[0].windowId, { focused: true });
          } catch {
            // Some browsers restrict window focus after an extension action.
          }
        }
      } else {
        await browser.tabs.create({ url });
      }
      setHint(`正在打开 +${normalized}`);
    } catch {
      setHint('无法打开 WhatsApp Web，请稍后重试');
    }
  }

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <div className="popup-brand-mark">W</div>
        <div className="popup-brand-copy">
          <strong>WAMofa</strong>
          <span>WhatsApp 工作台</span>
        </div>
        <span className={`popup-status-dot ${state?.settings.hasKey ? 'is-ready' : ''}`} title={state?.settings.hasKey ? 'AI 已配置' : 'AI 未配置'} />
      </header>

      <section className={`connection-card ${state?.settings.hasKey ? 'is-ready' : ''}`}>
        <span className="connection-icon">AI</span>
        <div>
          <small>智能服务</small>
          <strong>
            {!state ? '正在读取配置…' : state.settings.hasKey ? `${getProvider(state.settings.providerId).name} 已就绪` : '等待配置 API Key'}
          </strong>
        </div>
        <button type="button" onClick={() => browser.runtime.openOptionsPage()}>
          {state?.settings.hasKey ? '管理' : '配置'}
        </button>
      </section>

      <section className="quick-chat-card">
        <div className="popup-section-title">
          <div><span>Quick chat</span><strong>不存号码，直接开聊</strong></div>
          <i aria-hidden="true">↗</i>
        </div>
        <label className="phone-field">
          <span aria-hidden="true">+</span>
          <input
            inputMode="tel"
            autoComplete="tel"
            aria-label="电话号码"
            aria-invalid={hint === '请输入有效号码'}
            placeholder="86 138 0000 0000"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              if (hint) setHint('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void openChat();
            }}
          />
        </label>
        <button type="button" className="open-chat-btn" onClick={() => void openChat()}>
          打开对话 <span aria-hidden="true">→</span>
        </button>
        {hint ? <p className="popup-hint" role="status">{hint}</p> : null}
      </section>

      <footer className="popup-footer">
        <button type="button" onClick={() => browser.runtime.openOptionsPage()}>
          工作台设置
        </button>
        <span />
        <button type="button" onClick={() => browser.tabs.create({ url: 'https://web.whatsapp.com/' })}>
          打开 WhatsApp Web
        </button>
      </footer>
    </div>
  );
}
