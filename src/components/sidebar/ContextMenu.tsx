import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Copy,
  Scissors,
  Clipboard,
  Edit2,
  Trash2,
  ExternalLink,
  FolderSearch,
  FolderOpen,
  Star,
  StarOff,
  Link,
  Plus,
  Minus,
  Undo2,
  Sparkles,
  CheckSquare,
  X,
} from 'lucide-react';
import { FileMetadata } from '../../types/file';
import { useFileStore } from '../../store/useFileStore';
import { useClipboardStore } from '../../store/useClipboardStore';
import { useToastStore } from '../../store/useToastStore';
import { useGitStore } from '../../store/useGitStore';
import { generateBatchLlmContext } from '../../utils/llmPrompt';

export interface ContextMenuProps {
  x: number;
  y: number;
  file: FileMetadata;
  onClose: () => void;
  onRename: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  file,
  onClose,
  onRename,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);
  const setCurrentDirectory = useFileStore((s) => s.setCurrentDirectory);
  const favorites = useFileStore((s) => s.favorites);
  const addFavorite = useFileStore((s) => s.addFavorite);
  const removeFavorite = useFileStore((s) => s.removeFavorite);
  const selectedPaths = useFileStore((s) => s.selectedPaths);
  const getSelectedFiles = useFileStore((s) => s.getSelectedFiles);
  const clearSelection = useFileStore((s) => s.clearSelection);

  const clipboard = useClipboardStore((s) => s.clipboard);
  const copy = useClipboardStore((s) => s.copy);
  const cut = useClipboardStore((s) => s.cut);
  const clearClipboard = useClipboardStore((s) => s.clear);

  const showToast = useToastStore((s) => s.showToast);

  const isRepo = useGitStore((s) => s.isRepo);
  const gitFiles = useGitStore((s) => s.files);
  const stageFiles = useGitStore((s) => s.stageFiles);
  const unstageFiles = useGitStore((s) => s.unstageFiles);
  const discardFiles = useGitStore((s) => s.discardFiles);

  const isFavorite = favorites.includes(file.path);
  const isMulti = selectedPaths.length > 1 && selectedPaths.includes(file.path);
  const targetPaths = isMulti ? selectedPaths : [file.path];

  const [isCopyingLlm, setIsCopyingLlm] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust positioning if near window borders
  const menuWidth = 220;
  const menuHeight = isMulti ? 380 : file.is_dir ? 400 : 380;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 12);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 12);

  const handleCopyPath = () => {
    if (isMulti) {
      const text = targetPaths.join('\n');
      navigator.clipboard.writeText(text);
      showToast('Copied Paths', `${targetPaths.length} absolute paths copied`, 'info');
    } else {
      navigator.clipboard.writeText(file.path);
      showToast('Copied Path', file.path, 'info');
    }
    onClose();
  };

  const handleCopyRelativePath = () => {
    if (isMulti) {
      const rels = targetPaths.map((p) => {
        if (currentDirectory && p.startsWith(currentDirectory)) {
          return p.slice(currentDirectory.length).replace(/^\//, '');
        }
        return p;
      });
      navigator.clipboard.writeText(rels.join('\n'));
      showToast('Copied Relative Paths', `${rels.length} relative paths copied`, 'info');
    } else {
      let rel = file.path;
      if (currentDirectory && file.path.startsWith(currentDirectory)) {
        rel = file.path.slice(currentDirectory.length).replace(/^\//, '');
      }
      navigator.clipboard.writeText(rel);
      showToast('Copied Relative Path', rel, 'info');
    }
    onClose();
  };

  const handleCopyLlmContext = async () => {
    setIsCopyingLlm(true);
    try {
      const filesToProcess = isMulti ? getSelectedFiles() : [file];
      const result = await generateBatchLlmContext(filesToProcess);

      if (!result.prompt) {
        showToast('No Text Content', 'Selected items did not contain readable text', 'warning');
        onClose();
        return;
      }

      await navigator.clipboard.writeText(result.prompt);
      showToast(
        'Copied LLM Prompt',
        `${result.fileCount} file(s) formatted (~${result.totalTokens} tokens)`,
        'success'
      );
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to generate LLM context';
      showToast('Error', msg, 'error');
    } finally {
      setIsCopyingLlm(false);
      onClose();
    }
  };

  const handleNavigateToFolder = async () => {
    if (!file.is_dir) return;
    try {
      await setCurrentDirectory(file.path);
      showToast('Opened Folder', file.path, 'info');
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to open folder';
      showToast('Error', msg, 'error');
    }
    onClose();
  };

  const handleShowInExplorer = async () => {
    try {
      await invoke('show_in_file_manager', { path: file.path });
    } catch {
      showToast('Error', 'Failed to open file manager', 'error');
    }
    onClose();
  };

  const handleOpenInDefaultApp = async () => {
    try {
      for (const p of targetPaths) {
        await invoke('open_in_default_app', { path: p });
      }
    } catch {
      showToast('Error', 'Failed to open in default app', 'error');
    }
    onClose();
  };

  const handlePaste = async () => {
    if (!clipboard || clipboard.paths.length === 0) return;
    const targetDir = !isMulti && file.is_dir ? file.path : currentDirectory;
    try {
      if (clipboard.type === 'copy') {
        await invoke('copy_items', {
          sources: clipboard.paths,
          targetDir,
        });
        showToast('Pasted', `Copied ${clipboard.paths.length} item(s)`, 'success');
      } else {
        await invoke('move_items', {
          sources: clipboard.paths,
          targetDir,
        });
        clearClipboard();
        showToast('Moved', `Moved ${clipboard.paths.length} item(s)`, 'success');
      }
      await refreshDirectory();
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Paste failed';
      showToast('Error', msg, 'error');
    }
    onClose();
  };

  // Git statuses for targets
  const relevantGitStatuses = isRepo
    ? gitFiles.filter((f) => targetPaths.includes(f.abs_path))
    : [];

  const stageableGitPaths = relevantGitStatuses
    .filter((f) => f.worktree_status && f.worktree_status !== 'ignored' && !f.index_status)
    .map((f) => f.path);

  const unstageableGitPaths = relevantGitStatuses
    .filter((f) => f.index_status)
    .map((f) => f.path);

  const discardableGitPaths = relevantGitStatuses
    .filter((f) => f.worktree_status && f.worktree_status !== 'untracked' && f.worktree_status !== 'ignored')
    .map((f) => f.path);

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-50 w-56 bg-[var(--s6)] border border-[var(--bd1)] rounded-xl shadow-2xl py-1 text-xs text-[var(--tx2)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 divide-y divide-[var(--bd1)] select-none"
    >
      {/* Menu Header */}
      <div className="px-3 py-1.5 text-[11px] font-medium text-[var(--tx4)] flex items-center justify-between">
        {isMulti ? (
          <span className="flex items-center gap-1.5 text-blue-400 font-semibold truncate">
            <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{selectedPaths.length} items selected</span>
          </span>
        ) : (
          <span className="truncate">{file.name}</span>
        )}
      </div>

      {/* AI & Quick Batch actions */}
      <div className="py-1">
        <button
          onClick={handleCopyLlmContext}
          disabled={isCopyingLlm}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 text-left transition-colors font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{isCopyingLlm ? 'Formatting...' : isMulti ? 'Copy All for LLM Prompt' : 'Copy for LLM Prompt'}</span>
        </button>
      </div>

      {/* Path actions */}
      <div className="py-1">
        <button
          onClick={handleCopyPath}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--info-bg)] hover:text-[var(--info-text)] text-left transition-colors"
        >
          <Link className="w-3.5 h-3.5 text-[var(--tx4)]" />
          <span>{isMulti ? 'Copy All Absolute Paths' : 'Copy Absolute Path'}</span>
        </button>
        <button
          onClick={handleCopyRelativePath}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--info-bg)] hover:text-[var(--info-text)] text-left transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-[var(--tx4)]" />
          <span>{isMulti ? 'Copy All Relative Paths' : 'Copy Relative Path'}</span>
        </button>
      </div>

      {/* System actions */}
      <div className="py-1">
        {!isMulti && file.is_dir && (
          <button
            onClick={handleNavigateToFolder}
            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--info-bg)] hover:text-[var(--info-text)] text-left transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Open Folder</span>
          </button>
        )}
        <button
          onClick={handleShowInExplorer}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--s7)] text-left transition-colors"
        >
          <FolderSearch className="w-3.5 h-3.5 text-amber-400" />
          <span>Show in File Manager</span>
        </button>
        <button
          onClick={handleOpenInDefaultApp}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--s7)] text-left transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isMulti ? `Open with Default App (${targetPaths.length})` : 'Open with Default App'}</span>
        </button>
        {!isMulti && (
          <button
            onClick={() => {
              if (isFavorite) removeFavorite(file.path);
              else addFavorite(file.path);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--s7)] text-left transition-colors"
          >
            {isFavorite ? (
              <>
                <StarOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Remove from Favorites</span>
              </>
            ) : (
              <>
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>Pin to Favorites</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Clipboard & Editing actions */}
      <div className="py-1">
        <button
          onClick={() => {
            copy(targetPaths);
            showToast(
              'Copied',
              isMulti ? `${targetPaths.length} items copied` : `"${file.name}" copied`,
              'info'
            );
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--s7)] text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-[var(--tx4)]" />
            <span>{isMulti ? `Copy (${targetPaths.length})` : 'Copy'}</span>
          </span>
          <span className="text-[10px] text-[var(--tx5)] font-mono">Ctrl+C</span>
        </button>
        <button
          onClick={() => {
            cut(targetPaths);
            showToast(
              'Cut',
              isMulti ? `${targetPaths.length} items cut` : `"${file.name}" cut`,
              'info'
            );
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--s7)] text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-[var(--tx4)]" />
            <span>{isMulti ? `Cut (${targetPaths.length})` : 'Cut'}</span>
          </span>
          <span className="text-[10px] text-[var(--tx5)] font-mono">Ctrl+X</span>
        </button>
        {clipboard && (
          <button
            onClick={handlePaste}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--s7)] text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clipboard className="w-3.5 h-3.5 text-[var(--tx4)]" />
              <span>Paste</span>
            </span>
            <span className="text-[10px] text-[var(--tx5)] font-mono">Ctrl+V</span>
          </button>
        )}
        {!isMulti && (
          <button
            onClick={() => {
              onClose();
              onRename(file);
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--s7)] text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <Edit2 className="w-3.5 h-3.5 text-[var(--tx4)]" />
              <span>Rename</span>
            </span>
            <span className="text-[10px] text-[var(--tx5)] font-mono">F2</span>
          </button>
        )}
      </div>

      {/* Git actions */}
      {isRepo && (stageableGitPaths.length > 0 || unstageableGitPaths.length > 0 || discardableGitPaths.length > 0) && (
        <div className="py-1">
          {stageableGitPaths.length > 0 && (
            <button
              onClick={async () => {
                if (currentDirectory) {
                  await stageFiles(currentDirectory, stageableGitPaths);
                  showToast('Staged', `${stageableGitPaths.length} file(s) staged`, 'success');
                }
                onClose();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--success-bg)] hover:text-[var(--success-text)] text-left transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isMulti ? `Stage (${stageableGitPaths.length})` : 'Stage File'}</span>
            </button>
          )}
          {unstageableGitPaths.length > 0 && (
            <button
              onClick={async () => {
                if (currentDirectory) {
                  await unstageFiles(currentDirectory, unstageableGitPaths);
                  showToast('Unstaged', `${unstageableGitPaths.length} file(s) unstaged`, 'info');
                }
                onClose();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--warning-bg)] hover:text-[var(--warning-text)] text-left transition-colors"
            >
              <Minus className="w-3.5 h-3.5 text-amber-400" />
              <span>{isMulti ? `Unstage (${unstageableGitPaths.length})` : 'Unstage File'}</span>
            </button>
          )}
          {discardableGitPaths.length > 0 && (
            <button
              onClick={async () => {
                if (currentDirectory) {
                  await discardFiles(currentDirectory, discardableGitPaths);
                  showToast('Discarded', `Changes to ${discardableGitPaths.length} file(s) discarded`, 'warning');
                  refreshDirectory();
                }
                onClose();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] text-left transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{isMulti ? `Discard Changes (${discardableGitPaths.length})` : 'Discard Changes'}</span>
            </button>
          )}
        </div>
      )}

      {/* Multi-selection clear action */}
      {isMulti && (
        <div className="py-1">
          <button
            onClick={() => {
              clearSelection();
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--s7)] text-left transition-colors text-[var(--tx3)]"
          >
            <span className="flex items-center gap-2">
              <X className="w-3.5 h-3.5" />
              <span>Clear Selection</span>
            </span>
            <span className="text-[10px] text-[var(--tx5)] font-mono">Esc</span>
          </button>
        </div>
      )}

      {/* Delete action */}
      <div className="py-1">
        <button
          onClick={() => {
            onClose();
            onDelete(file);
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--danger-bg)] text-[var(--danger-text)] text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>{isMulti ? `Delete (${targetPaths.length} items)...` : 'Delete...'}</span>
          </span>
          <span className="text-[10px] text-[var(--danger-text)] opacity-60 font-mono">Del</span>
        </button>
      </div>
    </div>
  );
};
