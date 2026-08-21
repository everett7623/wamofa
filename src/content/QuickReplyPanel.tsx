import { useState } from 'react';
import { sendExtension } from '~/lib/messaging';
import type { PublicState, QuickReply } from '~/lib/types';
import { insertComposeText } from '~/wa/compose';

interface Props {
  state: PublicState;
  onState: (state: PublicState) => void;
  onToast: (text: string) => void;
  onClose: () => void;
}

export function QuickReplyPanel({ state, onState, onToast, onClose }: Props) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleTemplates = normalizedQuery
    ? state.templates.filter((item) =>
        `${item.title}\n${item.body}`.toLocaleLowerCase().includes(normalizedQuery),
      )
    : state.templates;

  async function apply(text: string) {
    const result = await insertComposeText(text);
    if (result === 'clipboard') onToast('已复制，请粘贴到输入框');
    else if (result === 'fail') onToast('无法写入输入框');
    else onToast('已插入模板');
    onClose();
  }

  async function persist(templates: QuickReply[]) {
    setSaving(true);
    try {
      const res = await sendExtension({
        type: 'WAMOFA_SAVE_TEMPLATES',
        templates,
      });
      if (!res.ok || !('state' in res)) {
        onToast(!res.ok ? res.error : '保存失败');
        return false;
      }
      onState(res.state);
      return true;
    } catch {
      onToast('保存失败，请重试');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addTemplate() {
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextBody) {
      onToast('请填写标题和内容');
      return;
    }
    const ok = await persist([
      ...state.templates,
      { id: crypto.randomUUID(), title: nextTitle, body: nextBody },
    ]);
    if (!ok) return;
    setTitle('');
    setBody('');
    setAdding(false);
    onToast('模板已添加');
  }

  async function removeTemplate(id: string) {
    const ok = await persist(state.templates.filter((item) => item.id !== id));
    if (ok) onToast('模板已删除');
  }

  return (
    <div className="wm-panel-section">
      <div className="wm-list-toolbar">
        <label className="wm-search-box">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="搜索标题或内容"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="wm-count-badge">{visibleTemplates.length}/{state.templates.length}</span>
      </div>

      {visibleTemplates.length ? (
        <div className="wm-template-list">
          {visibleTemplates.map((item) => (
            <div key={item.id} className="wm-template-row">
              <button
                type="button"
                className="wm-template-item"
                onClick={() => void apply(item.body)}
              >
                <span className="wm-template-title">{item.title}</span>
                <span className="wm-template-body">{item.body}</span>
              </button>
              <button
                type="button"
                className={`wm-template-del ${pendingDelete === item.id ? 'is-confirming' : ''}`}
                title={pendingDelete === item.id ? '再次点击确认删除' : '删除'}
                aria-label={`${pendingDelete === item.id ? '确认删除' : '删除'} ${item.title}`}
                onClick={() => {
                  if (pendingDelete === item.id) {
                    setPendingDelete(null);
                    void removeTemplate(item.id);
                  } else {
                    setPendingDelete(item.id);
                  }
                }}
              >
                {pendingDelete === item.id ? '确认' : '×'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="wm-empty-state">
          <span aria-hidden="true">✦</span>
          <p>
            <strong>{state.templates.length ? '没有匹配的话术' : '还没有快捷回复'}</strong>
            <small>{state.templates.length ? '换个关键词试试' : '添加后可一键插入 WhatsApp 输入框'}</small>
          </p>
        </div>
      )}

      {adding ? (
        <div className="wm-template-form">
          <input
            className="wm-input"
            placeholder="模板标题，例如：报价跟进"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="wm-textarea"
            placeholder="填写需要一键插入的完整话术"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="wm-form-actions">
            <button
              type="button"
              className="wm-btn ghost"
              disabled={saving}
              onClick={() => {
                setAdding(false);
                setTitle('');
                setBody('');
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="wm-btn"
              disabled={saving}
              onClick={() => void addTemplate()}
            >
              {saving ? '保存中…' : '保存模板'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="wm-btn ghost wm-add-template"
          onClick={() => setAdding(true)}
        >
          + 新建快捷回复
        </button>
      )}
    </div>
  );
}
