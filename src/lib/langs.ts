export const LANGUAGES = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'pt', label: 'Português' },
  { id: 'ar', label: 'العربية' },
  { id: 'ru', label: 'Русский' },
  { id: 'th', label: 'ไทย' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'id', label: 'Indonesia' },
  { id: 'it', label: 'Italiano' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'hi', label: 'हिन्दी' },
] as const;

export type LangId = (typeof LANGUAGES)[number]['id'];

export function langLabel(id: string): string {
  return LANGUAGES.find((item) => item.id === id)?.label ?? id;
}
