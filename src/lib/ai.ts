import { langLabel } from '~/lib/langs';
import { getProvider } from '~/lib/providers';
import type { AiSettings } from '~/lib/types';

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function requireSettings(settings: AiSettings): void {
  if (settings.authMode === 'projectKey') {
    if (!settings.projectKey.trim()) {
      throw new Error('请先在选项页填写 Project Key');
    }
  } else if (!settings.apiKey.trim()) {
    throw new Error('请先在选项页填写 API Key');
  }
  if (!settings.baseUrl.trim()) {
    throw new Error('请填写 Base URL');
  }
  if (!settings.model.trim()) {
    throw new Error('请填写文本模型名');
  }
}

function buildAuthHeaders(settings: AiSettings, forForm = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (!forForm) {
    headers['Content-Type'] = 'application/json';
  }

  if (settings.authMode === 'projectKey') {
    const token = settings.projectKey.trim();
    const headerName = (settings.projectKeyHeader || 'Authorization').trim();
    const value =
      settings.projectKeyScheme === 'raw' ? token : `Bearer ${token}`;

    headers[headerName] = value;
  } else {
    // Claude uses x-api-key instead of Authorization
    if (settings.providerId === 'claude') {
      headers['x-api-key'] = settings.apiKey.trim();
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
    }
  }

  return headers;
}

async function readError(res: Response): Promise<string> {
  try {
    const contentType = res.headers.get('content-type') || '';

    // 如果返回 HTML，说明可能是鉴权错误或 URL 错误
    if (contentType.includes('text/html')) {
      return `HTTP ${res.status}: API 返回 HTML 而非 JSON，请检查：
1. Base URL 是否正确（应以 /v1 结尾）
2. ${res.status === 401 || res.status === 403 ? 'API Key 或 Project Key 是否正确' : 'API 端点是否可访问'}
3. 鉴权方式是否匹配（API Key vs Project Key）`;
    }

    const body = await res.text();
    const trimmed = body.replace(/\s+/g, ' ').slice(0, 240);
    return `HTTP ${res.status}${trimmed ? `: ${trimmed}` : ''}`;
  } catch {
    return `HTTP ${res.status}: 无法读取错误信息`;
  }
}

export async function translateText(
  settings: AiSettings,
  text: string,
  targetLang: string,
): Promise<string> {
  requireSettings(settings);
  const target = langLabel(targetLang);

  try {
    const res = await fetch(joinUrl(settings.baseUrl, 'chat/completions'), {
      method: 'POST',
      headers: buildAuthHeaders(settings),
      body: JSON.stringify({
        model: settings.model.trim(),
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              `You are a translator. Translate the user's message into ${target}. ` +
              'Return only the translation, with no quotes, labels, or explanation. ' +
              'If the text is already in the target language, return it unchanged. ' +
              'Preserve names, numbers, emojis, and line breaks. ' +
              'Use natural conversational phrasing for chat context (including negotiation tone) while preserving the original meaning and intent.',
          },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(await readError(res));
    }

    // 检查响应是否为 JSON
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`API 返回非 JSON 格式 (${contentType})，请检查：
1. Base URL 是否正确（应以 /v1 结尾，如 https://api.example.com/v1）
2. 鉴权配置是否正确
3. 服务商是否支持 OpenAI 兼容格式`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('模型没有返回译文');
    }
    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`翻译失败：${String(error)}`);
  }
}

export async function transcribeAudio(
  settings: AiSettings,
  payload: { mime: string; dataBase64: string; fileName?: string },
): Promise<string> {
  requireSettings(settings);
  const provider = getProvider(settings.providerId);
  const model = settings.transcribeModel.trim();
  if (!model) {
    throw new Error(
      provider.supportsTranscribe
        ? '请填写语音转写模型名'
        : `${provider.name} 仅支持文本翻译，请改用 OpenAI 做语音转写`,
    );
  }

  const binary = Uint8Array.from(atob(payload.dataBase64), (ch) =>
    ch.charCodeAt(0),
  );
  const mime = payload.mime || 'application/octet-stream';
  const ext = mime.includes('mpeg') || mime.includes('mp3')
    ? 'mp3'
    : mime.includes('wav')
      ? 'wav'
      : mime.includes('webm')
        ? 'webm'
        : 'ogg';
  const form = new FormData();
  form.append(
    'file',
    new Blob([binary], { type: mime }),
    payload.fileName ?? `audio.${ext}`,
  );
  form.append('model', model);
  form.append('response_format', 'json');

  const res = await fetch(joinUrl(settings.baseUrl, 'audio/transcriptions'), {
    method: 'POST',
    headers: buildAuthHeaders(settings, true),
    body: form,
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as { text?: string };
  const text = data.text?.trim();
  if (!text) {
    throw new Error('没有识别到语音内容');
  }
  return text;
}

export async function testConnection(settings: AiSettings): Promise<string> {
  return translateText(settings, 'hello', settings.incomingLang || 'zh');
}
