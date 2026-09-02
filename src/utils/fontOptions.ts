// Selectable monospace font presets for the content viewer (code, diffs, JSON, patches).
// Each stack lists the preferred font first, falling back through common cross-platform
// monospace fonts so the choice degrades gracefully on machines without it installed.
export interface ViewerFontOption {
  id: string;
  label: string;
  stack: string;
}

export const VIEWER_FONT_OPTIONS: ViewerFontOption[] = [
  { id: 'fira-code', label: 'Fira Code', stack: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', stack: '"JetBrains Mono", "Fira Code", Consolas, monospace' },
  { id: 'cascadia-code', label: 'Cascadia Code', stack: '"Cascadia Code", "Fira Code", Consolas, monospace' },
  { id: 'source-code-pro', label: 'Source Code Pro', stack: '"Source Code Pro", "Fira Code", Consolas, monospace' },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', stack: '"IBM Plex Mono", "Fira Code", Consolas, monospace' },
  { id: 'menlo', label: 'Menlo / SF Mono', stack: 'Menlo, "SF Mono", Monaco, Consolas, monospace' },
  { id: 'consolas', label: 'Consolas', stack: 'Consolas, "Courier New", monospace' },
  { id: 'courier-new', label: 'Courier New', stack: '"Courier New", Courier, monospace' },
];

export const DEFAULT_VIEWER_FONT_ID = VIEWER_FONT_OPTIONS[0].id;

export function getViewerFontStack(id: string): string {
  return VIEWER_FONT_OPTIONS.find((f) => f.id === id)?.stack ?? VIEWER_FONT_OPTIONS[0].stack;
}
