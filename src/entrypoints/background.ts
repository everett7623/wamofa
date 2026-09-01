import { listModels, testConnection, transcribeAudio, translateText } from '~/lib/ai';
import type { ExtensionRequest, ExtensionResponse } from '~/lib/messaging';
import {
  getState,
  patchState,
  saveTemplates,
  toPublicState,
  upsertChat,
} from '~/lib/storage';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: ExtensionRequest, sender, sendResponse: (res: ExtensionResponse) => void) => {
      handle(message, sender)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return true;
    },
  );
});

function isExtensionPage(sender: { url?: string }): boolean {
  const url = sender.url ?? '';
  return url.startsWith(browser.runtime.getURL('/'));
}

async function handle(
  message: ExtensionRequest,
  sender: { url?: string },
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'WAMOFA_GET_STATE':
      return { ok: true, state: toPublicState(await getState()) };
    case 'WAMOFA_GET_PRIVATE':
      if (!isExtensionPage(sender)) {
        return { ok: false, error: '无权读取密钥' };
      }
      return { ok: true, privateState: await getState() };
    case 'WAMOFA_SAVE_PRIVATE': {
      if (!isExtensionPage(sender)) {
        return { ok: false, error: '无权写入完整配置' };
      }
      const incoming = message.state;
      // 汇入同一条写入链，并保留 current.chats：备注/标签只在 WhatsApp 页写入，
      // 选项页持有的是打开时的快照，整体覆盖会把期间新增的备注冲掉。
      const saved = await patchState((current) => ({
        ...current,
        settings: {
          ...incoming.settings,
          apiKey: incoming.settings.apiKey.trim(),
          projectKey: incoming.settings.projectKey.trim(),
        },
        templates: incoming.templates,
        tagPalette: incoming.tagPalette,
      }));
      return { ok: true, privateState: saved };
    }
    case 'WAMOFA_UPSERT_CHAT':
      return {
        ok: true,
        state: toPublicState(
          await upsertChat(message.chatId, message.patch, {
            aliasTitle: message.aliasTitle,
          }),
        ),
      };
    case 'WAMOFA_SAVE_TEMPLATES':
      return {
        ok: true,
        state: toPublicState(await saveTemplates(message.templates)),
      };
    case 'WAMOFA_OPEN_OPTIONS': {
      try {
        await browser.runtime.openOptionsPage();
      } catch {
        const url = browser.runtime.getURL('/options.html');
        await browser.tabs.create({ url });
      }
      return { ok: true, text: 'opened' };
    }
    case 'WAMOFA_TRANSLATE': {
      const { settings } = await getState();
      const text = await translateText(settings, message.text, message.targetLang);
      return { ok: true, text };
    }
    case 'WAMOFA_TRANSCRIBE': {
      const { settings } = await getState();
      const text = await transcribeAudio(settings, message);
      return { ok: true, text };
    }
    case 'WAMOFA_LIST_MODELS': {
      if (!isExtensionPage(sender)) {
        return { ok: false, error: '请在选项页读取模型列表' };
      }
      const { settings } = await getState();
      return { ok: true, models: await listModels(settings) };
    }
    case 'WAMOFA_TEST': {
      if (!isExtensionPage(sender)) {
        return { ok: false, error: '请在选项页测试连接' };
      }
      const { settings } = await getState();
      const text = await testConnection(settings);
      return { ok: true, text };
    }
    default:
      return { ok: false, error: '未知请求' };
  }
}
