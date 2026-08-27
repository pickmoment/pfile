import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { GitBranchInfo, GitCommitDetail, GitFileStatus, GitLogEntry, GitRepoInfo } from '../types/file';

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
  branches: GitBranchInfo[];
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
  loadBranches: (path: string) => Promise<void>;
  createBranch: (path: string, name: string) => Promise<void>;
  checkoutBranch: (path: string, name: string) => Promise<void>;
  deleteBranch: (path: string, name: string) => Promise<void>;
  pull: (path: string) => Promise<string>;
  push: (path: string) => Promise<string>;
  stageAll: (path: string) => Promise<void>;
  unstageAll: (path: string) => Promise<void>;
  commit: (path: string) => Promise<string | null>;
  discardFiles: (path: string, files: string[]) => Promise<void>;
  getDiff: (path: string, filePath: string, staged: boolean) => Promise<string>;
  getCommitDetail: (path: string, commitId: string) => Promise<GitCommitDetail>;
  getCommitDiff: (path: string, commitId: string, filePath?: string) => Promise<string>;
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
  branches: [],
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

  loadBranches: async (path: string) => {
    const branches: GitBranchInfo[] = await invoke('git_branches', { path });
    set({ branches });
  },

  createBranch: async (path: string, name: string) => {
    await invoke('git_create_branch', { path, name });
    await Promise.all([get().refreshGitStatus(path), get().loadBranches(path), get().loadLog(path)]);
  },

  checkoutBranch: async (path: string, name: string) => {
    await invoke('git_checkout_branch', { path, name });
    await Promise.all([get().refreshGitStatus(path), get().loadBranches(path), get().loadLog(path)]);
  },

  deleteBranch: async (path: string, name: string) => {
    await invoke('git_delete_branch', { path, name });
    await get().loadBranches(path);
  },

  pull: async (path: string) => {
    const message: string = await invoke('git_pull', { path });
    await Promise.all([get().refreshGitStatus(path), get().loadBranches(path), get().loadLog(path)]);
    return message;
  },

  push: async (path: string) => {
    const message: string = await invoke('git_push', { path });
    await Promise.all([get().refreshGitStatus(path), get().loadBranches(path)]);
    return message;
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

  getDiff: async (path: string, filePath: string, staged: boolean) =>
    invoke('git_diff', { path, filePath, staged }),
  getCommitDetail: async (path: string, commitId: string) =>
    invoke('git_commit_detail', { path, commitId }),
  getCommitDiff: async (path: string, commitId: string, filePath?: string) =>
    invoke('git_commit_diff', { path, commitId, filePath }),

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
      branches: [],
      commitMessage: '',
    }),
}));
