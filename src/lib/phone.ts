export function normalizePhone(raw: string, defaultCountryCode: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 6) return null;
  if (hasPlus || digits.length >= 11) {
    return digits.replace(/^0+/, '');
  }
  const cc = defaultCountryCode.replace(/\D/g, '') || '86';
  const local = digits.replace(/^0+/, '');
  return `${cc}${local}`;
}

export function whatsappSendUrl(phone: string, text = ''): string {
  const url = new URL('https://web.whatsapp.com/send');
  url.searchParams.set('phone', phone);
  if (text) url.searchParams.set('text', text);
  return url.toString();
}
