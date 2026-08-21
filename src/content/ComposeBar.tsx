import { useState } from 'react';
import { LANGUAGES } from '~/lib/langs';
import { sendExtension } from '~/lib/messaging';
import type { PublicState } from '~/lib/types';
import { getComposeText, setComposeText } from '~/wa/compose';

interface Props {
  chatId: string;
  state: PublicState;
  onToast: (text: string) => void;
}

export function ComposeBar({ chatId, state, onToast }: Props) {
  const [source, setSource] = useState(() => getComposeText());
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const outgoingLang =
    state.chats[chatId]?.outgoingLang ?? state.settings.outgoingLang;
  const language = LANGUAGES.find((item) => item.id === outgoingLang)?.label ?? outgoingLang;

  function readCompose() {
    const text = getComposeText();
    setSource(text);
    setPreview('');
    onToast(text ? '已读取输入框' : '输入框是空的');
  }

  async function translateInput() {
    const text = source.trim() || getComposeText().trim();
    if (!text) {
      onToast('输入框是空的');
      return;
    }
    if (!state.settings.hasKey) {
      onToast(`请先在选项里填写${state.settings.authMode === 'projectKey' ? ' Project Key' : ' API Key'}`);
      return;
    }
    setSource(text);
    setBusy(true);
    try {
      const res = await sendExtension({
        type: 'WAMOFA_TRANSLATE',
        text,
        targetLang: outgoingLang,
      });
      if (!res.ok || !('text' in res)) {
        onToast(!res.ok ? res.error : '翻译失败');
        return;
      }
      setPreview(res.text);
    } catch {
      onToast('翻译请求失败，请检查网络与接口配置');
    } finally {
      setBusy(false);
    }
  }

  async function replaceInput() {
    if (!preview.trim()) return;
    const result = await setComposeText(preview.trim());
    if (result === 'clipboard') {
      onToast('已复制译文，请在输入框粘贴');
    } else if (result === 'fail') {
      onToast('无法写入输入框');
    } else {
      onToast('已替换输入框，请确认后发送');
      setPreview('');
    }
  }

  return (
    <div className="wm-compose">
      <div className="wm-translate-summary">
        <span className="wm-section-kicker">翻译目标</span>
        <strong>{language}</strong>
        <span>译文只替换输入框，不会自动发送</span>
      </div>

      <label className="wm-field wm-field-stack">
        <span className="wm-field-title">
          <b>原文</b>
          <button type="button" className="wm-text-action" onClick={readCompose}>重新读取</button>
        </span>
        <textarea
          className="wm-textarea wm-source-input"
          rows={6}
          placeholder="先在 WhatsApp 输入内容，或直接在这里输入…"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setPreview('');
          }}
        />
      </label>

      <button type="button" className="wm-btn wm-btn-block" disabled={busy} onClick={() => void translateInput()}>
        {busy ? '正在翻译…' : `翻译成${language}`}
      </button>

      {preview ? (
        <div className="wm-translation-result">
          <div className="wm-result-head">
            <span><i aria-hidden="true" /> 译文已生成</span>
            <span>{preview.length} 字符</span>
          </div>
          <textarea
            className="wm-textarea wm-result-text"
            rows={7}
            value={preview}
            onChange={(event) => setPreview(event.target.value)}
          />
          <div className="wm-result-actions">
            <button type="button" className="wm-btn ghost" onClick={() => setPreview('')}>清除</button>
            <button type="button" className="wm-btn" onClick={() => void replaceInput()}>替换 WhatsApp 输入框</button>
          </div>
        </div>
      ) : (
        <div className="wm-empty-state wm-empty-compact">
          <span aria-hidden="true">文</span>
          <p><strong>译文将在这里预览</strong><small>确认无误后再替换到输入框</small></p>
        </div>
      )}
    </div>
  );
}
