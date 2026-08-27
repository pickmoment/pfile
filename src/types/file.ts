export type FileCategory =
  | 'markdown'
  | 'code'
  | 'html'
  | 'data'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'archive'
  | 'other';

export interface FileMetadata {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number;
  extension: string | null;
  category: FileCategory;
  is_binary: boolean;
  is_hidden: boolean;
  readonly: boolean;
}

export interface TokenStats {
  token_count: number;
  word_count: number;
  line_count: number;
  char_count: number;
}

export type ViewerMode =
  | 'auto'
  | 'rendered'
  | 'source'
  | 'split'
  | 'tree'
  | 'table'
  | 'diff'
  | 'raw';

export type DeviceViewport = 'desktop' | 'laptop' | 'tablet' | 'mobile';

export type DiffDisplayMode = 'side-by-side' | 'inline';

export interface DiffTarget {
  file: FileMetadata;
  content: string;
}

export interface ClipboardOperation {
  type: 'copy' | 'cut';
  paths: string[];
}

export type FileFilterCategory = 'ALL' | 'MD' | 'CODE' | 'HTML' | 'DATA' | 'MEDIA';

export interface FileTreeNodeData {
  metadata: FileMetadata;
  children?: FileTreeNodeData[];
  isLoaded: boolean;
  isLoading: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface QuickPathItem {
  name: string;
  path: string;
  kind: string;
}

// ── Git Types ───────────────────────────────────────────────────

export type GitFileStatusKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'typechange'
  | 'untracked'
  | 'ignored'
  | 'conflicted';

export interface GitFileStatus {
  path: string;
  abs_path: string;
  index_status: GitFileStatusKind | null;
  worktree_status: GitFileStatusKind | null;
}

export interface GitRepoInfo {
  is_repo: boolean;
  repo_root: string | null;
  branch: string | null;
  is_detached: boolean;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  staged_count: number;
  modified_count: number;
  untracked_count: number;
  conflicted_count: number;
}

export interface GitLogEntry {
  id: string;
  short_id: string;
  summary: string;
  author: string;
  email: string;
  timestamp: number;
  relative_time: string;
}

export interface GitCommitFile {
  path: string;
  old_path: string | null;
  status: GitFileStatusKind;
}

export interface GitCommitDetail {
  id: string;
  short_id: string;
  summary: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
  parent_ids: string[];
  additions: number;
  deletions: number;
  files: GitCommitFile[];
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  upstream: string | null;
}

// ── Archive Types ───────────────────────────────────────────────

export interface ArchiveEntry {
  path: string;
  is_dir: boolean;
  size: number;
  compressed_size: number | null;
  modified_ms: number | null;
}

export interface ArchiveInfo {
  format: string;
  total_entries: number;
  total_size: number;
  compressed_size: number;
  entries: ArchiveEntry[];
}
