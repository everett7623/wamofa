import { useState } from 'react';
import { buildOpenChatRequest, phoneExample, phoneFormatHint } from '~/lib/phone';
import type { PublicState } from '~/lib/types';

interface Props {
  state: PublicState;
  onToast: (text: string) => void;
  onClose: () => void;
}

export function OpenChatPanel({ state, onToast, onClose }: Props) {
  const [phone, setPhone] = useState('');
  const [hint, setHint] = useState('');
  // 默认区号现在只用于占位示例，不再参与号码补全
  const countryCode = state.settings.defaultCountryCode;

  function openChat() {
    const result = buildOpenChatRequest(phone);
    if (!result.ok) {
      setHint(result.error);
      return;
    }
    onToast(`正在打开 +${result.normalized}`);
    onClose();
    window.location.assign(result.url);
  }

  return (
    <div className="wm-panel-section wm-open-chat">
      <p className="wm-panel-muted">
        使用 WhatsApp 官方 <code>send?phone=</code> 链接开聊，不会把号码存进通讯录。
      </p>
      <label className="wm-open-chat-field">
        <input
          className="wm-input"
          inputMode="tel"
          autoComplete="tel"
          aria-label="电话号码"
          aria-invalid={Boolean(hint)}
          aria-describedby="wm-open-chat-tip"
          placeholder={phoneExample(countryCode)}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (hint) setHint('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') openChat();
          }}
        />
      </label>
      <p id="wm-open-chat-tip" className="wm-panel-muted wm-open-chat-tip">
        {phoneFormatHint(countryCode)}
      </p>
      <button type="button" className="wm-btn" onClick={openChat}>
        打开对话
      </button>
      {hint ? <p className="wm-open-chat-hint" role="alert">{hint}</p> : null}
    </div>
  );
}
