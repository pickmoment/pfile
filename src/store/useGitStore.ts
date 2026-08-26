import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { GitFileStatus, GitLogEntry, GitRepoInfo } from '../types/file';

interface GitStore {
  // State
  isRepo: boolean;
  repoRoot: string | null;
  branch: string | null;
  isDetached: boolean;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  stagedCount: number;
  modifiedCount: number;
  untrackedCount: number;
  conflictedCount: number;
  log: GitLogEntry[];
  commitMessage: string;
  isLoading: boolean;
  isCommitting: boolean;
  gitPanelOpen: boolean;
  gitPanelTab: 'changes' | 'log';

  // Actions
  refreshGitStatus: (path: string) => Promise<void>;
  loadLog: (path: string) => Promise<void>;
  stageFiles: (path: string, files: string[]) => Promise<void>;
  unstageFiles: (path: string, files: string[]) => Promise<void>;
  stageAll: (path: string) => Promise<void>;
  unstageAll: (path: string) => Promise<void>;
  commit: (path: string) => Promise<string | null>;
  discardFiles: (path: string, files: string[]) => Promise<void>;
  getDiff: (path: string, filePath: string) => Promise<string>;
  setCommitMessage: (msg: string) => void;
  setGitPanelOpen: (open: boolean) => void;
  setGitPanelTab: (tab: 'changes' | 'log') => void;
  getFileStatus: (absPath: string) => GitFileStatus | undefined;
  reset: () => void;
}

export const useGitStore = create<GitStore>((set, get) => ({
  isRepo: false,
  repoRoot: null,
  branch: null,
  isDetached: false,
  ahead: 0,
  behind: 0,
  files: [],
  stagedCount: 0,
  modifiedCount: 0,
  untrackedCount: 0,
  conflictedCount: 0,
  log: [],
  commitMessage: '',
  isLoading: false,
  isCommitting: false,
  gitPanelOpen: false,
  gitPanelTab: 'changes',

  refreshGitStatus: async (path: string) => {
    try {
      const info: GitRepoInfo = await invoke('git_repo_info', { path });
      set({
        isRepo: info.is_repo,
        repoRoot: info.repo_root,
        branch: info.branch,
        isDetached: info.is_detached,
        ahead: info.ahead,
        behind: info.behind,
        files: info.files,
        stagedCount: info.staged_count,
        modifiedCount: info.modified_count,
        untrackedCount: info.untracked_count,
        conflictedCount: info.conflicted_count,
      });
    } catch {
      set({
        isRepo: false,
        repoRoot: null,
        branch: null,
        isDetached: false,
        ahead: 0,
        behind: 0,
        files: [],
        stagedCount: 0,
        modifiedCount: 0,
        untrackedCount: 0,
        conflictedCount: 0,
      });
    }
  },

  loadLog: async (path: string) => {
    try {
      const entries: GitLogEntry[] = await invoke('git_log', { path, count: 50 });
      set({ log: entries });
    } catch {
      set({ log: [] });
    }
  },

  stageFiles: async (path: string, files: string[]) => {
    await invoke('git_stage', { path, files });
    await get().refreshGitStatus(path);
  },

  unstageFiles: async (path: string, files: string[]) => {
    await invoke('git_unstage', { path, files });
    await get().refreshGitStatus(path);
  },

  stageAll: async (path: string) => {
    await invoke('git_stage_all', { path });
    await get().refreshGitStatus(path);
  },

  unstageAll: async (path: string) => {
    await invoke('git_unstage_all', { path });
    await get().refreshGitStatus(path);
  },

  commit: async (path: string) => {
    const msg = get().commitMessage.trim();
    if (!msg) return null;
    set({ isCommitting: true });
    try {
      const shortId: string = await invoke('git_commit', { path, message: msg });
      set({ commitMessage: '' });
      await get().refreshGitStatus(path);
      await get().loadLog(path);
      return shortId;
    } finally {
      set({ isCommitting: false });
    }
  },

  discardFiles: async (path: string, files: string[]) => {
    await invoke('git_discard', { path, files });
    await get().refreshGitStatus(path);
  },

  getDiff: async (path: string, filePath: string) => {
    return await invoke('git_diff', { path, filePath });
  },

  setCommitMessage: (msg: string) => set({ commitMessage: msg }),
  setGitPanelOpen: (open: boolean) => set({ gitPanelOpen: open }),
  setGitPanelTab: (tab: 'changes' | 'log') => set({ gitPanelTab: tab }),

  getFileStatus: (absPath: string) => {
    return get().files.find((f) => f.abs_path === absPath);
  },

  reset: () =>
    set({
      isRepo: false,
      repoRoot: null,
      branch: null,
      isDetached: false,
      ahead: 0,
      behind: 0,
      files: [],
      stagedCount: 0,
      modifiedCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      log: [],
      commitMessage: '',
    }),
}));
