import { langLabel } from '~/lib/langs';
import { getProvider } from '~/lib/providers';
import type { AiSettings } from '~/lib/types';

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function requireSettings(settings: AiSettings): void {
  if (!settings.apiKey.trim()) {
    throw new Error('请先在选项页填写 API Key');
  }
  if (!settings.baseUrl.trim()) {
    throw new Error('请填写 Base URL');
  }
  if (!settings.model.trim()) {
    throw new Error('请填写文本模型名');
  }
}

async function readError(res: Response): Promise<string> {
  const body = await res.text();
  const trimmed = body.replace(/\s+/g, ' ').slice(0, 240);
  return `HTTP ${res.status}${trimmed ? `: ${trimmed}` : ''}`;
}

export async function translateText(
  settings: AiSettings,
  text: string,
  targetLang: string,
): Promise<string> {
  requireSettings(settings);
  const target = langLabel(targetLang);
  const res = await fetch(joinUrl(settings.baseUrl, 'chat/completions'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
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
            'Preserve names, numbers, emojis, and line breaks.',
        },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('模型没有返回译文');
  }
  return content;
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
        : `${provider.name} 仅支持文本翻译，请改用 OpenAI、Groq 或硅基流动做语音转写`,
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
    headers: {
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
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
