import { useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from '~/lib/langs';
import { getPhoneInsights } from '~/lib/phone-insights';
import { sendExtension } from '~/lib/messaging';
import type { ChatMeta, PublicState } from '~/lib/types';
import { emptyChatMeta } from '~/lib/types';

interface Props {
  chatId: string;
  title: string;
  headerPhone: string | null;
  dark: boolean;
  state: PublicState;
  onState: (state: PublicState) => void;
}

export function HeaderBar({ chatId, title, headerPhone, dark, state, onState }: Props) {
  const meta = state.chats[chatId] ?? emptyChatMeta();
  const auto = meta.autoTranslate ?? state.settings.autoTranslateIncoming;
  const outgoingLang = meta.outgoingLang ?? state.settings.outgoingLang;
  const [note, setNote] = useState(meta.note);
  const [hint, setHint] = useState('');
  const [nowTick, setNowTick] = useState(0);
  const [editingPhone, setEditingPhone] = useState(false);
  const [manualPhone, setManualPhone] = useState(meta.manualPhone || '');

  useEffect(() => {
    setNote(meta.note);
    setManualPhone(meta.manualPhone || '');
    setEditingPhone(false);
  }, [chatId, meta.note, meta.manualPhone]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((n) => n + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = useMemo(() => new Set(meta.tagIds), [meta.tagIds]);
  const phoneInsights = useMemo(
    () => getPhoneInsights({ chatId, title, headerPhone, manualPhone: meta.manualPhone }),
    [chatId, title, headerPhone, meta.manualPhone, nowTick],
  );

  async function saveChat(patch: Partial<ChatMeta>) {
    const nextMeta = { ...(state.chats[chatId] ?? emptyChatMeta()), ...patch };
    onState({
      ...state,
      chats: { ...state.chats, [chatId]: nextMeta },
    });
    try {
      const res = await sendExtension({
        type: 'WAMOFA_UPSERT_CHAT',
        chatId,
        patch,
      });
      if (res.ok && 'state' in res) onState(res.state);
      if (!res.ok) setHint(res.error);
    } catch {
      setHint('保存失败，请重试');
    }
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

  async function saveManualPhone() {
    const cleaned = manualPhone.trim().replace(/\D/g, '');
    if (cleaned && cleaned.length >= 4) {
      await saveChat({ manualPhone: cleaned });
      setEditingPhone(false);
      setHint('号码已保存');
      window.setTimeout(() => setHint(''), 1200);
    } else if (!cleaned) {
      await saveChat({ manualPhone: '' });
      setEditingPhone(false);
      setHint('号码已清除');
      window.setTimeout(() => setHint(''), 1200);
    } else {
      setHint('号码格式不正确');
      window.setTimeout(() => setHint(''), 2000);
    }
  }

  return (
    <div className={`wm-bar ${dark ? 'is-dark' : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className="wm-contact-card">
        <div className="wm-contact-avatar" aria-hidden="true">
          {(title.trim()[0] || '客').toUpperCase()}
        </div>
        <div className="wm-contact-main">
          <strong className="wm-contact-name">{title || '当前客户'}</strong>
          {editingPhone ? (
            <div className="wm-phone-edit">
              <input
                type="tel"
                className="wm-input wm-input-sm"
                placeholder="输入完整号码（含国家码）"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void saveManualPhone();
                  } else if (e.key === 'Escape') {
                    setEditingPhone(false);
                    setManualPhone(meta.manualPhone || '');
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className="wm-btn wm-btn-xs"
                onClick={() => void saveManualPhone()}
              >
                保存
              </button>
              <button
                type="button"
                className="wm-btn wm-btn-xs ghost"
                onClick={() => {
                  setEditingPhone(false);
                  setManualPhone(meta.manualPhone || '');
                }}
              >
                取消
              </button>
            </div>
          ) : (
            <span
              className="wm-contact-phone"
              onClick={() => setEditingPhone(true)}
              style={{ cursor: 'pointer' }}
              title="点击手动输入号码"
            >
              {phoneInsights.phone ? `+${phoneInsights.phone}` : '暂未识别号码'}
              <small style={{ marginLeft: '4px', opacity: 0.6 }}>✎</small>
            </span>
          )}
        </div>
        {phoneInsights.workingHint ? (
          <span className={`wm-work-status ${phoneInsights.workingHint.startsWith('工作中') ? 'is-online' : ''}`}>
            {phoneInsights.workingHint.startsWith('工作中') ? '适合联系' : '非工作时间'}
          </span>
        ) : null}
      </div>

      <div className="wm-insight-grid">
        <div className="wm-insight-card">
          <span>所在地区</span>
          <strong>{phoneInsights.countryEn || phoneInsights.country || '待识别'}</strong>
        </div>
        <div className="wm-insight-card">
          <span>当地时间</span>
          <strong>{phoneInsights.localTime || '时区待识别'}</strong>
        </div>
      </div>
      {!phoneInsights.available ? (
        <p className="wm-inline-hint">{phoneInsights.fallbackText}</p>
      ) : (
        <p className={`wm-inline-hint ${phoneInsights.hasRealPhone ? 'is-verified' : 'is-estimated'}`}>
          {phoneInsights.hasRealPhone
            ? `已读取联系人号码 · 按${phoneInsights.regionSourceLabel}识别 · ${phoneInsights.timezone || '时区待识别'}`
            : `暂未读取号码 · 按${phoneInsights.regionSourceLabel}推断 · ${phoneInsights.timezone || '时区待识别'}`}
        </p>
      )}

      <section className="wm-card-section">
        <div className="wm-section-heading">
          <div>
            <span className="wm-section-kicker">自动化</span>
            <strong>会话语言</strong>
          </div>
        </div>
        <label className="wm-switch-row">
          <span>
            <strong>自动翻译来消息</strong>
            <small>仅对当前客户生效</small>
          </span>
          <input
            type="checkbox"
            checked={auto}
            onChange={(event) => void saveChat({ autoTranslate: event.target.checked })}
          />
          <i aria-hidden="true" />
        </label>
        <label className="wm-field wm-field-stack">
          <span>默认发出语言</span>
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
      </section>

      <section className="wm-card-section">
        <div className="wm-section-heading">
          <div>
            <span className="wm-section-kicker">客户管理</span>
            <strong>标签与备注</strong>
          </div>
          {hint ? <span className="wm-hint" role="status">{hint}</span> : null}
        </div>
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
        <label className="wm-field wm-field-stack">
          <span>本地备注</span>
          <textarea
            className="wm-note"
            placeholder="记录需求、跟进事项或客户偏好…"
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => void persistNote()}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void persistNote();
              }
            }}
          />
        </label>
        <button type="button" className="wm-btn wm-btn-block" onClick={() => void persistNote()}>
          保存客户资料
        </button>
      </section>
    </div>
  );
}
