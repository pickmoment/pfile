import React, { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Sparkles,
  Copy,
  Scissors,
  Trash2,
  X,
  FolderSearch,
  Search,
  Layers,
  CheckSquare,
  FileCode,
  Database,
  Eye,
  Check,
} from 'lucide-react';
import { FileMetadata } from '../../types/file';
import { useFileStore } from '../../store/useFileStore';
import { useClipboardStore } from '../../store/useClipboardStore';
import { useToastStore } from '../../store/useToastStore';
import { getFileIcon } from '../../utils/fileIcons';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { generateBatchLlmContext } from '../../utils/llmPrompt';
import { DeleteConfirmDialog } from '../common/Dialogs';

interface BatchSelectionViewerProps {
  onPreviewSingleFile?: (file: FileMetadata) => void;
}

export const BatchSelectionViewer: React.FC<BatchSelectionViewerProps> = ({
  onPreviewSingleFile,
}) => {
  const selectedPaths = useFileStore((s) => s.selectedPaths);
  const getSelectedFiles = useFileStore((s) => s.getSelectedFiles);
  const setSelectedFile = useFileStore((s) => s.setSelectedFile);
  const toggleSelectPath = useFileStore((s) => s.toggleSelectPath);
  const clearSelection = useFileStore((s) => s.clearSelection);
  const currentDirectory = useFileStore((s) => s.currentDirectory);

  const copy = useClipboardStore((s) => s.copy);
  const cut = useClipboardStore((s) => s.cut);
  const showToast = useToastStore((s) => s.showToast);

  const [filterQuery, setFilterQuery] = useState('');
  const [isCopyingLlm, setIsCopyingLlm] = useState(false);
  const [copiedLlm, setCopiedLlm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedFiles = useMemo(() => getSelectedFiles(), [selectedPaths, getSelectedFiles]);

  // Aggregate stats
  const totalSize = useMemo(
    () => selectedFiles.reduce((acc, f) => acc + (f.is_dir ? 0 : f.size), 0),
    [selectedFiles]
  );
  const fileCount = useMemo(
    () => selectedFiles.filter((f) => !f.is_dir).length,
    [selectedFiles]
  );
  const folderCount = useMemo(
    () => selectedFiles.filter((f) => f.is_dir).length,
    [selectedFiles]
  );

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of selectedFiles) {
      const cat = f.is_dir ? 'folder' : f.category;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [selectedFiles]);

  // Filtered files in list
  const displayedFiles = useMemo(() => {
    if (!filterQuery) return selectedFiles;
    const q = filterQuery.toLowerCase();
    return selectedFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [selectedFiles, filterQuery]);

  const handleCopyClipboard = () => {
    copy(selectedPaths);
    showToast('Copied', `${selectedPaths.length} items copied to clipboard`, 'info');
  };

  const handleCutClipboard = () => {
    cut(selectedPaths);
    showToast('Cut', `${selectedPaths.length} items cut to clipboard`, 'info');
  };

  const handleCopyLlmPrompt = async () => {
    setIsCopyingLlm(true);
    try {
      const result = await generateBatchLlmContext(selectedFiles);
      if (!result.prompt) {
        showToast('No Text Content', 'None of the selected files contained readable text', 'warning');
        return;
      }
      await navigator.clipboard.writeText(result.prompt);
      setCopiedLlm(true);
      setTimeout(() => setCopiedLlm(false), 2500);
      showToast(
        'Copied for AI Prompt',
        `${result.fileCount} file(s) formatted (~${formatNumber(result.totalTokens)} tokens)`,
        'success'
      );
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to format LLM prompt';
      showToast('Error', msg, 'error');
    } finally {
      setIsCopyingLlm(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s1)] overflow-hidden select-none">
      {/* Top Banner / Header */}
      <div className="bg-[var(--s5)] border-b border-[var(--bd2)] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--tx1)]">Batch Selection</h2>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-mono font-medium">
                {selectedPaths.length} items
              </span>
            </div>
            <p className="text-[11px] text-[var(--tx4)] mt-0.5">
              {fileCount} files, {folderCount} folders • Total size: {formatBytes(totalSize)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyLlmPrompt}
            disabled={isCopyingLlm || selectedFiles.length === 0}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
          >
            {copiedLlm ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied AI Prompt</span>
              </>
            ) : isCopyingLlm ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Formatting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Copy for LLM Prompt</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyClipboard}
            className="px-2.5 py-1.5 bg-[var(--s6)] hover:bg-[var(--s7)] text-[var(--tx2)] border border-[var(--bd2)] rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            title="Copy (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5 text-[var(--tx4)]" />
            <span>Copy</span>
          </button>

          <button
            type="button"
            onClick={handleCutClipboard}
            className="px-2.5 py-1.5 bg-[var(--s6)] hover:bg-[var(--s7)] text-[var(--tx2)] border border-[var(--bd2)] rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            title="Cut (Ctrl+X)"
          >
            <Scissors className="w-3.5 h-3.5 text-[var(--tx4)]" />
            <span>Cut</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDeleting(true)}
            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            title="Delete Selected (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={clearSelection}
            className="px-2.5 py-1.5 bg-[var(--s6)] hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-[var(--tx1)] border border-[var(--bd2)] rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            title="Clear Selection (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="px-5 py-3 border-b border-[var(--bd2)] bg-[var(--s3)] grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2.5 bg-[var(--s5)] border border-[var(--bd2)] rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10.5px] text-[var(--tx5)] font-medium uppercase tracking-wider block">
              Total Selected
            </span>
            <span className="text-sm font-semibold text-[var(--tx1)] font-mono">
              {selectedFiles.length} items
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-[var(--s5)] border border-[var(--bd2)] rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10.5px] text-[var(--tx5)] font-medium uppercase tracking-wider block">
              Total Size
            </span>
            <span className="text-sm font-semibold text-[var(--tx1)] font-mono">
              {formatBytes(totalSize)}
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-[var(--s5)] border border-[var(--bd2)] rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10.5px] text-[var(--tx5)] font-medium uppercase tracking-wider block">
              Text & Docs
            </span>
            <span className="text-sm font-semibold text-[var(--tx1)] font-mono">
              {fileCount} files
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-[var(--s5)] border border-[var(--bd2)] rounded-xl flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <span
                key={cat}
                className="px-1.5 py-0.5 bg-[var(--s7)] text-[var(--tx3)] border border-[var(--bd1)] rounded text-[10px] font-mono capitalize"
              >
                {cat}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Search Filter Bar within Selection */}
      <div className="px-5 py-2.5 border-b border-[var(--bd2)] bg-[var(--s4)] flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-[var(--tx5)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter selected items..."
            className="w-full pl-8 pr-3 py-1 bg-[var(--s2)] border border-[var(--bd1)] rounded-lg text-xs text-[var(--tx2)] placeholder-[var(--tx6)] focus:outline-none focus:border-blue-500/50"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--tx5)] hover:text-[var(--tx2)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <span className="text-[11px] text-[var(--tx5)] font-mono">
          Showing {displayedFiles.length} of {selectedFiles.length} items
        </span>
      </div>

      {/* Selected Items Table List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
        {displayedFiles.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--tx5)]">
            No items matching "{filterQuery}"
          </div>
        ) : (
          <div className="bg-[var(--s4)] border border-[var(--bd2)] rounded-xl overflow-hidden divide-y divide-[var(--bd2)]">
            {displayedFiles.map((f) => {
              let relativePath = f.path;
              if (currentDirectory && f.path.startsWith(currentDirectory)) {
                relativePath = f.path.slice(currentDirectory.length).replace(/^\//, '');
              }

              return (
                <div
                  key={f.path}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--s6)] transition-colors group"
                >
                  {/* Left: Icon + Name + Relative Path */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="flex-shrink-0">
                      {getFileIcon(f.category, f.extension, f.is_dir, false, 'w-4 h-4')}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(f);
                            onPreviewSingleFile?.(f);
                          }}
                          className="font-mono text-xs font-medium text-[var(--tx2)] hover:text-blue-400 truncate text-left transition-colors"
                          title="Click to preview file"
                        >
                          {f.name}
                        </button>
                        <span className="px-1.5 py-0.2 bg-[var(--s7)] text-[var(--tx4)] border border-[var(--bd1)] rounded text-[9.5px] font-mono uppercase">
                          {f.is_dir ? 'folder' : f.extension || f.category}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[var(--tx5)] font-mono truncate mt-0.5" title={f.path}>
                        {relativePath}
                      </p>
                    </div>
                  </div>

                  {/* Middle: Size */}
                  <div className="text-right flex-shrink-0 font-mono text-[11px] text-[var(--tx4)] w-20">
                    {f.is_dir ? '—' : formatBytes(f.size)}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(f);
                        onPreviewSingleFile?.(f);
                      }}
                      className="p-1 rounded hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-blue-400 transition-colors"
                      title="Preview single file"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => invoke('show_in_file_manager', { path: f.path })}
                      className="p-1 rounded hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-amber-400 transition-colors"
                      title="Show in Explorer"
                    >
                      <FolderSearch className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSelectPath(f, true)}
                      className="p-1 rounded hover:bg-rose-500/20 text-[var(--tx4)] hover:text-rose-400 transition-colors"
                      title="Remove from batch selection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {isDeleting && (
        <DeleteConfirmDialog
          isOpen={true}
          onClose={() => setIsDeleting(false)}
          targetPaths={selectedPaths}
        />
      )}
    </div>
  );
};
