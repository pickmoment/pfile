import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { FileFilterCategory, FileMetadata, QuickPathItem } from '../types/file';
import { getSelectedFiles } from '../utils/fileTreeUtils';
interface FileStore {
  currentDirectory: string;
  files: FileMetadata[];
  selectedFile: FileMetadata | null;
  selectedPaths: string[];
  lastSelectedPath: string | null;
  expandedDirs: Set<string>;
  dirCache: Record<string, FileMetadata[]>;
  favorites: string[];
  recentDirectories: string[];
  quickPaths: QuickPathItem[];
  searchQuery: string;
  categoryFilter: FileFilterCategory;
  isLoading: boolean;
  watcherActive: boolean;
  isQuickJumpOpen: boolean;
  isAddressBarEditing: boolean;
  showHiddenFiles: boolean;
  // Navigation History
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;

  setCurrentDirectory: (dir: string, pushHistory?: boolean) => Promise<void>;
  refreshDirectory: () => Promise<void>;
  setSelectedFile: (file: FileMetadata | null) => void;
  setSelectedPaths: (paths: string[]) => void;
  toggleSelectPath: (file: FileMetadata, isMulti: boolean) => void;
  selectRange: (targetFile: FileMetadata, visibleFiles: FileMetadata[]) => void;
  selectAll: (visibleFiles?: FileMetadata[]) => void;
  clearSelection: () => void;
  getSelectedFiles: () => FileMetadata[];
  toggleDirExpanded: (dirPath: string) => Promise<void>;
  addFavorite: (path: string) => void;
  removeFavorite: (path: string) => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: FileFilterCategory) => void;
  setWatcherActive: (active: boolean) => void;
  setQuickJumpOpen: (open: boolean) => void;
  setIsAddressBarEditing: (editing: boolean) => void;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  goUp: () => Promise<void>;
  jumpToPath: (path: string) => Promise<void>;
  loadQuickPaths: () => Promise<void>;
  toggleShowHiddenFiles: () => void;
  setShowHiddenFiles: (show: boolean) => void;
  initWorkspace: () => Promise<void>;
}

const HIDDEN_KEY = 'pfile_show_hidden';

const FAVORITES_KEY = 'pfile_favorites';
const RECENT_KEY = 'pfile_recent_dirs';
let directoryRefreshInFlight: Promise<void> | null = null;
let directoryRefreshQueued = false;
let workspaceInitInFlight: Promise<void> | null = null;
let directoryNavigationGeneration = 0;


function getStored(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStored(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const useFileStore = create<FileStore>((set, get) => ({
  currentDirectory: '',
  files: [],
  selectedFile: null,
  selectedPaths: [],
  lastSelectedPath: null,
  expandedDirs: new Set<string>(),
  dirCache: {},
  favorites: getStored(FAVORITES_KEY),
  recentDirectories: getStored(RECENT_KEY),
  quickPaths: [],
  searchQuery: '',
  categoryFilter: 'ALL',
  isLoading: false,
  watcherActive: false,
  isQuickJumpOpen: false,
  isAddressBarEditing: false,
  showHiddenFiles: localStorage.getItem(HIDDEN_KEY) === 'true',
  history: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,

  initWorkspace: async () => {
    if (workspaceInitInFlight) return workspaceInitInFlight;

    workspaceInitInFlight = (async () => {
      try {
        await get().loadQuickPaths();
        const home: string = await invoke('get_home_dir');
        await get().setCurrentDirectory(home);
      } catch {
        await get().setCurrentDirectory('.');
      }
    })().finally(() => {
      workspaceInitInFlight = null;
    });

    return workspaceInitInFlight;
  },

  loadQuickPaths: async () => {
    try {
      const items: QuickPathItem[] = await invoke('get_quick_access_paths');
      set({ quickPaths: items });
    } catch (err) {
      console.warn('Failed to load quick paths:', err);
    }
  },

  setCurrentDirectory: async (dir: string, pushHistory = true) => {
    const normalized = dir.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
    const navigationGeneration = ++directoryNavigationGeneration;
    set({ isLoading: true });

    try {
      const items: FileMetadata[] = await invoke('list_directory', { path: normalized });
      if (navigationGeneration !== directoryNavigationGeneration) return;

      try {
        await invoke('start_watch', { path: normalized });
        set({ watcherActive: true });
      } catch (err) {
        console.warn('Could not start watcher for directory:', err);
      }

      // Update recent directories
      const currentRecents = get().recentDirectories.filter((p) => p !== normalized);
      const newRecents = [normalized, ...currentRecents].slice(0, 15);
      saveStored(RECENT_KEY, newRecents);

      // Update history stack
      let newHistory = get().history;
      let newIndex = get().historyIndex;

      if (pushHistory) {
        if (newIndex < newHistory.length - 1) {
          newHistory = newHistory.slice(0, newIndex + 1);
        }
        if (newHistory[newHistory.length - 1] !== normalized) {
          newHistory = [...newHistory, normalized];
          newIndex = newHistory.length - 1;
        }
      }

      set((state) => {
        const newCache = { ...state.dirCache, [normalized]: items };
        const newExpanded = new Set(state.expandedDirs);
        newExpanded.add(normalized);

        return {
          currentDirectory: normalized,
          files: items,
          dirCache: newCache,
          expandedDirs: newExpanded,
          recentDirectories: newRecents,
          history: newHistory,
          historyIndex: newIndex,
          canGoBack: newIndex > 0,
          canGoForward: newIndex < newHistory.length - 1,
          isLoading: false,
          isAddressBarEditing: false,
        };
      });
    } catch (err) {
      console.error('Failed to load directory:', err);
      if (navigationGeneration === directoryNavigationGeneration) {
        set({ isLoading: false });
      }
      throw err;
    }
  },

  refreshDirectory: async () => {
    if (directoryRefreshInFlight) {
      directoryRefreshQueued = true;
      return directoryRefreshInFlight;
    }

    const performRefresh = async () => {
      const { currentDirectory, expandedDirs } = get();
      if (!currentDirectory) return;

      const items: FileMetadata[] = await invoke('list_directory', { path: currentDirectory });
      const childDirs = [...expandedDirs].filter((dir) => dir !== currentDirectory);
      const childResults = await Promise.all(
        childDirs.map(async (dir) => {
          try {
            return [dir, await invoke<FileMetadata[]>('list_directory', { path: dir })] as const;
          } catch {
            return null;
          }
        }),
      );

      // Navigation may have changed while the filesystem calls were pending.
      if (get().currentDirectory !== currentDirectory) return;

      set((state) => {
        const newCache: Record<string, FileMetadata[]> = { [currentDirectory]: items };
        for (const result of childResults) {
          if (result) newCache[result[0]] = result[1];
        }

        let updatedSelected = state.selectedFile;
        if (updatedSelected) {
          const fileMap = new Map<string, FileMetadata>();
          for (const loadedItems of Object.values(newCache)) {
            for (const item of loadedItems) fileMap.set(item.path, item);
          }
          updatedSelected = fileMap.get(updatedSelected.path) ?? updatedSelected;
        }

        return {
          files: items,
          dirCache: { ...state.dirCache, ...newCache },
          selectedFile: updatedSelected,
        };
      });
    };

    directoryRefreshInFlight = (async () => {
      do {
        directoryRefreshQueued = false;
        try {
          await performRefresh();
        } catch (err) {
          console.error('Failed to refresh directory:', err);
        }
      } while (directoryRefreshQueued);
    })().finally(() => {
      directoryRefreshInFlight = null;
    });

    return directoryRefreshInFlight;
  },

  goBack: async () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevDir = history[historyIndex - 1];
      set({ historyIndex: historyIndex - 1 });
      await get().setCurrentDirectory(prevDir, false);
    }
  },

  goForward: async () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextDir = history[historyIndex + 1];
      set({ historyIndex: historyIndex + 1 });
      await get().setCurrentDirectory(nextDir, false);
    }
  },

  goUp: async () => {
    const { currentDirectory } = get();
    if (!currentDirectory) return;

    const parts = currentDirectory.split('/').filter(Boolean);
    if (parts.length > 1) {
      let parent = '';
      if (currentDirectory.includes(':')) {
        parent = parts.slice(0, -1).join('/');
        if (parent.endsWith(':')) parent += '/';
      } else {
        parent = '/' + parts.slice(0, -1).join('/');
      }
      await get().setCurrentDirectory(parent);
    }
  },

  jumpToPath: async (targetPath: string) => {
    const normalized = targetPath.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
    await get().setCurrentDirectory(normalized);
  },

  setSelectedFile: (file) => {
    set({
      selectedFile: file,
      selectedPaths: file ? [file.path] : [],
      lastSelectedPath: file ? file.path : null,
    });
  },

  setSelectedPaths: (paths) => {
    const { selectedFile, files, dirCache } = get();
    let nextSelectedFile = selectedFile;
    if (selectedFile && !paths.includes(selectedFile.path)) {
      const all = getSelectedFiles(paths, files, dirCache);
      nextSelectedFile = all[0] || null;
    } else if (!selectedFile && paths.length > 0) {
      const all = getSelectedFiles(paths, files, dirCache);
      nextSelectedFile = all[0] || null;
    }
    set({
      selectedPaths: paths,
      selectedFile: nextSelectedFile,
      lastSelectedPath: paths.length > 0 ? paths[paths.length - 1] : null,
    });
  },

  toggleSelectPath: (file: FileMetadata, isMulti: boolean) => {
    if (!isMulti) {
      get().setSelectedFile(file);
      return;
    }

    const { selectedPaths, selectedFile } = get();
    const exists = selectedPaths.includes(file.path);

    if (exists) {
      const nextPaths = selectedPaths.filter((p) => p !== file.path);
      let nextSelectedFile = selectedFile;
      if (selectedFile?.path === file.path) {
        const remaining = get().getSelectedFiles().filter((f) => f.path !== file.path);
        nextSelectedFile = remaining[0] || null;
      }
      set({
        selectedPaths: nextPaths,
        selectedFile: nextSelectedFile,
        lastSelectedPath: file.path,
      });
    } else {
      set({
        selectedPaths: [...selectedPaths, file.path],
        selectedFile: file,
        lastSelectedPath: file.path,
      });
    }
  },

  selectRange: (targetFile: FileMetadata, visibleFiles: FileMetadata[]) => {
    const { lastSelectedPath, selectedFile } = get();
    const anchorPath = lastSelectedPath || selectedFile?.path;

    if (!anchorPath || visibleFiles.length === 0) {
      get().setSelectedFile(targetFile);
      return;
    }

    const anchorIndex = visibleFiles.findIndex((f) => f.path === anchorPath);
    const targetIndex = visibleFiles.findIndex((f) => f.path === targetFile.path);

    if (anchorIndex === -1 || targetIndex === -1) {
      get().setSelectedFile(targetFile);
      return;
    }

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    const rangeFiles = visibleFiles.slice(start, end + 1);
    const rangePaths = rangeFiles.map((f) => f.path);

    set({
      selectedPaths: rangePaths,
      selectedFile: targetFile,
      lastSelectedPath: anchorPath,
    });
  },

  selectAll: (visibleFiles?: FileMetadata[]) => {
    const items = visibleFiles ?? get().files;
    if (items.length === 0) return;
    const paths = items.map((f) => f.path);
    set({
      selectedPaths: paths,
      selectedFile: items[0] || null,
      lastSelectedPath: items[0]?.path || null,
    });
  },

  clearSelection: () => {
    set({
      selectedPaths: [],
      selectedFile: null,
      lastSelectedPath: null,
    });
  },

  getSelectedFiles: () => {
    const { selectedPaths, files, dirCache } = get();
    return getSelectedFiles(selectedPaths, files, dirCache);
  },

  toggleDirExpanded: async (dirPath: string) => {
    const { expandedDirs, dirCache } = get();
    const nextExpanded = new Set(expandedDirs);

    if (nextExpanded.has(dirPath)) {
      nextExpanded.delete(dirPath);
      set({ expandedDirs: nextExpanded });
    } else {
      nextExpanded.add(dirPath);
      set({ expandedDirs: nextExpanded });

      if (!dirCache[dirPath]) {
        try {
          const items: FileMetadata[] = await invoke('list_directory', { path: dirPath });
          set((state) => ({
            dirCache: { ...state.dirCache, [dirPath]: items },
          }));
        } catch (err) {
          console.error(`Failed to load child directory ${dirPath}:`, err);
        }
      }
    }
  },

  addFavorite: (path) => {
    const { favorites } = get();
    if (!favorites.includes(path)) {
      const updated = [...favorites, path];
      saveStored(FAVORITES_KEY, updated);
      set({ favorites: updated });
    }
  },

  removeFavorite: (path) => {
    const { favorites } = get();
    const updated = favorites.filter((f) => f !== path);
    saveStored(FAVORITES_KEY, updated);
    set({ favorites: updated });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setCategoryFilter: (category) => set({ categoryFilter: category }),
  toggleShowHiddenFiles: () => {
    const next = !get().showHiddenFiles;
    try {
      localStorage.setItem(HIDDEN_KEY, String(next));
    } catch {}
    set({ showHiddenFiles: next });
  },
  setShowHiddenFiles: (show) => {
    try {
      localStorage.setItem(HIDDEN_KEY, String(show));
    } catch {}
    set({ showHiddenFiles: show });
  },
  setWatcherActive: (active) => set({ watcherActive: active }),
  setQuickJumpOpen: (open) => set({ isQuickJumpOpen: open }),
  setIsAddressBarEditing: (editing) => set({ isAddressBarEditing: editing }),
}));
