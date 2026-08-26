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
  Star,
  StarOff,
  Link,
} from 'lucide-react';
import { FileMetadata } from '../../types/file';
import { useFileStore } from '../../store/useFileStore';
import { useClipboardStore } from '../../store/useClipboardStore';
import { useToastStore } from '../../store/useToastStore';

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
  const favorites = useFileStore((s) => s.favorites);
  const addFavorite = useFileStore((s) => s.addFavorite);
  const removeFavorite = useFileStore((s) => s.removeFavorite);

  const clipboard = useClipboardStore((s) => s.clipboard);
  const copy = useClipboardStore((s) => s.copy);
  const cut = useClipboardStore((s) => s.cut);
  const clearClipboard = useClipboardStore((s) => s.clear);

  const showToast = useToastStore((s) => s.showToast);

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
  const menuHeight = 320;
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
      className="fixed z-50 w-52 bg-[#181c28] border border-slate-700/80 rounded-xl shadow-2xl py-1 text-xs text-slate-200 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-700/50"
    >
      {/* File info label */}
      <div className="px-3 py-1.5 text-[11px] font-medium text-slate-400 truncate">
        {file.name}
      </div>

      {/* Path actions */}
      <div className="py-1">
        <button
          onClick={handleCopyPath}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-blue-600/20 hover:text-blue-300 text-left transition-colors"
        >
          <Link className="w-3.5 h-3.5 text-slate-400" />
          <span>Copy Absolute Path</span>
        </button>
        <button
          onClick={handleCopyRelativePath}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-blue-600/20 hover:text-blue-300 text-left transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-slate-400" />
          <span>Copy Relative Path</span>
        </button>
      </div>

      {/* System actions */}
      <div className="py-1">
        <button
          onClick={handleShowInExplorer}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-700/50 text-left transition-colors"
        >
          <FolderSearch className="w-3.5 h-3.5 text-amber-400" />
          <span>Show in File Manager</span>
        </button>
        <button
          onClick={handleOpenInDefaultApp}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-700/50 text-left transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
          <span>Open with Default App</span>
        </button>
        {file.is_dir && (
          <button
            onClick={() => {
              if (isFavorite) removeFavorite(file.path);
              else addFavorite(file.path);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-700/50 text-left transition-colors"
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
            copy([file.path]);
            showToast('Copied', `"${file.name}" copied`, 'info');
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/50 text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Ctrl+C</span>
        </button>
        <button
          onClick={() => {
            cut([file.path]);
            showToast('Cut', `"${file.name}" cut`, 'info');
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/50 text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-slate-400" />
            <span>Cut</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Ctrl+X</span>
        </button>
        {clipboard && (
          <button
            onClick={handlePaste}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/50 text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clipboard className="w-3.5 h-3.5 text-slate-400" />
              <span>Paste</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Ctrl+V</span>
          </button>
        )}
        <button
          onClick={() => {
            onClose();
            onRename(file);
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/50 text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Rename</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">F2</span>
        </button>
      </div>

      {/* Delete action */}
      <div className="py-1">
        <button
          onClick={() => {
            onClose();
            onDelete(file);
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-rose-600/20 text-rose-300 text-left transition-colors"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete...</span>
          </span>
          <span className="text-[10px] text-rose-400/60 font-mono">Del</span>
        </button>
      </div>
    </div>
  );
};
