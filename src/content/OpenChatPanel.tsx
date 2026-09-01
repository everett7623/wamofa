import { useState } from 'react';
import { buildOpenChatRequest } from '~/lib/phone';
import type { PublicState } from '~/lib/types';

interface Props {
  state: PublicState;
  onToast: (text: string) => void;
  onClose: () => void;
}

export function OpenChatPanel({ state, onToast, onClose }: Props) {
  const [phone, setPhone] = useState('');
  const [hint, setHint] = useState('');

  function openChat() {
    const result = buildOpenChatRequest(phone, state.settings.defaultCountryCode);
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
        <span className="wm-open-chat-prefix">+</span>
        <input
          className="wm-input"
          inputMode="tel"
          autoComplete="tel"
          aria-label="电话号码"
          placeholder={`${state.settings.defaultCountryCode} 138 0000 0000`}
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
      <button type="button" className="wm-btn" onClick={openChat}>
        打开对话
      </button>
      {hint ? <p className="wm-open-chat-hint">{hint}</p> : null}
      <p className="wm-panel-muted wm-open-chat-tip">
        默认区号在设置 → 语言与习惯 中修改（当前 +{state.settings.defaultCountryCode}）
      </p>
    </div>
  );
}
