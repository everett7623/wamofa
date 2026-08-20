import { useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from '~/lib/langs';
import { sendExtension } from '~/lib/messaging';
import { getProvider, PROVIDERS } from '~/lib/providers';
import type { AppState, QuickReply, TagDef } from '~/lib/types';
import { DEFAULT_STATE } from '~/lib/types';

export default function App() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);

  const provider = useMemo(
    () => getProvider(state.settings.providerId),
    [state.settings.providerId],
  );

  useEffect(() => {
    void sendExtension({ type: 'WAMOFA_GET_PRIVATE' }).then((res) => {
      if (res.ok && 'privateState' in res) setState(res.privateState);
      setLoaded(true);
    });
  }, []);

  async function save(next: AppState, message = '已保存') {
    setState(next);
    const res = await sendExtension({ type: 'WAMOFA_SAVE_PRIVATE', state: next });
    if (!res.ok) {
      setStatus(res.error);
      return;
    }
    if ('privateState' in res) setState(res.privateState);
    setStatus(message);
  }

  function applyProvider(id: string) {
    const preset = getProvider(id);
    void save({
      ...state,
      settings: {
        ...state.settings,
        providerId: id,
        baseUrl: preset.baseUrl || state.settings.baseUrl,
        model: preset.model || state.settings.model,
        transcribeModel: preset.transcribeModel,
      },
    });
  }

  async function test() {
    setTesting(true);
    const persist = await sendExtension({ type: 'WAMOFA_SAVE_PRIVATE', state });
    if (!persist.ok) {
      setStatus(persist.error);
      setTesting(false);
      return;
    }
    const res = await sendExtension({ type: 'WAMOFA_TEST' });
    setTesting(false);
    setStatus(res.ok && 'text' in res ? `连接成功：${res.text}` : res.ok ? '连接成功' : res.error);
  }

  if (!loaded) {
    return <div className="p-8 text-sm text-muted">读取本地配置…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">WAMofa 选项</h1>
        <p className="mt-1 text-sm text-muted">
          Key 只存在这台浏览器。请求从扩展后台直连你选的服务商，不经过我们的服务器。
        </p>
      </header>

      <Section title="AI 接口">
        <label className="grid gap-1 text-sm">
          服务商
          <select
            className="field"
            value={state.settings.providerId}
            onChange={(event) => applyProvider(event.target.value)}
          >
            {PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">{provider.hint}</p>
        {!provider.supportsTranscribe ? (
          <p className="text-xs text-amber-700">该厂商仅文本翻译，语音转写请改用 OpenAI、Groq 或硅基流动。</p>
        ) : null}
        <label className="grid gap-1 text-sm">
          API Key
          <input
            className="field"
            type="password"
            autoComplete="off"
            value={state.settings.apiKey}
            onChange={(event) =>
              setState({
                ...state,
                settings: { ...state.settings, apiKey: event.target.value },
              })
            }
            onBlur={() => void save(state)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Base URL
          <input
            className="field"
            value={state.settings.baseUrl}
            onChange={(event) =>
              setState({
                ...state,
                settings: { ...state.settings, baseUrl: event.target.value },
              })
            }
            onBlur={() => void save(state)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            文本模型
            <input
              className="field"
              value={state.settings.model}
              onChange={(event) =>
                setState({
                  ...state,
                  settings: { ...state.settings, model: event.target.value },
                })
              }
              onBlur={() => void save(state)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            转写模型
            <input
              className="field"
              value={state.settings.transcribeModel}
              placeholder={provider.supportsTranscribe ? 'whisper / sensevoice' : '不支持'}
              onChange={(event) =>
                setState({
                  ...state,
                  settings: { ...state.settings, transcribeModel: event.target.value },
                })
              }
              onBlur={() => void save(state)}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" disabled={testing} onClick={() => void test()}>
            {testing ? '测试中…' : '测试翻译 hello'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => void save(state)}>
            保存
          </button>
        </div>
      </Section>

      <Section title="语言与习惯">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            来消息译成
            <select
              className="field"
              value={state.settings.incomingLang}
              onChange={(event) =>
                void save({
                  ...state,
                  settings: { ...state.settings, incomingLang: event.target.value },
                })
              }
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            默认发出语言
            <select
              className="field"
              value={state.settings.outgoingLang}
              onChange={(event) =>
                void save({
                  ...state,
                  settings: { ...state.settings, outgoingLang: event.target.value },
                })
              }
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            默认国家区号
            <input
              className="field"
              value={state.settings.defaultCountryCode}
              onChange={(event) =>
                setState({
                  ...state,
                  settings: { ...state.settings, defaultCountryCode: event.target.value },
                })
              }
              onBlur={() => void save(state)}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.settings.autoTranslateIncoming}
            onChange={(event) =>
              void save({
                ...state,
                settings: { ...state.settings, autoTranslateIncoming: event.target.checked },
              })
            }
          />
          默认自动翻译来消息（每个会话仍可单独关）
        </label>
      </Section>

      <Section title="快捷回复">
        <div className="grid gap-3">
          {state.templates.map((item, index) => (
            <TemplateRow
              key={item.id}
              item={item}
              onChange={(patch) => {
                const templates = state.templates.map((row, i) =>
                  i === index ? { ...row, ...patch } : row,
                );
                setState({ ...state, templates });
              }}
              onSave={() => void save(state)}
              onRemove={() =>
                void save({
                  ...state,
                  templates: state.templates.filter((row) => row.id !== item.id),
                })
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            void save({
              ...state,
              templates: [
                ...state.templates,
                { id: crypto.randomUUID(), title: '新模板', body: '' },
              ],
            })
          }
        >
          添加模板
        </button>
      </Section>

      <Section title="标签">
        <div className="grid gap-2">
          {state.tagPalette.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2">
              <input
                type="color"
                value={tag.color}
                onChange={(event) => {
                  const tagPalette = state.tagPalette.map((row) =>
                    row.id === tag.id ? { ...row, color: event.target.value } : row,
                  );
                  void save({ ...state, tagPalette });
                }}
              />
              <input
                className="field flex-1"
                value={tag.name}
                onChange={(event) => {
                  const tagPalette = state.tagPalette.map((row) =>
                    row.id === tag.id ? { ...row, name: event.target.value } : row,
                  );
                  setState({ ...state, tagPalette });
                }}
                onBlur={() => void save(state)}
              />
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() =>
                  void save({
                    ...state,
                    tagPalette: state.tagPalette.filter((row) => row.id !== tag.id),
                  })
                }
              >
                删除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            void save({
              ...state,
              tagPalette: [
                ...state.tagPalette,
                { id: crypto.randomUUID(), name: '新标签', color: '#1b9e77' } satisfies TagDef,
              ],
            })
          }
        >
          添加标签
        </button>
      </Section>

      {status ? <p className="mt-4 text-sm text-brand">{status}</p> : null}

      <p className="mt-8 text-xs leading-5 text-muted">
        WAMofa 是独立开源项目，与 WhatsApp、Meta、WhatFa 均无关联。不提供群发、自动回复或云同步。
        官网占位：
        <a className="text-brand" href="https://wamofa.com" target="_blank" rel="noreferrer">
          wamofa.com
        </a>
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-xl border border-line bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function TemplateRow({
  item,
  onChange,
  onSave,
  onRemove,
}: {
  item: QuickReply;
  onChange: (patch: Partial<QuickReply>) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-line p-3">
      <div className="flex gap-2">
        <input
          className="field flex-1"
          value={item.title}
          onChange={(event) => onChange({ title: event.target.value })}
          onBlur={onSave}
        />
        <button type="button" className="text-xs text-danger" onClick={onRemove}>
          删除
        </button>
      </div>
      <textarea
        className="field min-h-20"
        value={item.body}
        onChange={(event) => onChange({ body: event.target.value })}
        onBlur={onSave}
      />
    </div>
  );
}
