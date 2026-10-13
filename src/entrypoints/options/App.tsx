import { useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from '~/lib/langs';
import { sendExtension } from '~/lib/messaging';
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
  const [loadingModels, setLoadingModels] = useState(false);
  const [remoteModels, setRemoteModels] = useState<string[]>([]);
  const [manualModel, setManualModel] = useState(false);
  const [manualTranscribeModel, setManualTranscribeModel] = useState(false);
  const [revealSecret, setRevealSecret] = useState(false);

  const provider = useMemo(
    () => getProvider(state.settings.providerId),
    [state.settings.providerId],
  );
  const usesProjectKey =
    provider.preferredAuthMode === 'projectKey' ||
    (provider.configurableAuth && state.settings.authMode === 'projectKey');
  const credentialConfigured =
    usesProjectKey
      ? Boolean(state.settings.projectKey.trim())
      : Boolean(state.settings.apiKey.trim());
  const availableModels = useMemo(
    () => remoteModels.length ? remoteModels : provider.modelOptions ?? [],
    [provider.modelOptions, remoteModels],
  );
  const modelIsListed = availableModels.includes(state.settings.model);
  const showManualModel =
    manualModel || !availableModels.length || !modelIsListed;
  const availableTranscribeModels = provider.transcribeModelOptions ?? [];
  const transcribeModelIsListed = availableTranscribeModels.includes(
    state.settings.transcribeModel,
  );
  const showManualTranscribeModel =
    manualTranscribeModel ||
    !availableTranscribeModels.length ||
    !transcribeModelIsListed;

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

  /**
   * 从最新 state 保存。onBlur 与 onChange 可能落在同一批次里，
   * 直接 save(state) 会拿到本次渲染闭包中的旧值，把刚输入的内容写丢。
   */
  function saveLatest(message?: string) {
    setState((prev) => {
      Promise.resolve().then(() => void save(prev, message));
      return prev;
    });
  }

  function applyProvider(id: string) {
    const defaults = getProviderSeedSettings(id);
    setRemoteModels([]);
    setManualModel(false);
    setManualTranscribeModel(false);
    void save({
      ...state,
      settings: {
        ...state.settings,
        ...defaults,
      },
    });
  }

  async function loadModelList() {
    setLoadingModels(true);
    try {
      const persist = await sendExtension({ type: 'WAMOFA_SAVE_PRIVATE', state });
      if (!persist.ok) {
        setStatus(persist.error);
        return;
      }
      const res = await sendExtension({ type: 'WAMOFA_LIST_MODELS' });
      if (res.ok && 'models' in res) {
        setRemoteModels(res.models);
        setManualModel(!res.models.includes(state.settings.model));
        setStatus(`已读取 ${res.models.length} 个模型，可在下拉菜单中切换`);
      } else if (!res.ok) {
        setStatus(res.error);
      }
    } catch {
      setStatus('读取模型列表失败，请检查 Base URL、Key 和网关分组');
    } finally {
      setLoadingModels(false);
    }
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
        </nav>
        <div className="settings-local-note">
          <i aria-hidden="true" />
          <div><strong>本机私密存储</strong><small>备注、标签、话术与 Key 均只存在当前浏览器，不上传云端</small></div>
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
        {provider.id === 'dots' ? (
          <p className="text-xs text-muted">
            Dots 认证头固定为 <code>api-key</code>，扩展会自动请求 <code>/v1/chat/completions</code>。
          </p>
        ) : null}
        {provider.id === 'sub2api' ? (
          <p className="text-xs text-muted">
            Base URL 可填网关根地址或以 <code>/v1</code> 结尾的地址；默认使用 <code>Authorization: Bearer</code>，并可从 <code>/v1/models</code> 读取该分组可用模型。
          </p>
        ) : null}
        {provider.id === 'zhipu' ? (
          <p className="text-xs text-muted">
            国际站默认 <code>https://api.z.ai/api/paas/v4</code>；国内智谱开放平台改为{' '}
            <code>https://open.bigmodel.cn/api/paas/v4</code>。Coding Plan 用户可改为{' '}
            <code>https://api.z.ai/api/coding/paas/v4</code>。
          </p>
        ) : null}
        {provider.id === 'qwen' ? (
          <p className="text-xs text-muted">
            国内默认 <code>https://dashscope.aliyuncs.com/compatible-mode/v1</code>；国际站改为{' '}
            <code>https://dashscope-intl.aliyuncs.com/compatible-mode/v1</code>。
          </p>
        ) : null}
        {!provider.supportsTranscribe ? (
          <p className="text-xs text-amber-700">该厂商预设仅支持文本翻译；语音转写可改用 OpenAI、Grok 或兼容的自定义接口。</p>
        ) : null}
        {provider.configurableAuth ? (
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
              <option value="apiKey">标准 API Key（使用预设请求头）</option>
              <option value="projectKey">自定义请求头 / Project Key</option>
            </select>
          </label>
        ) : null}
        {provider.configurableAuth && usesProjectKey ? (
          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded text-xs">
            <strong className="block mb-1">🔑 网关 / Project Key 模式</strong>
            <p className="text-muted mb-2">
              适用于 API 中转服务。通常配置：
            </p>
            <ul className="list-disc list-inside text-muted space-y-1">
              <li>Header: <code className="bg-white dark:bg-gray-800 px-1 rounded">Authorization</code></li>
              <li>格式: <code className="bg-white dark:bg-gray-800 px-1 rounded">Bearer &lt;ProjectKey&gt;</code></li>
              <li>Base URL: 填写你的中转服务域名（如 <code className="bg-white dark:bg-gray-800 px-1 rounded">https://api.your-domain.com/v1</code>）</li>
            </ul>
          </div>
        ) : null}
        {provider.configurableAuth && usesProjectKey ? (
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
                onBlur={() => saveLatest()}
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
                onBlur={() => saveLatest()}
              >
                <option value="bearer">Bearer &lt;ProjectKey&gt;</option>
                <option value="raw">直接传入（原始值）</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="grid gap-1 text-sm">
          {usesProjectKey
            ? '网关 / Project Key'
            : provider.id === 'sub2api'
              ? 'Sub2API API Key'
              : `${provider.name} API Key`}
          <span className="secret-field">
            <input
              className="field"
              type={revealSecret ? 'text' : 'password'}
              autoComplete="off"
              value={
                usesProjectKey
                  ? state.settings.projectKey
                  : state.settings.apiKey
              }
              onChange={(event) =>
                setState({
                  ...state,
                  settings:
                    usesProjectKey
                      ? { ...state.settings, projectKey: event.target.value }
                      : { ...state.settings, apiKey: event.target.value },
                })
              }
              onBlur={() => saveLatest()}
            />
            <button type="button" onClick={() => setRevealSecret((value) => !value)}>
              {revealSecret ? '隐藏' : '显示'}
            </button>
          </span>
        </label>
        {provider.id === 'sub2api' && !usesProjectKey ? (
          <p className="text-xs text-muted">
            标准方式使用 <code>Authorization: Bearer &lt;API Key&gt;</code>；也可在上方切换为自定义请求头方式。
          </p>
        ) : null}
        {provider.configurableBaseUrl ? (
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
              onBlur={() => saveLatest()}
            />
          </label>
        ) : (
          <p className="text-xs text-muted">
            官方 API 地址与鉴权方式已内置，只需填写 API Key 并选择模型。
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 text-sm">
            <label className="grid gap-1">
              文本模型
              {availableModels.length ? (
                <select
                  className="field"
                  value={modelIsListed ? state.settings.model : ''}
                  onChange={(event) => {
                    setManualModel(false);
                    void save({
                      ...state,
                      settings: { ...state.settings, model: event.target.value },
                    }, '模型已切换');
                  }}
                >
                  {!modelIsListed ? (
                    <option value="" disabled>
                      {state.settings.model.trim() ? '当前使用手动模型' : '请选择模型'}
                    </option>
                  ) : null}
                  {availableModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : null}
              {showManualModel || !availableModels.length ? (
                <input
                  className="field"
                  value={state.settings.model}
                  placeholder={provider.id === 'sub2api' ? '填写分组模型 ID' : '模型 ID'}
                  onChange={(event) =>
                    setState({
                      ...state,
                      settings: { ...state.settings, model: event.target.value },
                    })
                  }
                  onBlur={() => saveLatest()}
                />
              ) : null}
            </label>
            {availableModels.length && modelIsListed ? (
              <button
                type="button"
                className="btn-ghost justify-self-start"
                onClick={() => setManualModel((value) => !value)}
              >
                {manualModel ? '收起手动输入' : '手动填写其他模型'}
              </button>
            ) : null}
            {provider.modelsPath ? (
              <button
                type="button"
                className="btn-ghost justify-self-start"
                disabled={loadingModels}
                onClick={() => void loadModelList()}
              >
                {loadingModels ? '读取中…' : '读取接口模型'}
              </button>
            ) : null}
          </div>
          <div className="grid gap-1 text-sm">
            <span>转写模型</span>
            {provider.supportsTranscribe &&
            provider.transcribeModelRequired !== false &&
            availableTranscribeModels.length ? (
              <select
                className="field"
                aria-label="转写模型"
                value={transcribeModelIsListed ? state.settings.transcribeModel : ''}
                onChange={(event) => {
                  setManualTranscribeModel(false);
                  void save({
                    ...state,
                    settings: {
                      ...state.settings,
                      transcribeModel: event.target.value,
                    },
                  }, '转写模型已切换');
                }}
              >
                {!transcribeModelIsListed ? (
                  <option value="" disabled>
                    {state.settings.transcribeModel.trim()
                      ? '当前使用手动模型'
                      : '请选择模型'}
                  </option>
                ) : null}
                {availableTranscribeModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            ) : null}
            {!provider.supportsTranscribe ||
            provider.transcribeModelRequired === false ||
            showManualTranscribeModel ? (
              <input
                className="field"
                aria-label="转写模型"
                value={state.settings.transcribeModel}
                disabled={!provider.supportsTranscribe || provider.transcribeModelRequired === false}
                placeholder={
                  !provider.supportsTranscribe
                    ? '不支持'
                    : provider.transcribeModelRequired === false
                      ? '固定 STT 接口，无需模型名'
                      : '转写模型 ID'
                }
                onChange={(event) =>
                  setState({
                    ...state,
                    settings: { ...state.settings, transcribeModel: event.target.value },
                  })
                }
                onBlur={() => saveLatest()}
              />
            ) : null}
            {provider.supportsTranscribe &&
            provider.transcribeModelRequired !== false &&
            availableTranscribeModels.length &&
            transcribeModelIsListed ? (
              <button
                type="button"
                className="btn-ghost justify-self-start"
                onClick={() => setManualTranscribeModel((value) => !value)}
              >
                {manualTranscribeModel ? '收起手动输入' : '手动填写其他模型'}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" disabled={testing} onClick={() => void test()}>
            {testing ? '测试中…' : '测试翻译 hello'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => saveLatest()}>
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
            默认国家区号（仅作开聊输入框示例）
            <input
              className="field"
              value={state.settings.defaultCountryCode}
              onChange={(event) =>
                setState({
                  ...state,
                  settings: { ...state.settings, defaultCountryCode: event.target.value },
                })
              }
              onBlur={() => saveLatest()}
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
                setState((prev) => {
                  const templates = prev.templates.map((row, i) =>
                    i === index ? { ...row, ...patch } : row,
                  );
                  return { ...prev, templates };
                });
              }}
              onSave={() => {
                setState((prev) => {
                  Promise.resolve().then(() => void save(prev));
                  return prev;
                });
              }}
              onRemove={() =>
                setState((prev) => {
                  const next = {
                    ...prev,
                    templates: prev.templates.filter((row) => row.id !== item.id),
                  };
                  void save(next);
                  return next;
                })
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            setState((prev) => {
              const next = {
                ...prev,
                templates: [
                  ...prev.templates,
                  { id: crypto.randomUUID(), title: 'New template', body: 'Type your message…' },
                ],
              };
              // 此前只更新了本地 state，没有落盘，刷新页面新模板就消失了。
              Promise.resolve().then(() => void save(next, '已添加模板'));
              return next;
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
                onBlur={() => saveLatest()}
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

      {status ? <p className="settings-toast" role="status">{status}</p> : null}

      <p className="settings-footer">
        WAMofa 是独立开源项目，与 WhatsApp 官方无关联。不提供群发、自动回复或云同步。
        项目主页：
        <a className="text-brand" href="https://wamofa.com" target="_blank" rel="noreferrer">
          wamofa.com
        </a>
        {' · '}
        <a className="text-brand" href="https://wamofa.com/privacy" target="_blank" rel="noreferrer">
          隐私政策
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
