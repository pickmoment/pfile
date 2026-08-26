import { create } from 'zustand';
import { DeviceViewport, DiffDisplayMode, FileMetadata, ViewerMode } from '../types/file';

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
  setViewerMode: (mode: ViewerMode) => void;
  setDiffTargetFile: (file: FileMetadata | null) => void;
  setDiffMode: (mode: DiffDisplayMode) => void;
  setZoomLevel: (zoom: number | ((prev: number) => number)) => void;
  toggleCheckerboard: () => void;
  setViewportSize: (size: DeviceViewport) => void;
  setIsEditing: (editing: boolean) => void;
  toggleToc: () => void;
  toggleContentOnly: () => void;
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
  resetViewerState: () =>
    set({
      viewerMode: 'auto',
      diffTargetFile: null,
      zoomLevel: 100,
      isEditing: false,
    }),
}));
