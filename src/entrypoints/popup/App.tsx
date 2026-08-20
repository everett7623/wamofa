import { useEffect, useState } from 'react';
import { sendExtension } from '~/lib/messaging';
import { normalizePhone, whatsappSendUrl } from '~/lib/phone';
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
    const tabs = await browser.tabs.query({ url: '*://web.whatsapp.com/*' });
    if (tabs[0]?.id) {
      await browser.tabs.update(tabs[0].id, { url, active: true });
      if (tabs[0].windowId != null) {
        try {
          await browser.windows.update(tabs[0].windowId, { focused: true });
        } catch {
          // some browsers restrict window focus
        }
      }
    } else {
      await browser.tabs.create({ url });
    }
    setHint(`正在打开 ${normalized}`);
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white">
          W
        </div>
        <div>
          <div className="text-sm font-semibold">WAMofa</div>
          <div className="text-xs text-muted">WhatsApp Web 安全辅助</div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted">
        {state?.settings.hasKey
          ? `已配置 ${state.settings.providerId}，翻译会走你自己的 Key。`
          : '还没填 API Key。先打开选项页。'}
      </p>

      <label className="mt-4 block text-xs font-medium text-ink">
        不保存号码，直接开聊
        <input
          className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
          placeholder="+86 138 0000 0000"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void openChat();
          }}
        />
      </label>
      <button
        type="button"
        className="mt-2 w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        onClick={() => void openChat()}
      >
        打开聊天
      </button>
      {hint ? <p className="mt-2 text-xs text-brand">{hint}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-md border border-line px-3 py-2 text-xs"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          选项
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border border-line px-3 py-2 text-xs"
          onClick={() => browser.tabs.create({ url: 'https://web.whatsapp.com/' })}
        >
          打开 WhatsApp Web
        </button>
      </div>
    </div>
  );
}
