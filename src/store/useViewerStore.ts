import { create } from 'zustand';
import { DeviceViewport, DiffDisplayMode, FileMetadata, ViewerMode } from '../types/file';
import { DEFAULT_VIEWER_FONT_ID, getViewerFontStack, VIEWER_FONT_OPTIONS } from '../utils/fontOptions';

const VIEWER_FONT_SCALE_KEY = 'pfile_viewer_font_scale';
const DEFAULT_VIEWER_FONT_SCALE = 100;
const MIN_VIEWER_FONT_SCALE = 70;
const MAX_VIEWER_FONT_SCALE = 160;
const VIEWER_FONT_FAMILY_KEY = 'pfile_viewer_font_family';

let initialViewerFontScale = DEFAULT_VIEWER_FONT_SCALE;
try {
  const rawScale = localStorage.getItem(VIEWER_FONT_SCALE_KEY);
  const saved = rawScale === null ? NaN : Number(rawScale);
  if (Number.isFinite(saved)) {
    initialViewerFontScale = Math.max(MIN_VIEWER_FONT_SCALE, Math.min(MAX_VIEWER_FONT_SCALE, saved));
  }
} catch {
  // Use the default when persistent storage is unavailable.
}

function applyViewerFontFamily(id: string) {
  document.documentElement.style.setProperty('--viewer-font-mono', getViewerFontStack(id));
}

let initialViewerFontFamily = DEFAULT_VIEWER_FONT_ID;
try {
  const saved = localStorage.getItem(VIEWER_FONT_FAMILY_KEY);
  if (saved && VIEWER_FONT_OPTIONS.some((f) => f.id === saved)) {
    initialViewerFontFamily = saved;
  }
} catch {
  // Use the default when persistent storage is unavailable.
}
applyViewerFontFamily(initialViewerFontFamily);

interface ViewerStore {
  viewerMode: ViewerMode;
  diffTargetFile: FileMetadata | null;
  diffMode: DiffDisplayMode;
  zoomLevel: number;
  showCheckerboard: boolean;
  viewportSize: DeviceViewport;
  isEditing: boolean;
  showToc: boolean;
  contentOnly: boolean;
  viewerFontScale: number;
  viewerFontFamily: string;
  setViewerMode: (mode: ViewerMode) => void;
  setDiffTargetFile: (file: FileMetadata | null) => void;
  setDiffMode: (mode: DiffDisplayMode) => void;
  setZoomLevel: (zoom: number | ((prev: number) => number)) => void;
  toggleCheckerboard: () => void;
  setViewportSize: (size: DeviceViewport) => void;
  setIsEditing: (editing: boolean) => void;
  toggleToc: () => void;
  toggleContentOnly: () => void;
  setViewerFontScale: (scale: number | ((previous: number) => number)) => void;
  setViewerFontFamily: (id: string) => void;
  resetViewerState: () => void;
}

export const useViewerStore = create<ViewerStore>((set) => ({
  viewerMode: 'auto',
  diffTargetFile: null,
  diffMode: 'side-by-side',
  zoomLevel: 100,
  showCheckerboard: true,
  viewportSize: 'desktop',
  isEditing: false,
  showToc: true,
  contentOnly: false,
  viewerFontScale: initialViewerFontScale,
  viewerFontFamily: initialViewerFontFamily,

  setViewerMode: (mode) => set({ viewerMode: mode }),
  setDiffTargetFile: (file) => set({ diffTargetFile: file }),
  setDiffMode: (mode) => set({ diffMode: mode }),
  setZoomLevel: (zoom) =>
    set((state) => ({
      zoomLevel: typeof zoom === 'function' ? Math.max(10, Math.min(500, zoom(state.zoomLevel))) : Math.max(10, Math.min(500, zoom)),
    })),
  toggleCheckerboard: () => set((state) => ({ showCheckerboard: !state.showCheckerboard })),
  setViewportSize: (size) => set({ viewportSize: size }),
  setIsEditing: (editing) => set({ isEditing: editing }),
  toggleToc: () => set((state) => ({ showToc: !state.showToc })),
  toggleContentOnly: () => set((state) => ({ contentOnly: !state.contentOnly })),
  setViewerFontScale: (scale) =>
    set((state) => {
      const requested = typeof scale === 'function' ? scale(state.viewerFontScale) : scale;
      const next = Math.max(MIN_VIEWER_FONT_SCALE, Math.min(MAX_VIEWER_FONT_SCALE, requested));
      try {
        localStorage.setItem(VIEWER_FONT_SCALE_KEY, String(next));
      } catch {
        // Keep the in-memory preference when persistent storage is unavailable.
      }
      return { viewerFontScale: next };
    }),
  setViewerFontFamily: (id) =>
    set(() => {
      try {
        localStorage.setItem(VIEWER_FONT_FAMILY_KEY, id);
      } catch {
        // Keep the in-memory preference when persistent storage is unavailable.
      }
      applyViewerFontFamily(id);
      return { viewerFontFamily: id };
    }),
  resetViewerState: () =>
    set({
      viewerMode: 'auto',
      diffTargetFile: null,
      zoomLevel: 100,
      isEditing: false,
    }),
}));
