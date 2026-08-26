import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  FileArchive,
  ChevronRight,
  ChevronDown,
  Folder,
  File as FileIcon,
  Download,
  Eye,
  Sparkles,
  Package,
  Search,
} from 'lucide-react';
import { FileMetadata, ArchiveInfo, ArchiveEntry } from '../../types/file';
import { useToastStore } from '../../store/useToastStore';

// ── Helpers ─────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

function compressionRatio(original: number, compressed: number): string {
  if (original === 0) return '—';
  const pct = ((1 - compressed / original) * 100);
  return `${pct.toFixed(0)}%`;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  size: number;
  compressedSize: number | null;
  children: TreeNode[];
}

function buildTree(entries: ArchiveEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  const getOrCreateDir = (pathParts: string[], depth: number): TreeNode[] => {
    if (depth === 0) return root;
    const dirPath = pathParts.slice(0, depth).join('/');
    let existing = dirMap.get(dirPath);
    if (!existing) {
      existing = {
        name: pathParts[depth - 1],
        fullPath: dirPath + '/',
        isDir: true,
        size: 0,
        compressedSize: null,
        children: [],
      };
      dirMap.set(dirPath, existing);
      const parent = getOrCreateDir(pathParts, depth - 1);
      parent.push(existing);
    }
    return existing.children;
  };

  for (const entry of entries) {
    const cleanPath = entry.path.replace(/\/$/, '');
    if (!cleanPath) continue;
    const parts = cleanPath.split('/');

    if (entry.is_dir) {
      getOrCreateDir(parts, parts.length);
    } else {
      const parentChildren = getOrCreateDir(parts, parts.length - 1);
      parentChildren.push({
        name: parts[parts.length - 1],
        fullPath: entry.path,
        isDir: false,
        size: entry.size,
        compressedSize: entry.compressed_size,
        children: [],
      });
    }
  }

  // Sort: dirs first, then alphabetical
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children.length > 0) sortNodes(n.children);
    }
  };
  sortNodes(root);
  return root;
}

// ── TreeNodeRow ─────────────────────────────────────────────────

const TreeNodeRow: React.FC<{
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (path: string) => void;
  onPreview: (path: string) => void;
  searchQuery: string;
}> = ({ node, depth, expanded, toggleExpand, onPreview, searchQuery }) => {
  const isOpen = expanded.has(node.fullPath);
  const matchesSearch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase());

  // For dirs, also show if any child matches
  const hasMatchingChild = useMemo(() => {
    if (!searchQuery) return true;
    if (matchesSearch) return true;
    if (!node.isDir) return false;
    const check = (n: TreeNode): boolean => {
      if (n.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      return n.children.some(check);
    };
    return node.children.some(check);
  }, [node, searchQuery, matchesSearch]);

  if (!matchesSearch && !hasMatchingChild) return null;

  return (
    <>
      <div
        className="group flex items-center py-1 hover:bg-[var(--s6)] rounded cursor-default transition-colors"
        style={{ paddingLeft: `${depth * 18 + 12}px` }}
      >
        {/* Expand toggle */}
        {node.isDir ? (
          <button
            onClick={() => toggleExpand(node.fullPath)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-[var(--tx2)]"
          >
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <div className="w-4.5 flex-shrink-0" />
        )}

        {/* Icon */}
        <span className="flex-shrink-0 ml-1">
          {node.isDir ? (
            <Folder className={`w-4 h-4 ${isOpen ? 'text-amber-400' : 'text-[var(--tx5)]'}`} />
          ) : (
            <FileIcon className="w-4 h-4 text-[var(--tx5)]" />
          )}
        </span>

        {/* Name */}
        <span className="ml-1.5 flex-1 truncate font-mono text-[11.5px] text-[var(--tx2)]" title={node.fullPath}>
          {node.name}
        </span>

        {/* Size */}
        {!node.isDir && (
          <span className="flex-shrink-0 text-[10px] text-[var(--tx5)] font-mono mr-2">
            {formatBytes(node.size)}
          </span>
        )}

        {/* Compression */}
        {!node.isDir && node.compressedSize !== null && (
          <span className="flex-shrink-0 text-[10px] text-[var(--tx6)] font-mono mr-2">
            {compressionRatio(node.size, node.compressedSize)}
          </span>
        )}

        {/* Preview action */}
        {!node.isDir && (
          <button
            onClick={() => onPreview(node.fullPath)}
            className="hidden group-hover:flex flex-shrink-0 p-0.5 rounded hover:bg-[var(--bg-strong)] text-[var(--tx5)] hover:text-[var(--tx2)]"
            title="Preview content"
          >
            <Eye className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Recursive children */}
      {node.isDir && isOpen &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggleExpand={toggleExpand}
            onPreview={onPreview}
            searchQuery={searchQuery}
          />
        ))}
    </>
  );
};

// ── Preview Panel ───────────────────────────────────────────────

const PreviewPanel: React.FC<{
  archivePath: string;
  entryPath: string;
  onClose: () => void;
}> = ({ archivePath, entryPath, onClose }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    invoke<string>('archive_extract_file', {
      archivePath,
      entryPath,
    })
      .then((data) => setContent(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [archivePath, entryPath]);

  const isBinary = content?.startsWith('base64:');
  const fileName = entryPath.split('/').pop() || entryPath;

  return (
    <div className="flex flex-col h-full border-l border-[var(--bd2)] bg-[var(--s2)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--bd2)] bg-[var(--s3)]">
        <span className="text-[11px] font-mono text-[var(--tx2)] truncate flex-1">{fileName}</span>
        <button
          onClick={onClose}
          className="ml-2 text-[var(--tx5)] hover:text-[var(--tx2)] text-xs"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 font-mono text-[11.5px] text-[var(--tx3)] whitespace-pre-wrap break-all">
        {loading && (
          <div className="flex items-center gap-2 text-[var(--tx5)]">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Extracting…</span>
          </div>
        )}
        {error && (
          <div className="text-[var(--danger-text)] text-xs">{error}</div>
        )}
        {content && !isBinary && content}
        {content && isBinary && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--tx5)] text-xs gap-2">
            <Package className="w-8 h-8 text-[var(--tx6)]" />
            <span>Binary content ({formatBytes(atob(content.slice(7)).length)})</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main ArchiveViewer ──────────────────────────────────────────

interface ArchiveViewerProps {
  file: FileMetadata;
}

export const ArchiveViewer: React.FC<ArchiveViewerProps> = ({ file }) => {
  const showToast = useToastStore((s) => s.showToast);
  const [info, setInfo] = useState<ArchiveInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previewEntry, setPreviewEntry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setInfo(null);
    setPreviewEntry(null);
    setSearchQuery('');
    setExpanded(new Set());

    invoke<ArchiveInfo>('archive_list', { path: file.path })
      .then((data) => {
        setInfo(data);
        // Auto-expand root-level dirs
        const rootDirs = new Set<string>();
        for (const e of data.entries) {
          const first = e.path.split('/')[0];
          if (e.path.includes('/')) rootDirs.add(first + '/');
        }
        if (rootDirs.size <= 3) setExpanded(rootDirs);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [file.path]);

  const tree = useMemo(() => (info ? buildTree(info.entries) : []), [info]);

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!info) return;
    const allDirs = new Set<string>();
    for (const e of info.entries) {
      if (e.is_dir) allDirs.add(e.path);
      // Also add implicit parent dirs
      const parts = e.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        allDirs.add(parts.slice(0, i).join('/') + '/');
      }
    }
    setExpanded(allDirs);
  }, [info]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const handleExtractAll = useCallback(async () => {
    const dest = await save({
      title: 'Extract archive to…',
      defaultPath: file.name.replace(/\.[^.]+$/, ''),
    });
    if (!dest) return;

    setExtracting(true);
    try {
      const count = await invoke<number>('archive_extract_to', {
        archivePath: file.path,
        destDir: dest,
      });
      showToast('Extracted', `${count} files extracted`, 'success');
    } catch (err) {
      showToast('Extract failed', String(err), 'error');
    } finally {
      setExtracting(false);
    }
  }, [file, showToast]);

  // Loading
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--s2)] text-[var(--tx5)] gap-2">
        <Sparkles className="w-5 h-5 animate-spin text-blue-400" />
        <span className="text-xs font-mono">Reading archive…</span>
      </div>
    );
  }

  // Error
  if (error || !info) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--s2)] text-[var(--tx4)] p-6">
        <div className="p-4 bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-xl text-xs text-[var(--danger-text)] max-w-md text-center">
          <p className="font-semibold mb-1">Cannot read archive</p>
          <p className="font-mono text-[11px]">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const fileCount = info.entries.filter((e) => !e.is_dir).length;
  const dirCount = info.entries.filter((e) => e.is_dir).length;

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s2)] overflow-hidden">
      {/* Stats Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--bd2)] bg-[var(--s3)] flex-shrink-0">
        <FileArchive className="w-5 h-5 text-violet-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[var(--tx1)] truncate">{file.name}</div>
          <div className="flex items-center gap-3 text-[10.5px] text-[var(--tx4)] font-mono mt-0.5">
            <span>{info.format.toUpperCase()}</span>
            <span>·</span>
            <span>{fileCount} files{dirCount > 0 ? `, ${dirCount} folders` : ''}</span>
            <span>·</span>
            <span>{formatBytes(info.total_size)} → {formatBytes(info.compressed_size)}</span>
            {info.total_size > 0 && (
              <>
                <span>·</span>
                <span className="text-[var(--success-text)]">
                  {compressionRatio(info.total_size, info.compressed_size)} saved
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={expandAll}
            className="px-2 py-1 text-[10px] rounded bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)] transition-colors"
            title="Expand all"
          >
            Expand
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-[10px] rounded bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)] transition-colors"
            title="Collapse all"
          >
            Collapse
          </button>
          <button
            onClick={handleExtractAll}
            disabled={extracting}
            className="flex items-center gap-1 px-2.5 py-1 text-[10.5px] rounded bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 transition-colors"
          >
            <Download className="w-3 h-3" />
            {extracting ? 'Extracting…' : 'Extract All'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-1.5 border-b border-[var(--bd2)] flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-[var(--s5)] rounded px-2 py-1 border border-[var(--bd2)]">
          <Search className="w-3 h-3 text-[var(--tx5)] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files…"
            className="flex-1 bg-transparent text-[11px] text-[var(--tx2)] placeholder:text-[var(--tx6)] focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Content: Tree + Optional Preview */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* File Tree */}
        <div className={`${previewEntry ? 'w-1/2' : 'w-full'} overflow-y-auto py-1`}>
          {tree.map((node) => (
            <TreeNodeRow
              key={node.fullPath}
              node={node}
              depth={0}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onPreview={setPreviewEntry}
              searchQuery={searchQuery}
            />
          ))}
          {tree.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--tx5)] text-xs">
              <Package className="w-6 h-6 mb-2 text-[var(--tx6)]" />
              <span>Empty archive</span>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {previewEntry && (
          <PreviewPanel
            archivePath={file.path}
            entryPath={previewEntry}
            onClose={() => setPreviewEntry(null)}
          />
        )}
      </div>
    </div>
  );
};
