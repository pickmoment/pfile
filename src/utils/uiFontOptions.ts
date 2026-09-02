// Selectable UI (sans-serif) font presets for the app shell — title bar, sidebar,
// toolbars, dialogs. Distinct from the monospace presets used by the content viewer.
export interface UiFontOption {
  id: string;
  label: string;
  stack: string;
}

export const UI_FONT_OPTIONS: UiFontOption[] = [
  { id: 'pretendard', label: 'Pretendard', stack: '"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'system', label: 'System Default', stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: 'apple-sd-gothic', label: 'Apple SD Gothic Neo', stack: '"Apple SD Gothic Neo", -apple-system, sans-serif' },
  { id: 'noto-sans-kr', label: 'Noto Sans KR', stack: '"Noto Sans KR", "Malgun Gothic", sans-serif' },
  { id: 'malgun-gothic', label: 'Malgun Gothic', stack: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif' },
  { id: 'inter', label: 'Inter', stack: '"Inter", -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: 'segoe-ui', label: 'Segoe UI', stack: '"Segoe UI", -apple-system, Roboto, sans-serif' },
  { id: 'helvetica', label: 'Helvetica Neue', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
];

export const DEFAULT_UI_FONT_ID = UI_FONT_OPTIONS[0].id;

export function getUiFontStack(id: string): string {
  return UI_FONT_OPTIONS.find((f) => f.id === id)?.stack ?? UI_FONT_OPTIONS[0].stack;
}
