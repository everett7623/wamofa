/**
 * 话术与标签在选项页和 WhatsApp 页都能改。选项页收到存储变化时，
 * 用三方比较决定本地列表如何吸收外部改动：
 * - synced：选项页上次与存储对齐时的列表（自己保存时也会更新）
 * - stored：存储里的最新列表
 * - local：选项页当前显示的列表（可能含尚未保存的编辑）
 */
export function resolveListSync<T extends { id: string }>(
  local: T[],
  stored: T[],
  synced: T[],
): T[] {
  // 存储里这份列表没变（含自己保存的回声）：保留本地，未保存的编辑不丢
  if (sameList(stored, synced)) return local;
  // 本地没有未保存的编辑：直接采用最新存储
  if (sameList(local, synced)) return stored;
  // TODO: 两边都改了——选项页里正在编辑，WhatsApp 页同时增删了话术/标签。
  // 目前沿用旧行为（本地优先），下次保存会覆盖外部改动。
  return local;
}

function sameList<T>(a: T[], b: T[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
