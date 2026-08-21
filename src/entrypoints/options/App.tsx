import { useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from '~/lib/langs';
import { sendExtension } from '~/lib/messaging';
import { downloadAsFile, exportData, importData } from '~/lib/import-export';
import {
  getProvider,
  getProviderSeedSettings,
  normalizeProviderId,
  PROVIDERS,
} from '~/lib/providers';
import type { AppState, QuickReply, TagDef } from '~/lib/types';
import { DEFAULT_STATE } from '~/lib/types';

export default function App() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [revealSecret, setRevealSecret] = useState(false);

  const provider = useMemo(
    () => getProvider(state.settings.providerId),
    [state.settings.providerId],
  );
  const credentialConfigured =
    state.settings.authMode === 'projectKey'
      ? Boolean(state.settings.projectKey.trim())
      : Boolean(state.settings.apiKey.trim());

  useEffect(() => {
    void sendExtension({ type: 'WAMOFA_GET_PRIVATE' })
      .then((res) => {
        if (res.ok && 'privateState' in res) {
          const normalizedId = normalizeProviderId(res.privateState.settings.providerId);
          if (normalizedId !== res.privateState.settings.providerId) {
            const defaults = getProviderSeedSettings(normalizedId);
            setState({
              ...res.privateState,
              settings: {
                ...res.privateState.settings,
                ...defaults,
              },
            });
          } else {
            setState(res.privateState);
          }
        } else if (!res.ok) {
          setStatus(res.error);
        }
      })
      .catch(() => setStatus('读取配置失败，已显示默认设置'))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(''), 3600);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function save(next: AppState, message = '已保存') {
    setState(next);
    try {
      const res = await sendExtension({ type: 'WAMOFA_SAVE_PRIVATE', state: next });
      if (!res.ok) {
        setStatus(res.error);
        return;
      }
      setStatus(message);
    } catch {
      setStatus('保存失败，请重试');
    }
  }

  function applyProvider(id: string) {
    const defaults = getProviderSeedSettings(id);
    void save({
      ...state,
      settings: {
        ...state.settings,
        ...defaults,
      },
    });
  }

  async function test() {
    setTesting(true);
    try {
      const persist = await sendExtension({ type: 'WAMOFA_SAVE_PRIVATE', state });
      if (!persist.ok) {
        setStatus(persist.error);
        return;
      }
      const res = await sendExtension({ type: 'WAMOFA_TEST' });
      setStatus(res.ok && 'text' in res ? `连接成功：${res.text}` : res.ok ? '连接成功' : res.error);
    } catch {
      setStatus('连接测试失败，请检查网络与接口配置');
    } finally {
      setTesting(false);
    }
  }

  async function handleExport() {
    try {
      const json = await exportData();
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadAsFile(json, `wamofa-backup-${timestamp}.json`);
      setStatus('数据已导出');
    } catch {
      setStatus('导出失败');
    }
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const result = await importData(text);
        setStatus(result.message);
        if (result.success) {
          // 刷新状态
          const res = await sendExtension({ type: 'WAMOFA_GET_PRIVATE' });
          if (res.ok && 'privateState' in res) {
            setState(res.privateState);
          }
        }
      } catch {
        setStatus('读取文件失败');
      }
    };
    input.click();
  }

  if (!loaded) {
    return (
      <div className="settings-loading">
        <span className="settings-loader" aria-hidden="true" />
        <strong>正在读取本地工作台</strong>
        <small>所有配置只保存在这台浏览器</small>
      </div>
    );
  }

  return (
    <div className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-brand">
          <span className="settings-brand-mark">W</span>
          <div>
            <strong>WAMofa</strong>
            <small>Local workspace</small>
          </div>
        </div>
        <nav className="settings-nav" aria-label="设置导航">
          <a href="#ai"><span>01</span>AI 接口</a>
          <a href="#language"><span>02</span>语言与习惯</a>
          <a href="#replies"><span>03</span>快捷回复</a>
          <a href="#tags"><span>04</span>客户标签</a>
          <a href="#data"><span>05</span>数据管理</a>
        </nav>
        <div className="settings-local-note">
          <i aria-hidden="true" />
          <div><strong>本机私密存储</strong><small>Key 与客户资料不会经过 WAMofa 服务器</small></div>
        </div>
      </aside>

      <main className="settings-main">
        <header className="settings-hero">
          <div>
            <span className="settings-eyebrow">Workspace settings</span>
            <h1>工作台设置</h1>
            <p>把翻译、客户资料与常用话术调整成最顺手的工作方式。</p>
          </div>
          <button
            type="button"
            className="hero-action"
            onClick={() => browser.tabs.create({ url: 'https://web.whatsapp.com/' })}
          >
            打开 WhatsApp Web <span aria-hidden="true">↗</span>
          </button>
        </header>

        <div className="settings-overview" aria-label="配置概览">
          <div className="overview-card">
            <span className={`overview-icon ${credentialConfigured ? 'is-ready' : ''}`}>AI</span>
            <div><small>AI 连接</small><strong>{credentialConfigured ? '凭据已配置' : '等待配置'}</strong></div>
          </div>
          <div className="overview-card">
            <span className="overview-icon">话</span>
            <div><small>快捷回复</small><strong>{state.templates.length} 条话术</strong></div>
          </div>
          <div className="overview-card">
            <span className="overview-icon">客</span>
            <div><small>本地客户档案</small><strong>{Object.keys(state.chats).length} 位客户</strong></div>
          </div>
        </div>

      <Section id="ai" kicker="Connection" title="AI 接口" description="配置翻译与语音转写所使用的服务商。">
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
          <p className="text-xs text-amber-700">该厂商仅文本翻译，语音转写请改用 OpenAI。</p>
        ) : null}
        <label className="grid gap-1 text-sm">
          鉴权方式
          <select
            className="field"
            value={state.settings.authMode}
            onChange={(event) =>
              void save({
                ...state,
                settings: {
                  ...state.settings,
                  authMode: event.target.value as 'apiKey' | 'projectKey',
                },
              })
            }
          >
            <option value="apiKey">API Key</option>
            <option value="projectKey">Project Key（Sub2API/NewAPI）</option>
          </select>
        </label>
        {state.settings.authMode === 'projectKey' ? (
          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded text-xs">
            <strong className="block mb-1">🔑 Project Key 模式配置提示</strong>
            <p className="text-muted mb-2">
              适用于 Sub2API、NewAPI 等中转服务。常见配置：
            </p>
            <ul className="list-disc list-inside text-muted space-y-1">
              <li>Base URL 必须以 <code className="bg-white dark:bg-gray-800 px-1 rounded">/v1</code> 结尾（如 <code className="bg-white dark:bg-gray-800 px-1 rounded">https://api.example.com/v1</code>）</li>
              <li>Header 名称通常是 <code className="bg-white dark:bg-gray-800 px-1 rounded">Authorization</code></li>
              <li>格式通常选 <code className="bg-white dark:bg-gray-800 px-1 rounded">Bearer &lt;ProjectKey&gt;</code></li>
              <li>部分服务使用原始值（Raw token），请参考服务商文档</li>
            </ul>
            <p className="text-amber-700 dark:text-amber-400 mt-2">
              ⚠️ 如果测试连接返回 HTML 错误，请检查 Base URL 和鉴权配置
            </p>
          </div>
        ) : null}
        {state.settings.authMode === 'projectKey' ? (
          <>
            <label className="grid gap-1 text-sm">
              Header 名称
              <input
                className="field"
                value={state.settings.projectKeyHeader}
                onChange={(event) =>
                  setState({
                    ...state,
                    settings: { ...state.settings, projectKeyHeader: event.target.value },
                  })
                }
                onBlur={() => void save(state)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              格式
              <select
                className="field"
                value={state.settings.projectKeyScheme}
                onChange={(event) =>
                  setState({
                    ...state,
                    settings: {
                      ...state.settings,
                      projectKeyScheme: event.target.value as 'bearer' | 'raw',
                    },
                  })
                }
                onBlur={() => void save(state)}
              >
                <option value="bearer">Bearer &lt;ProjectKey&gt;</option>
                <option value="raw">直接传入（原始值）</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="grid gap-1 text-sm">
          {state.settings.authMode === 'projectKey' ? 'Project Key' : 'API Key'}
          <span className="secret-field">
            <input
              className="field"
              type={revealSecret ? 'text' : 'password'}
              autoComplete="off"
              value={
                state.settings.authMode === 'projectKey'
                  ? state.settings.projectKey
                  : state.settings.apiKey
              }
              onChange={(event) =>
                setState({
                  ...state,
                  settings:
                    state.settings.authMode === 'projectKey'
                      ? { ...state.settings, projectKey: event.target.value }
                      : { ...state.settings, apiKey: event.target.value },
                })
              }
              onBlur={() => void save(state)}
            />
            <button type="button" onClick={() => setRevealSecret((value) => !value)}>
              {revealSecret ? '隐藏' : '显示'}
            </button>
          </span>
        </label>
        {state.settings.authMode === 'projectKey' ? (
          <p className="text-xs text-muted">
            Sub2API/NewAPI 常见配置：Header 用 <code>Authorization</code>，格式默认 <code>Bearer &lt;ProjectKey&gt;</code>。
          </p>
        ) : null}
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

      <Section id="language" kicker="Preferences" title="语言与习惯" description="设置全局默认值，仍可在每个会话中单独覆盖。">
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

      <Section id="replies" kicker="Productivity" title="快捷回复" description="维护可在侧边工作台中一键插入的话术。">
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

      <Section id="tags" kicker="Customer data" title="客户标签" description="用颜色与名称建立自己的轻量客户分类。">
        <div className="grid gap-2">
          {state.tagPalette.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${tag.name} 标签颜色`}
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
                aria-label="标签名称"
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

      <Section id="data" kicker="Backup" title="数据管理" description="导出备份或导入客户资料、快捷回复等数据。">
        <div className="grid gap-3">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
            <strong className="block mb-1">💾 数据本地存储</strong>
            <p className="text-muted">
              所有客户备注、标签、快捷回复均存储在本机浏览器，不上传云端。
              导出数据后可在其他设备导入，或作为备份使用。
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn"
              onClick={() => void handleExport()}
            >
              📥 导出数据
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => void handleImport()}
            >
              📤 导入数据
            </button>
          </div>
          <p className="text-xs text-muted">
            导出的 JSON 文件包含客户档案、快捷回复、标签配置，但不包含 API Key。
          </p>
        </div>
      </Section>

      {status ? <p className="settings-toast" role="status">{status}</p> : null}

      <p className="settings-footer">
        WAMofa 是独立开源项目，与 WhatsApp 官方无关联。不提供群发、自动回复或云同步。
        项目主页：
        <a className="text-brand" href="https://wamofa.com" target="_blank" rel="noreferrer">
          wamofa.com
        </a>
      </p>
      </main>
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  description,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="settings-section">
      <header className="section-heading">
        <span>{kicker}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="section-content">{children}</div>
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
          aria-label="快捷回复标题"
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
        aria-label="快捷回复内容"
        value={item.body}
        onChange={(event) => onChange({ body: event.target.value })}
        onBlur={onSave}
      />
    </div>
  );
}
