/** 国际前缀：`+` 或国际冠码 `00`，二选一，必须位于开头。 */
const INTL_PREFIX = /^(?:\+|00)/;

/**
 * 把用户输入规范成 WhatsApp `send?phone=` 需要的纯数字国际号码（不含 +）。
 *
 * 只接受以 `+` 或 `00` 开头、自带国家码的完整号码；不再用「默认区号」补全。
 * 此前的补全逻辑会把 `923338483463`（用户以为已含 +92）当作国内号补成 +86，
 * WhatsApp 直接报「未注册」，用户却看不出哪里错了。
 */
export function normalizePhone(raw: string): string | null {
  // 去掉常见分隔符：空格、连字符、括号、点
  const compact = raw.replace(/[\s\-().]/g, '');
  const match = /^(?:\+|00)(\d+)$/.exec(compact);
  if (!match) return null;

  // 国家码不会以 0 开头，顺带兼容 `+0092…` 这种冗余写法
  const digits = (match[1] ?? '').replace(/^0+/, '');
  // E.164 上限 15 位；下限沿用旧值，过短的号码没有开聊意义
  if (digits.length < 6 || digits.length > 15) return null;
  return digits;
}

export function whatsappSendUrl(phone: string, text = ''): string {
  const url = new URL('https://web.whatsapp.com/send');
  url.searchParams.set('phone', phone);
  if (text) url.searchParams.set('text', text);
  return url.toString();
}

/** 输入框占位示例，例如 `+86 138 0000 0000`。 */
export function phoneExample(countryCode: string): string {
  return `+${countryCode.replace(/\D/g, '') || '86'} 138 0000 0000`;
}

/** 输入框下方的格式说明。 */
export function phoneFormatHint(countryCode: string): string {
  return `需含国家码，以 + 或 00 开头，如 ${phoneExample(countryCode)}`;
}

export type OpenChatResult =
  | { ok: true; normalized: string; url: string }
  | { ok: false; error: string };

/** Normalize input and build the official WhatsApp Web send URL. */
export function buildOpenChatRequest(raw: string): OpenChatResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: '请输入号码' };
  // 缺前缀单独提示：这是最常见的错法，笼统的「号码无效」帮不上忙
  if (!INTL_PREFIX.test(trimmed)) {
    return { ok: false, error: '号码需以 + 或 00 开头，并包含国家码' };
  }
  const normalized = normalizePhone(trimmed);
  if (!normalized) return { ok: false, error: '号码格式无效，请检查后重试' };
  return { ok: true, normalized, url: whatsappSendUrl(normalized) };
}
