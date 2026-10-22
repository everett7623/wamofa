/** 与主配置、翻译缓存分开，避免检查更新触发 WhatsApp 页全量刷新。 */
export const UPDATE_STORAGE_KEY = 'wamofa_upd';

const GITHUB_REPO = 'everett7623/wamofa';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 12_000;

export type UpdatePhase = 'current' | 'update' | 'ahead' | 'unknown';

export interface UpdateSnapshot {
  current: string;
  latest: string | null;
  htmlUrl: string | null;
  checkedAt: number | null;
  phase: UpdatePhase;
  error: string | null;
}

interface CachedUpdate {
  latest: string;
  htmlUrl: string;
  checkedAt: number;
}

/** 比较 x.y.z。大于返回 1，相等返回 0，小于返回 -1。 */
export function compareVersions(left: string, right: string): number {
  const a = left.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const b = right.replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const da = a[index] ?? 0;
    const db = b[index] ?? 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

function phaseOf(current: string, latest: string): UpdatePhase {
  const diff = compareVersions(current, latest);
  if (diff === 0) return 'current';
  if (diff < 0) return 'update';
  return 'ahead';
}

function releaseUrl(url: string, latest: string): string {
  const fallback = `${RELEASES_PAGE}/tag/v${latest}`;
  try {
    const parsed = new URL(url);
    const allowed =
      parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      parsed.pathname.startsWith(`/${GITHUB_REPO}/`);
    return allowed ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function readCache(raw: unknown): CachedUpdate | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CachedUpdate>;
  if (typeof value.latest !== 'string' || !value.latest.trim()) return null;
  if (typeof value.checkedAt !== 'number' || !Number.isFinite(value.checkedAt)) return null;
  const latest = value.latest.replace(/^v/i, '');
  return {
    latest,
    htmlUrl: releaseUrl(typeof value.htmlUrl === 'string' ? value.htmlUrl : '', latest),
    checkedAt: value.checkedAt,
  };
}

function snapshotFrom(current: string, cached: CachedUpdate, error: string | null): UpdateSnapshot {
  return {
    current,
    latest: cached.latest,
    htmlUrl: cached.htmlUrl,
    checkedAt: cached.checkedAt,
    phase: phaseOf(current, cached.latest),
    error,
  };
}

function emptySnapshot(current: string, error: string): UpdateSnapshot {
  return {
    current,
    latest: null,
    htmlUrl: RELEASES_PAGE,
    checkedAt: null,
    phase: 'unknown',
    error,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.name === 'AbortError') return '检查超时，请稍后重试';
  if (err instanceof Error && err.message) return err.message;
  return '暂时无法连接 GitHub';
}

let inflight: Promise<UpdateSnapshot> | null = null;

export function checkForUpdate(force = false): Promise<UpdateSnapshot> {
  if (!force && inflight) return inflight;
  const run = checkForUpdateNow(force).finally(() => {
    if (inflight === run) inflight = null;
  });
  if (!force) inflight = run;
  return run;
}

async function checkForUpdateNow(force: boolean): Promise<UpdateSnapshot> {
  const current = browser.runtime.getManifest().version;
  const stored = await browser.storage.local.get(UPDATE_STORAGE_KEY);
  const cached = readCache(stored[UPDATE_STORAGE_KEY]);
  const fresh = Boolean(cached && Date.now() - cached.checkedAt < CACHE_TTL_MS);
  if (!force && fresh && cached) return snapshotFrom(current, cached, null);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(RELEASES_API, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'WAMofa',
      },
    });
    if (!response.ok) {
      throw new Error(
        response.status === 403 || response.status === 429
          ? 'GitHub 检查次数已用完，请稍后再试'
          : `GitHub 返回 ${response.status}`,
      );
    }
    const body = (await response.json()) as { tag_name?: unknown; html_url?: unknown };
    const latest = typeof body.tag_name === 'string' ? body.tag_name.replace(/^v/i, '').trim() : '';
    if (!latest) throw new Error('发布信息里没有版本号');
    const next: CachedUpdate = {
      latest,
      htmlUrl: releaseUrl(typeof body.html_url === 'string' ? body.html_url : '', latest),
      checkedAt: Date.now(),
    };
    await browser.storage.local.set({ [UPDATE_STORAGE_KEY]: next });
    return snapshotFrom(current, next, null);
  } catch (err) {
    const message = errorMessage(err);
    if (cached) return snapshotFrom(current, cached, message);
    return emptySnapshot(current, message);
  } finally {
    clearTimeout(timer);
  }
}
