import { create } from 'zustand';
import { ClipboardOperation } from '../types/file';

interface ClipboardStore {
  clipboard: ClipboardOperation | null;
  copy: (paths: string[]) => void;
  cut: (paths: string[]) => void;
  clear: () => void;
}

export const useClipboardStore = create<ClipboardStore>((set) => ({
  clipboard: null,
  copy: (paths) => set({ clipboard: { type: 'copy', paths } }),
  cut: (paths) => set({ clipboard: { type: 'cut', paths } }),
  clear: () => set({ clipboard: null }),
}));
