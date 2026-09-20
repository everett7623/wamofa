import { useEffect, useState } from 'react';
import { sendExtension } from '~/lib/messaging';
import { buildOpenChatRequest, phoneExample, phoneFormatHint } from '~/lib/phone';
import { getProvider } from '~/lib/providers';
import type { PublicState } from '~/lib/types';

interface Hint {
  text: string;
  error: boolean;
}

export default function App() {
  const [state, setState] = useState<PublicState | null>(null);
  const [phone, setPhone] = useState('');
  const [hint, setHint] = useState<Hint | null>(null);
  // 默认区号现在只用于占位示例，不再参与号码补全
  const countryCode = state?.settings.defaultCountryCode ?? '86';

  useEffect(() => {
    void sendExtension({ type: 'WAMOFA_GET_STATE' }).then((res) => {
      if (res.ok && 'state' in res) setState(res.state);
    });
  }, []);

  async function openChat() {
    const result = buildOpenChatRequest(phone);
    if (!result.ok) {
      setHint({ text: result.error, error: true });
      return;
    }
    try {
      const tabs = await browser.tabs.query({ url: '*://web.whatsapp.com/*' });
      if (tabs[0]?.id) {
        await browser.tabs.update(tabs[0].id, { url: result.url, active: true });
        if (tabs[0].windowId != null) {
          try {
            await browser.windows.update(tabs[0].windowId, { focused: true });
          } catch {
            // Some browsers restrict window focus after an extension action.
          }
        }
      } else {
        await browser.tabs.create({ url: result.url });
      }
      setHint({ text: `正在打开 +${result.normalized}`, error: false });
    } catch {
      setHint({ text: '无法打开 WhatsApp Web，请稍后重试', error: true });
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
          <input
            inputMode="tel"
            autoComplete="tel"
            aria-label="电话号码"
            aria-invalid={hint?.error ?? false}
            aria-describedby="phone-note"
            placeholder={phoneExample(countryCode)}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              if (hint) setHint(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void openChat();
            }}
          />
        </label>
        <p id="phone-note" className="phone-note">{phoneFormatHint(countryCode)}</p>
        <button type="button" className="open-chat-btn" onClick={() => void openChat()}>
          打开对话 <span aria-hidden="true">→</span>
        </button>
        {hint ? (
          <p className={`popup-hint${hint.error ? ' is-error' : ''}`} role={hint.error ? 'alert' : 'status'}>
            {hint.text}
          </p>
        ) : null}
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
