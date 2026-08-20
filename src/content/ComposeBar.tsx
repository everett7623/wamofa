import { useState } from 'react';
import { sendExtension } from '~/lib/messaging';
import type { PublicState } from '~/lib/types';
import { getComposeText, insertComposeText, setComposeText } from '~/wa/compose';

interface Props {
  chatId: string;
  state: PublicState;
  onToast: (text: string) => void;
}

export function ComposeBar({ chatId, state, onToast }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const outgoingLang =
    state.chats[chatId]?.outgoingLang ?? state.settings.outgoingLang;

  async function translateInput() {
    const text = getComposeText().trim();
    if (!text) {
      onToast('输入框是空的');
      return;
    }
    if (!state.settings.hasKey) {
      onToast('请先在选项里填写 API Key');
      return;
    }
    setBusy(true);
    const res = await sendExtension({
      type: 'WAMOFA_TRANSLATE',
      text,
      targetLang: outgoingLang,
    });
    setBusy(false);
    if (!res.ok || !('text' in res)) {
      onToast(!res.ok ? res.error : '翻译失败');
      return;
    }
    setPreview(res.text);
  }

  async function replaceInput() {
    if (!preview) return;
    const result = await setComposeText(preview);
    if (result === 'clipboard') {
      onToast('已复制译文，请在输入框粘贴');
    } else if (result === 'fail') {
      onToast('无法写入输入框');
    } else {
      setPreview('');
    }
  }

  async function applyTemplate(body: string) {
    const result = await insertComposeText(body);
    setOpen(false);
    if (result === 'clipboard') onToast('已复制模板，请粘贴到输入框');
    if (result === 'fail') onToast('无法写入输入框');
  }

  return (
    <div className="wm-compose">
      <button type="button" className="wm-btn" disabled={busy} onClick={() => void translateInput()}>
        {busy ? '翻译中' : '翻译发出'}
      </button>
      {preview ? (
        <button type="button" className="wm-btn primary" onClick={() => void replaceInput()}>
          替换
        </button>
      ) : null}
      <div className="wm-menu">
        <button type="button" className="wm-btn ghost" onClick={() => setOpen((v) => !v)}>
          快捷回复
        </button>
        {open ? (
          <div className="wm-menu-list">
            {state.templates.length ? (
              state.templates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void applyTemplate(item.body)}
                >
                  {item.title}
                </button>
              ))
            ) : (
              <p>到选项页添加模板</p>
            )}
          </div>
        ) : null}
      </div>
      {preview ? <div className="wm-preview">{preview}</div> : null}
    </div>
  );
}
