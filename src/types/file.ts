export type FileCategory =
  | 'markdown'
  | 'code'
  | 'html'
  | 'data'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
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
