import { create } from 'zustand';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { DEFAULT_UI_FONT_ID, getUiFontStack, UI_FONT_OPTIONS } from '../utils/uiFontOptions';

const UI_FONT_FAMILY_KEY = 'pfile_ui_font_family';
const UI_ZOOM_KEY = 'pfile_ui_zoom';
const DEFAULT_UI_ZOOM = 100;
const MIN_UI_ZOOM = 50;
const MAX_UI_ZOOM = 200;

function applyUiFontFamily(id: string) {
  document.documentElement.style.setProperty('--app-font-sans', getUiFontStack(id));
}

function applyUiZoom(zoom: number) {
  // Falls through silently outside a Tauri webview (e.g. plain browser dev preview,
  // or before the Tauri IPC bridge has injected `__TAURI_INTERNALS__`), or if the
  // `core:webview:allow-set-webview-zoom` capability is unavailable.
  try {
    getCurrentWebview()
      .setZoom(zoom / 100)
      .catch(() => {});
  } catch {
    // Not running inside a Tauri webview; nothing to do.
  }
}

let initialUiFontFamily = DEFAULT_UI_FONT_ID;
try {
  const saved = localStorage.getItem(UI_FONT_FAMILY_KEY);
  if (saved && UI_FONT_OPTIONS.some((f) => f.id === saved)) {
    initialUiFontFamily = saved;
  }
} catch {
  // Use the default when persistent storage is unavailable.
}
applyUiFontFamily(initialUiFontFamily);

let initialUiZoom = DEFAULT_UI_ZOOM;
try {
  const rawZoom = localStorage.getItem(UI_ZOOM_KEY);
  const saved = rawZoom === null ? NaN : Number(rawZoom);
  if (Number.isFinite(saved)) {
    initialUiZoom = Math.max(MIN_UI_ZOOM, Math.min(MAX_UI_ZOOM, saved));
  }
} catch {
  // Use the default when persistent storage is unavailable.
}
applyUiZoom(initialUiZoom);

interface UiPreferencesStore {
  uiFontFamily: string;
  uiZoomLevel: number;
  setUiFontFamily: (id: string) => void;
  setUiZoomLevel: (zoom: number | ((previous: number) => number)) => void;
}

export const useUiPreferencesStore = create<UiPreferencesStore>((set) => ({
  uiFontFamily: initialUiFontFamily,
  uiZoomLevel: initialUiZoom,

  setUiFontFamily: (id) =>
    set(() => {
      try {
        localStorage.setItem(UI_FONT_FAMILY_KEY, id);
      } catch {
        // Keep the in-memory preference when persistent storage is unavailable.
      }
      applyUiFontFamily(id);
      return { uiFontFamily: id };
    }),

  setUiZoomLevel: (zoom) =>
    set((state) => {
      const requested = typeof zoom === 'function' ? zoom(state.uiZoomLevel) : zoom;
      const next = Math.max(MIN_UI_ZOOM, Math.min(MAX_UI_ZOOM, requested));
      try {
        localStorage.setItem(UI_ZOOM_KEY, String(next));
      } catch {
        // Keep the in-memory preference when persistent storage is unavailable.
      }
      applyUiZoom(next);
      return { uiZoomLevel: next };
    }),
}));
