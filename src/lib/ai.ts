import { langLabel } from '~/lib/langs';
import { getProvider } from '~/lib/providers';
import type { AiSettings } from '~/lib/types';

const TIMEOUT_TEXT_MS = 45_000;
const TIMEOUT_MODELS_MS = 30_000;
const TIMEOUT_TRANSCRIBE_MS = 120_000;

/**
 * fetch 没有默认超时。接口挂起时翻译按钮会永远停在「…」且被禁用，
 * 用户只能刷新页面，所以这里统一加中断控制。
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒），请检查网络或接口地址`);
    }
    throw new Error(
      error instanceof Error ? `网络请求失败：${error.message}` : '网络请求失败',
    );
  } finally {
    clearTimeout(timer);
  }
}

function joinUrl(base: string, path: string): string {
  const baseParts = base.trim().replace(/\/+$/, '').split('/');
  const pathParts = path.trim().replace(/^\/+|\/+$/g, '').split('/');
  let overlap = Math.min(baseParts.length, pathParts.length);

  while (overlap > 0) {
    const baseSuffix = baseParts.slice(-overlap).join('/').toLowerCase();
    const pathPrefix = pathParts.slice(0, overlap).join('/').toLowerCase();
    if (baseSuffix === pathPrefix) break;
    overlap -= 1;
  }

  return [...baseParts, ...pathParts.slice(overlap)].join('/');
}

function providerUrl(settings: AiSettings, path: string): string {
  const provider = getProvider(settings.providerId);
  let base = settings.baseUrl.trim().replace(/\/+$/, '');

  // 自定义接口允许直接填写完整聊天端点；访问同级 models/转写端点时先退回 API 根路径。
  if (path !== provider.chatPath) {
    const chatSuffix = `/${provider.chatPath.replace(/^\/+|\/+$/g, '')}`;
    if (base.toLowerCase().endsWith(chatSuffix.toLowerCase())) {
      base = base.slice(0, -chatSuffix.length);
    }
  }

  return joinUrl(base, path);
}

function usesProjectKey(settings: AiSettings): boolean {
  const provider = getProvider(settings.providerId);
  const authMode = provider.configurableAuth
    ? settings.authMode
    : provider.preferredAuthMode ?? 'apiKey';
  return authMode === 'projectKey';
}

function requireCredential(settings: AiSettings): void {
  if (usesProjectKey(settings)) {
    if (!settings.projectKey.trim()) {
      throw new Error('请先在选项页填写网关 / Project Key');
    }
  } else if (!settings.apiKey.trim()) {
    throw new Error('请先在选项页填写 API Key');
  }
  if (!settings.baseUrl.trim()) {
    throw new Error('请填写 Base URL');
  }
}

function requireTextSettings(settings: AiSettings): void {
  requireCredential(settings);
  if (!settings.model.trim()) {
    throw new Error('请填写文本模型名，或先读取接口模型列表');
  }
}

function credentialValue(token: string, scheme: 'bearer' | 'raw'): string {
  return scheme === 'raw' ? token : `Bearer ${token}`;
}

function buildAuthHeaders(settings: AiSettings, forForm = false): HeadersInit {
  const provider = getProvider(settings.providerId);
  const headers: Record<string, string> = {};
  if (!forForm) {
    headers['Content-Type'] = 'application/json';
  }

  if (usesProjectKey(settings)) {
    const token = settings.projectKey.trim();
    const headerName = (settings.projectKeyHeader || 'Authorization').trim();
    headers[headerName] = credentialValue(token, settings.projectKeyScheme);
  } else {
    const token = settings.apiKey.trim();
    const headerName = provider.apiKeyHeader ?? 'Authorization';
    const scheme = provider.apiKeyScheme ?? 'bearer';
    headers[headerName] = credentialValue(token, scheme);
  }

  if (provider.chatProtocol === 'anthropic-messages') {
    headers['anthropic-version'] = '2023-06-01';
  }

  return headers;
}

function compactErrorBody(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  try {
    const data = JSON.parse(text) as {
      error?: string | { message?: string; type?: string };
      message?: string;
      detail?: string;
    };
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return data.error.message;
    return data.message ?? data.detail ?? text.replace(/\s+/g, ' ').slice(0, 300);
  } catch {
    return text.replace(/\s+/g, ' ').slice(0, 300);
  }
}

async function readJson(res: Response): Promise<unknown> {
  const raw = await res.text();
  if (!res.ok) {
    const detail = compactErrorBody(raw);
    const html = (res.headers.get('content-type') ?? '').includes('text/html') || /^\s*</.test(raw);
    if (html) {
      throw new Error(
        `HTTP ${res.status}: API 返回网页而不是 JSON。请检查 Base URL、接口版本路径和鉴权方式。`,
      );
    }
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const contentType = res.headers.get('content-type') || '未知类型';
    throw new Error(`API 返回无法解析的响应（${contentType}），请确认它兼容所选供应商协议。`);
  }
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!Array.isArray(value)) return '';
  return value
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const record = part as { text?: unknown; content?: unknown };
      if (typeof record.text === 'string') return record.text;
      if (typeof record.content === 'string') return record.content;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function translationFromResponse(data: unknown, protocol: 'openai-chat' | 'anthropic-messages'): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as {
    choices?: Array<{ message?: { content?: unknown; refusal?: string } }>;
    content?: unknown;
    output_text?: string;
  };
  if (protocol === 'anthropic-messages') {
    return contentText(record.content);
  }
  return contentText(record.choices?.[0]?.message?.content) || record.output_text?.trim() || '';
}

function translatorPrompt(target: string): string {
  return (
    `You are a translator. Translate the user's message into ${target}. ` +
    'Return only the translation, with no quotes, labels, or explanation. ' +
    'If the text is already in the target language, return it unchanged. ' +
    'Preserve names, numbers, emojis, and line breaks. ' +
    'Use natural conversational phrasing for chat context (including negotiation tone) while preserving the original meaning and intent.'
  );
}

export async function translateText(
  settings: AiSettings,
  text: string,
  targetLang: string,
): Promise<string> {
  requireTextSettings(settings);
  const provider = getProvider(settings.providerId);
  const system = translatorPrompt(langLabel(targetLang));
  const body =
    provider.chatProtocol === 'anthropic-messages'
      ? {
          model: settings.model.trim(),
          max_tokens: 2048,
          system,
          messages: [{ role: 'user', content: text }],
          stream: false,
        }
      : {
          model: settings.model.trim(),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: text },
          ],
          stream: false,
        };

  try {
    const res = await fetchWithTimeout(
      providerUrl(settings, provider.chatPath),
      {
        method: 'POST',
        headers: buildAuthHeaders(settings),
        body: JSON.stringify(body),
      },
      TIMEOUT_TEXT_MS,
    );
    const data = await readJson(res);
    const content = translationFromResponse(data, provider.chatProtocol);
    if (!content) {
      throw new Error('模型没有返回可识别的译文');
    }
    return content;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(`翻译失败：${String(error)}`);
  }
}

function modelId(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const record = item as { id?: unknown; slug?: unknown; name?: unknown };
  const value = [record.id, record.slug, record.name].find((entry) => typeof entry === 'string');
  return typeof value === 'string' ? value.replace(/^models\//, '').trim() : '';
}

export async function listModels(settings: AiSettings): Promise<string[]> {
  requireCredential(settings);
  const provider = getProvider(settings.providerId);
  if (!provider.modelsPath) {
    return provider.modelOptions ?? [];
  }

  const res = await fetchWithTimeout(
    providerUrl(settings, provider.modelsPath),
    {
      method: 'GET',
      headers: buildAuthHeaders(settings, true),
    },
    TIMEOUT_MODELS_MS,
  );
  const data = (await readJson(res)) as { data?: unknown[]; models?: unknown[] };
  const source = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
  const models = [...new Set(source.map(modelId).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (!models.length) {
    throw new Error('接口没有返回可识别的模型列表，请手动填写分组中配置的模型名');
  }
  return models;
}

export async function transcribeAudio(
  settings: AiSettings,
  payload: { mime: string; dataBase64: string; fileName?: string },
): Promise<string> {
  requireCredential(settings);
  const provider = getProvider(settings.providerId);
  if (!provider.supportsTranscribe || !provider.transcribePath || !provider.transcribeProtocol) {
    throw new Error(`${provider.name} 没有配置可用的语音转写接口`);
  }

  const model = settings.transcribeModel.trim();
  if (provider.transcribeModelRequired !== false && !model) {
    throw new Error('请填写语音转写模型名');
  }

  const binary = Uint8Array.from(atob(payload.dataBase64), (ch) => ch.charCodeAt(0));
  const mime = payload.mime || 'application/octet-stream';
  const ext = mime.includes('mpeg') || mime.includes('mp3')
    ? 'mp3'
    : mime.includes('wav')
      ? 'wav'
      : mime.includes('webm')
        ? 'webm'
        : 'ogg';
  const form = new FormData();

  if (provider.transcribeProtocol === 'openai-transcriptions') {
    form.append('model', model);
    form.append('response_format', 'json');
  }
  // xAI 要求 file 是 multipart 中的最后一个字段。
  form.append(
    'file',
    new Blob([binary], { type: mime }),
    payload.fileName ?? `audio.${ext}`,
  );

  const res = await fetchWithTimeout(
    providerUrl(settings, provider.transcribePath),
    {
      method: 'POST',
      headers: buildAuthHeaders(settings, true),
      body: form,
    },
    TIMEOUT_TRANSCRIBE_MS,
  );
  const data = (await readJson(res)) as { text?: string };
  const result = data.text?.trim();
  if (!result) {
    throw new Error('没有识别到语音内容');
  }
  return result;
}

export async function testConnection(settings: AiSettings): Promise<string> {
  return translateText(settings, 'hello', settings.incomingLang || 'zh');
}
