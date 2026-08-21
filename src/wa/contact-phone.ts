export const CONTACT_PHONE_RESOLVED_EVENT = 'wamofa:contact-phone-resolved';

interface MessageLookupCandidate {
  cacheKey: string;
  msgId: string;
  fullKey?: string;
}

interface MessageRecord {
  from?: unknown;
  to?: unknown;
}

const phoneByMessage = new Map<string, string | null>();
const phoneByContactName = new Map<
  string,
  { phone: string | null; checkedAt: number }
>();
let lookupBusy = false;
const NAME_RETRY_MS = 15_000;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openModelStorage(): Promise<IDBDatabase | null> {
  try {
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      if (!databases.some((database) => database.name === 'model-storage')) return null;
    }
    return await requestResult(indexedDB.open('model-storage'));
  } catch {
    return null;
  }
}

function serializedParty(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record._serialized === 'string') return record._serialized;
  if (typeof record.user === 'string' && typeof record.server === 'string') {
    return `${record.user}@${record.server}`;
  }
  return '';
}

/** A real PN JID or plain international number; never accepts @lid digits. */
export function phoneFromParty(value: unknown): string | null {
  const serialized = serializedParty(value).trim();
  const jid = serialized.match(/^(\d{7,15})@(?:c\.us|s\.whatsapp\.net|hosted)$/i);
  if (jid?.[1] && !/^0+$/.test(jid[1])) return jid[1];
  const plain = serialized.match(/^\+?(\d{7,15})$/);
  if (plain?.[1] && !/^0+$/.test(plain[1])) return plain[1];
  return null;
}

export function peerPhoneFromMessage(
  record: MessageRecord,
  fromMe: boolean,
): string | null {
  return phoneFromParty(fromMe ? record.to : record.from);
}

export function lidFromMessageKey(key: string): string | null {
  return key.match(/^(?:true|false)_(\d+@lid)_[^_]+/i)?.[1] ?? null;
}

export function normalizeContactName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '')
    .replace(/[\u200B-\u200D\uFE0E\uFE0F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function directPhoneFromMessageKey(key: string): string | null {
  return (
    key.match(
      /^(?:true|false)_(\d{7,15})@(?:c\.us|s\.whatsapp\.net|hosted)_/i,
    )?.[1] ?? null
  );
}

function getVisibleMessageCandidates(): MessageLookupCandidate[] {
  const main = document.querySelector<HTMLElement>('#main');
  if (!main) return [];
  const seen = new Set<string>();
  const candidates: MessageLookupCandidate[] = [];

  for (const node of main.querySelectorAll<HTMLElement>('[data-id]')) {
    const raw = (node.getAttribute('data-id') ?? '').trim();
    if (!raw || seen.has(raw)) continue;

    if (/^[0-9A-F]{16,}$/i.test(raw)) {
      seen.add(raw);
      candidates.push({ cacheKey: raw, msgId: raw });
      continue;
    }

    const serialized = raw.match(
      /^(?:true|false)_[^_]+@(?:c\.us|s\.whatsapp\.net|lid|hosted|hosted\.lid)_([^_]+)/i,
    );
    const msgId = serialized?.[1] ?? '';
    if (!msgId || seen.has(msgId)) continue;
    seen.add(msgId);
    candidates.push({ cacheKey: msgId, msgId, fullKey: raw });
  }

  // Newest rendered bubbles are normally last and are nearest the newest IDB keys.
  return candidates.reverse();
}

function trimCache(): void {
  if (phoneByMessage.size <= 800) return;
  const removeCount = phoneByMessage.size - 500;
  let removed = 0;
  for (const key of phoneByMessage.keys()) {
    phoneByMessage.delete(key);
    removed += 1;
    if (removed >= removeCount) break;
  }
}

async function findFullMessageKey(
  db: IDBDatabase,
  candidate: MessageLookupCandidate,
): Promise<IDBValidKey | null> {
  const store = db.transaction('message', 'readonly').objectStore('message');

  if (candidate.fullKey) {
    try {
      const direct = await requestResult(store.getKey(candidate.fullKey));
      if (direct != null) return direct;
    } catch {
      // Some WhatsApp builds do not expose getKey consistently; use the scan.
    }
  }

  const suffix = `_${candidate.msgId}`;
  return new Promise((resolve) => {
    let scanned = 0;
    const cursor = db
      .transaction('message', 'readonly')
      .objectStore('message')
      .openKeyCursor(null, 'prev');
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current || scanned >= 60_000) {
        resolve(null);
        return;
      }
      scanned += 1;
      const key = String(current.key);
      if (key === candidate.fullKey || key.endsWith(suffix)) {
        resolve(current.key);
        return;
      }
      current.continue();
    };
    cursor.onerror = () => resolve(null);
  });
}

async function phoneFromContactStore(
  db: IDBDatabase,
  lid: string,
): Promise<string | null> {
  const possibleStores = ['contact', 'lid-pn-mapping'];
  for (const storeName of possibleStores) {
    if (!db.objectStoreNames.contains(storeName)) continue;
    try {
      const value = (await requestResult(
        db.transaction(storeName, 'readonly').objectStore(storeName).get(lid),
      )) as Record<string, unknown> | undefined;
      if (!value) continue;
      const candidates = [
        value.phoneNumber,
        value.pn,
        value.phone,
        value.wid,
        value.id,
      ];
      for (const candidate of candidates) {
        const phone = phoneFromParty(candidate);
        if (phone) return phone;
      }
    } catch {
      // Schema differences are expected across WhatsApp Web versions.
    }
  }
  return null;
}

async function lookupPeerPhone(
  candidate: MessageLookupCandidate,
): Promise<string | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openModelStorage();
    if (!db) return null;
    if (!db.objectStoreNames.contains('message')) return null;

    const fullKey = await findFullMessageKey(db, candidate);
    if (fullKey == null) return null;
    const key = String(fullKey);
    if (!/^(?:true|false)_[^_]+@(?:c\.us|s\.whatsapp\.net|lid|hosted|hosted\.lid)_/i.test(key)) {
      return null;
    }

    const directFromKey = directPhoneFromMessageKey(key);
    if (directFromKey) return directFromKey;

    const record = (await requestResult(
      db.transaction('message', 'readonly').objectStore('message').get(fullKey),
    )) as MessageRecord | undefined;
    const directFromRecord = record
      ? peerPhoneFromMessage(record, key.startsWith('true_'))
      : null;
    if (directFromRecord) return directFromRecord;

    const lid = lidFromMessageKey(key);
    return lid ? phoneFromContactStore(db, lid) : null;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

async function lookupPhoneByContactName(title: string): Promise<string | null> {
  const target = normalizeContactName(title);
  if (target.length < 2) return null;

  let db: IDBDatabase | null = null;
  try {
    db = await openModelStorage();
    if (!db?.objectStoreNames.contains('contact')) return null;

    return await new Promise((resolve) => {
      const phones = new Set<string>();
      let scanned = 0;
      const cursor = db!
        .transaction('contact', 'readonly')
        .objectStore('contact')
        .openCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current || scanned >= 50_000) {
          resolve(phones.size === 1 ? [...phones][0]! : null);
          return;
        }
        scanned += 1;
        const record = (current.value ?? {}) as Record<string, unknown>;
        const names = [
          record.name,
          record.shortName,
          record.pushname,
          record.verifiedName,
          record.formattedName,
          record.searchName,
        ];
        if (names.some((name) => normalizeContactName(name) === target)) {
          const phoneCandidates = [
            record.phoneNumber,
            record.pn,
            record.phone,
            record.wid,
            record.id,
            current.primaryKey,
          ];
          for (const candidate of phoneCandidates) {
            const phone = phoneFromParty(candidate);
            if (phone) phones.add(phone);
          }
          // Duplicate saved names are ambiguous: never return one person's PN
          // merely because it was encountered first.
          if (phones.size > 1) {
            resolve(null);
            return;
          }
        }
        current.continue();
      };
      cursor.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

async function resolveSavedContactPhone(
  candidates: MessageLookupCandidate[],
  title: string,
): Promise<void> {
  if (lookupBusy) return;
  lookupBusy = true;
  try {
    // A newest visible message normally resolves immediately. Try a few records
    // so a system/media row with a different shape cannot block the chat.
    for (const candidate of candidates.filter((item) => !phoneByMessage.has(item.cacheKey)).slice(0, 4)) {
      const phone = await lookupPeerPhone(candidate);
      phoneByMessage.set(candidate.cacheKey, phone);
      if (!phone) continue;
      for (const item of candidates) phoneByMessage.set(item.cacheKey, phone);
      trimCache();
      window.dispatchEvent(new CustomEvent(CONTACT_PHONE_RESOLVED_EVENT));
      return;
    }

    const nameKey = normalizeContactName(title);
    if (nameKey) {
      const phone = await lookupPhoneByContactName(title);
      phoneByContactName.set(nameKey, { phone, checkedAt: Date.now() });
      if (phone) {
        for (const item of candidates) phoneByMessage.set(item.cacheKey, phone);
        trimCache();
        window.dispatchEvent(new CustomEvent(CONTACT_PHONE_RESOLVED_EVENT));
        return;
      }
    }
    trimCache();
  } finally {
    lookupBusy = false;
  }
}

/**
 * Synchronous facade for the UI. A cache miss starts a read-only IndexedDB
 * lookup; the existing 400 ms UI poll and resolved event pick up the result.
 */
export function getSavedContactPhone(title = ''): string | null {
  const candidates = getVisibleMessageCandidates();
  for (const candidate of candidates) {
    const phone = phoneByMessage.get(candidate.cacheKey);
    if (phone) return phone;
  }

  const nameKey = normalizeContactName(title);
  const byName = nameKey ? phoneByContactName.get(nameKey) : undefined;
  if (byName?.phone) return byName.phone;

  const hasUntriedMessage = candidates.some(
    (candidate) => !phoneByMessage.has(candidate.cacheKey),
  );
  const nameLookupDue = Boolean(
    nameKey && (!byName || (!byName.phone && Date.now() - byName.checkedAt >= NAME_RETRY_MS)),
  );
  if (hasUntriedMessage || nameLookupDue) {
    void resolveSavedContactPhone(candidates, title);
  }
  return null;
}
