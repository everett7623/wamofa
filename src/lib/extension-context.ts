export const CONTEXT_INVALIDATED_ERROR = '扩展已更新，请刷新 WhatsApp 页面';

export function isExtensionAlive(): boolean {
  try {
    return Boolean(browser.runtime?.id);
  } catch {
    return false;
  }
}

export function isContextInvalidatedError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return /extension context invalidated/i.test(message);
}
