export function normalizePhone(raw: string, defaultCountryCode: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 6) return null;

  // 带 + 前缀表示用户已写明国家码，原样采用。
  if (trimmed.startsWith('+')) return digits.replace(/^0+/, '') || null;

  const cc = defaultCountryCode.replace(/\D/g, '') || '86';
  const local = digits.replace(/^0+/, '');
  if (!local) return null;

  // 只有「已以默认国家码开头且后面仍有足够位数」才当作完整国际号，
  // 否则一律补国家码：11 位国内手机号（13800138000）不补 86 的话，
  // WhatsApp 会按 +1 解析成美国号码，开聊必然失败。
  if (local.startsWith(cc) && local.length - cc.length >= 6) return local;
  return `${cc}${local}`;
}

export function whatsappSendUrl(phone: string, text = ''): string {
  const url = new URL('https://web.whatsapp.com/send');
  url.searchParams.set('phone', phone);
  if (text) url.searchParams.set('text', text);
  return url.toString();
}

export type OpenChatResult =
  | { ok: true; normalized: string; url: string }
  | { ok: false; error: string };

/** Normalize input and build the official WhatsApp Web send URL. */
export function buildOpenChatRequest(
  raw: string,
  defaultCountryCode: string,
): OpenChatResult {
  const normalized = normalizePhone(raw, defaultCountryCode);
  if (!normalized) return { ok: false, error: '请输入有效号码' };
  return { ok: true, normalized, url: whatsappSendUrl(normalized) };
}
