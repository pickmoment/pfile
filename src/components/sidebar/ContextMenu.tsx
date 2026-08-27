import React, { useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { FileMetadata } from '../../types/file';
import { useFileStore } from '../../store/useFileStore';
import { useClipboardStore } from '../../store/useClipboardStore';
import { useToastStore } from '../../store/useToastStore';
import { useGitStore } from '../../store/useGitStore';

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

  const clipboard = useClipboardStore((s) => s.clipboard);
  const copy = useClipboardStore((s) => s.copy);
  const cut = useClipboardStore((s) => s.cut);
  const clearClipboard = useClipboardStore((s) => s.clear);

  const showToast = useToastStore((s) => s.showToast);

  const isRepo = useGitStore((s) => s.isRepo);
  const gitFileStatus = useGitStore((s) => s.files.find((f) => f.abs_path === file.path));
  const stageFiles = useGitStore((s) => s.stageFiles);
  const unstageFiles = useGitStore((s) => s.unstageFiles);
  const discardFiles = useGitStore((s) => s.discardFiles);

  const isFavorite = favorites.includes(file.path);

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
  const menuWidth = 200;
  const menuHeight = file.is_dir ? 360 : 320;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.path);
    showToast('Copied Path', file.path, 'info');
    onClose();
  };

  const handleCopyRelativePath = () => {
    let rel = file.path;
    if (currentDirectory && file.path.startsWith(currentDirectory)) {
      rel = file.path.slice(currentDirectory.length).replace(/^\//, '');
    }
    navigator.clipboard.writeText(rel);
    showToast('Copied Relative Path', rel, 'info');
    onClose();
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
    } catch (err: unknown) {
      showToast('Error', 'Failed to open file manager', 'error');
    }
    onClose();
  };

  const handleOpenInDefaultApp = async () => {
    try {
      await invoke('open_in_default_app', { path: file.path });
    } catch (err: unknown) {
      showToast('Error', 'Failed to open in default app', 'error');
    }
    onClose();
  };

  const handlePaste = async () => {
    if (!clipboard || clipboard.paths.length === 0) return;
    const targetDir = file.is_dir ? file.path : currentDirectory;
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

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-50 w-52 bg-[var(--s6)] border border-[var(--bd1)] rounded-xl shadow-2xl py-1 text-xs text-[var(--tx2)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 divide-y divide-[var(--bd1)]"
    >
      {/* File info label */}
      <div className="px-3 py-1.5 text-[11px] font-medium text-[var(--tx4)] truncate">
        {file.name}
      </div>

      {/* Path actions */}
      <div className="py-1">
        <button
          onClick={handleCopyPath}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--info-bg)] hover:text-[var(--info-text)] text-left transition-colors"
        >
          <Link className="w-3.5 h-3.5 text-[var(--tx4)]" />
          <span>Copy Absolute Path</span>
        </button>
        <button
          onClick={handleCopyRelativePath}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--info-bg)] hover:text-[var(--info-text)] text-left transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-[var(--tx4)]" />
          <span>Copy Relative Path</span>
        </button>
      </div>

      {/* System actions */}
      <div className="py-1">
        {file.is_dir && (
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
          <span>Open with Default App</span>
        </button>
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
      </div>

      {/* Clipboard & Editing actions */}
      <div className="py-1">
        <button
          onClick={() => {
            copy([file.path]);
            showToast('Copied', `"${file.name}" copied`, 'info');
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--s7)] text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-[var(--tx4)]" />
            <span>Copy</span>
          </span>
          <span className="text-[10px] text-[var(--tx5)] font-mono">Ctrl+C</span>
        </button>
        <button
          onClick={() => {
            cut([file.path]);
            showToast('Cut', `"${file.name}" cut`, 'info');
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--s7)] text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-[var(--tx4)]" />
            <span>Cut</span>
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
      </div>

      {/* Git actions */}
      {isRepo && gitFileStatus && (
        <div className="py-1">
          {gitFileStatus.worktree_status && gitFileStatus.worktree_status !== 'ignored' && !gitFileStatus.index_status && (
            <button
              onClick={async () => {
                if (currentDirectory) {
                  await stageFiles(currentDirectory, [gitFileStatus.path]);
                  showToast('Staged', `"${file.name}" staged`, 'success');
                }
                onClose();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--success-bg)] hover:text-[var(--success-text)] text-left transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Stage File</span>
            </button>
          )}
          {gitFileStatus.index_status && (
            <button
              onClick={async () => {
                if (currentDirectory) {
                  await unstageFiles(currentDirectory, [gitFileStatus.path]);
                  showToast('Unstaged', `"${file.name}" unstaged`, 'info');
                }
                onClose();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--warning-bg)] hover:text-[var(--warning-text)] text-left transition-colors"
            >
              <Minus className="w-3.5 h-3.5 text-amber-400" />
              <span>Unstage File</span>
            </button>
          )}
          {gitFileStatus.worktree_status && gitFileStatus.worktree_status !== 'untracked' && gitFileStatus.worktree_status !== 'ignored' && (
            <button
              onClick={async () => {
                if (currentDirectory) {
                  await discardFiles(currentDirectory, [gitFileStatus.path]);
                  showToast('Discarded', `Changes to "${file.name}" discarded`, 'warning');
                  refreshDirectory();
                }
                onClose();
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] text-left transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Discard Changes</span>
            </button>
          )}
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
            <span>Delete...</span>
          </span>
          <span className="text-[10px] text-[var(--danger-text)] opacity-60 font-mono">Del</span>
        </button>
      </div>
    </div>
  );
};
