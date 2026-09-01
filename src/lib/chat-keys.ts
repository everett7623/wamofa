import { emptyChatMeta, type ChatMeta } from '~/lib/types';

export function phoneChatKey(phone: string): string {
  return `phone:${phone.replace(/\D/g, '')}`;
}

export function titleChatKey(title: string): string {
  return `title:${title.trim()}`;
}

export function parsePhoneFromChatId(chatId: string | null | undefined): string | null {
  if (!chatId?.startsWith('phone:')) return null;
  const digits = chatId.slice(6).replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

export function parseTitleFromChatId(chatId: string | null | undefined): string | null {
  if (!chatId?.startsWith('title:')) return null;
  const title = chatId.slice(6).trim();
  return title || null;
}

/** Merge two chat metas; prefer non-empty fields from `preferred`. */
export function mergeChatMeta(base: ChatMeta | undefined, preferred: ChatMeta | undefined): ChatMeta {
  const a = base ?? emptyChatMeta();
  const b = preferred ?? emptyChatMeta();
  return {
    note: b.note.trim() || a.note,
    tagIds: b.tagIds.length ? b.tagIds : a.tagIds,
    outgoingLang: b.outgoingLang ?? a.outgoingLang,
    autoTranslate: b.autoTranslate ?? a.autoTranslate,
    manualPhone: b.manualPhone?.trim() || a.manualPhone,
  };
}

/**
 * Resolve the best chat key + meta for list/panel/header lookups.
 * Tries phone key, title key, and the active chatId (in that priority for reads).
 */
export function resolveChatLookup(
  chats: Record<string, ChatMeta>,
  input: {
    chatId?: string | null;
    title?: string | null;
    phone?: string | null;
  },
): { key: string | null; meta: ChatMeta; candidates: string[] } {
  const candidates: string[] = [];
  const phone = (input.phone || parsePhoneFromChatId(input.chatId) || '').replace(/\D/g, '');
  const title = (input.title || parseTitleFromChatId(input.chatId) || '').trim();

  if (phone) candidates.push(phoneChatKey(phone));
  if (input.chatId) candidates.push(input.chatId);
  if (title) candidates.push(titleChatKey(title));

  const unique = [...new Set(candidates.filter(Boolean))];
  let merged = emptyChatMeta();
  let primaryKey: string | null = unique[0] ?? null;

  for (const key of unique) {
    const hit = chats[key];
    if (!hit) continue;
    if (!primaryKey) primaryKey = key;
    // Prefer phone-key meta as primary when present
    if (key.startsWith('phone:')) primaryKey = key;
    merged = mergeChatMeta(merged, hit);
  }

  return { key: primaryKey, meta: merged, candidates: unique };
}

/**
 * When phone resolves for a named contact, fold title: meta into phone: and drop the alias.
 */
export function migrateTitleToPhone(
  chats: Record<string, ChatMeta>,
  title: string | null | undefined,
  phone: string,
): Record<string, ChatMeta> {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return chats;
  const phoneKey = phoneChatKey(digits);
  const titleKey = title?.trim() ? titleChatKey(title) : null;
  const next = { ...chats };
  const fromTitle = titleKey ? next[titleKey] : undefined;
  const existing = next[phoneKey];
  next[phoneKey] = mergeChatMeta(fromTitle, existing);
  if (titleKey && titleKey !== phoneKey) delete next[titleKey];
  return next;
}
