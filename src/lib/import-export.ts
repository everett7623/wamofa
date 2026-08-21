/**
 * 数据导入导出功能
 * 支持备份和迁移客户资料、快捷回复、标签等数据
 */

import type { AppState } from '~/lib/types';
import { getState, setState } from '~/lib/storage';

export interface ExportData {
  version: string;
  exportTime: string;
  chats: AppState['chats'];
  templates: AppState['templates'];
  tagPalette: AppState['tagPalette'];
}

/**
 * 导出客户资料到 JSON
 */
export async function exportData(): Promise<string> {
  const state = await getState();
  const data: ExportData = {
    version: '0.2.1',
    exportTime: new Date().toISOString(),
    chats: state.chats,
    templates: state.templates,
    tagPalette: state.tagPalette,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * 从 JSON 导入客户资料
 */
export async function importData(json: string): Promise<{ success: boolean; message: string }> {
  try {
    const data = JSON.parse(json) as ExportData;

    // 验证数据格式
    if (!data.version || !data.chats || !data.templates || !data.tagPalette) {
      return { success: false, message: '数据格式不正确' };
    }

    const state = await getState();

    // 合并数据（不覆盖现有数据，避免意外丢失）
    const mergedChats = { ...state.chats };
    for (const [chatId, meta] of Object.entries(data.chats)) {
      if (!mergedChats[chatId]) {
        mergedChats[chatId] = meta;
      }
    }

    // 模板去重（根据 title + body）
    const existingKeys = new Set(
      state.templates.map((t) => `${t.title}::${t.body}`),
    );
    const newTemplates = data.templates.filter(
      (t) => !existingKeys.has(`${t.title}::${t.body}`),
    );

    // 标签去重（根据 name）
    const existingTagNames = new Set(state.tagPalette.map((t) => t.name));
    const newTags = data.tagPalette.filter((t) => !existingTagNames.has(t.name));

    await setState({
      ...state,
      chats: mergedChats,
      templates: [...state.templates, ...newTemplates],
      tagPalette: [...state.tagPalette, ...newTags],
    });

    return {
      success: true,
      message: `成功导入 ${Object.keys(data.chats).length} 位客户、${newTemplates.length} 条模板、${newTags.length} 个标签`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '导入失败',
    };
  }
}

/**
 * 下载数据为文件
 */
export function downloadAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
