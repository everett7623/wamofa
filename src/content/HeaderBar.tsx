import { useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from '~/lib/langs';
import { sendExtension } from '~/lib/messaging';
import type { ChatMeta, PublicState } from '~/lib/types';
import { emptyChatMeta } from '~/lib/types';

interface Props {
  chatId: string;
  title: string;
  dark: boolean;
  state: PublicState;
  onState: (state: PublicState) => void;
}

export function HeaderBar({ chatId, title, dark, state, onState }: Props) {
  const meta = state.chats[chatId] ?? emptyChatMeta();
  const auto = meta.autoTranslate ?? state.settings.autoTranslateIncoming;
  const outgoingLang = meta.outgoingLang ?? state.settings.outgoingLang;
  const [note, setNote] = useState(meta.note);
  const [hint, setHint] = useState('');

  useEffect(() => {
    setNote(meta.note);
  }, [chatId, meta.note]);

  const selected = useMemo(() => new Set(meta.tagIds), [meta.tagIds]);

  async function saveChat(patch: Partial<ChatMeta>) {
    const nextMeta = { ...(state.chats[chatId] ?? emptyChatMeta()), ...patch };
    onState({
      ...state,
      chats: { ...state.chats, [chatId]: nextMeta },
    });
    const res = await sendExtension({
      type: 'WAMOFA_UPSERT_CHAT',
      chatId,
      patch,
    });
    if (res.ok && 'state' in res) onState(res.state);
  }

  async function persistNote() {
    await saveChat({ note: note.trim() });
    setHint('备注已保存');
    window.setTimeout(() => setHint(''), 1200);
  }

  async function toggleTag(id: string) {
    const tagIds = selected.has(id)
      ? meta.tagIds.filter((item) => item !== id)
      : [...meta.tagIds, id];
    await saveChat({ tagIds });
  }

  return (
    <div className={`wm-bar ${dark ? 'is-dark' : ''}`}>
      <div className="wm-bar-row">
        <label className="wm-check">
          <input
            type="checkbox"
            checked={auto}
            onChange={(event) => void saveChat({ autoTranslate: event.target.checked })}
          />
          自动翻译来消息
        </label>
        <label className="wm-field">
          发出语言
          <select
            value={outgoingLang}
            onChange={(event) => void saveChat({ outgoingLang: event.target.value })}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
        <span className="wm-title" title={title}>
          {title}
        </span>
      </div>
      <div className="wm-bar-row">
        <input
          className="wm-note"
          placeholder="给这个会话加备注（仅本机）"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => void persistNote()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void persistNote();
            }
          }}
        />
        <div className="wm-tags">
          {state.tagPalette.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`wm-tag ${selected.has(tag.id) ? 'is-on' : ''}`}
              style={{ '--tag': tag.color } as React.CSSProperties}
              onClick={() => void toggleTag(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
        {hint ? <span className="wm-hint">{hint}</span> : null}
      </div>
    </div>
  );
}
