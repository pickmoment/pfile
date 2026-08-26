import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, MoreVertical, Edit2, Trash2, FolderSearch } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { FileMetadata } from '../../types/file';
import { getFileIcon } from '../../utils/fileIcons';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';
import { useGitStore } from '../../store/useGitStore';

interface FileTreeNodeProps {
  file: FileMetadata;
  depth?: number;
  onContextMenu: (e: React.MouseEvent, file: FileMetadata) => void;
  onRenameRequest: (file: FileMetadata) => void;
  onDeleteRequest: (file: FileMetadata) => void;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  file,
  depth = 0,
  onContextMenu,
  onRenameRequest,
  onDeleteRequest,
}) => {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const setSelectedFile = useFileStore((s) => s.setSelectedFile);
  const expandedDirs = useFileStore((s) => s.expandedDirs);
  const toggleDirExpanded = useFileStore((s) => s.toggleDirExpanded);
  const dirCache = useFileStore((s) => s.dirCache);
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const categoryFilter = useFileStore((s) => s.categoryFilter);
  const showHiddenFiles = useFileStore((s) => s.showHiddenFiles);
  const showToast = useToastStore((s) => s.showToast);
  const gitFileStatus = useGitStore((s) => s.files.find((f) => f.abs_path === file.path));

  const [isInlineRenaming, setIsInlineRenaming] = useState(false);
  const [inlineName, setInlineName] = useState(file.name);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const isSelected = selectedFile?.path === file.path;
  const isExpanded = expandedDirs.has(file.path);
  const childFiles = file.is_dir ? dirCache[file.path] || [] : [];

  useEffect(() => {
    if (isInlineRenaming) {
      setInlineName(file.name);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const dotIdx = file.name.lastIndexOf('.');
          if (!file.is_dir && dotIdx > 0) {
            inputRef.current.setSelectionRange(0, dotIdx);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isInlineRenaming, file.name, file.is_dir]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.is_dir) {
      toggleDirExpanded(file.path);
    } else {
      setSelectedFile(file);
    }
  };

  const handleInlineRenameSubmit = async () => {
    const trimmed = inlineName.trim();
    if (!trimmed || trimmed === file.name) {
      setIsInlineRenaming(false);
      return;
    }

    try {
      await invoke('rename_item', { sourcePath: file.path, newName: trimmed });
      showToast('Renamed', `Renamed to "${trimmed}"`, 'success');
      await refreshDirectory();
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Rename failed';
      showToast('Error', msg, 'error');
    } finally {
      setIsInlineRenaming(false);
    }
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', file.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (file.is_dir) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!file.is_dir) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const sourcePath = e.dataTransfer.getData('text/plain');
    if (sourcePath && sourcePath !== file.path) {
      try {
        await invoke('move_items', {
          sources: [sourcePath],
          targetDir: file.path,
        });
        showToast('Moved', `Moved to ${file.name}`, 'success');
        await refreshDirectory();
      } catch (err: unknown) {
        const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Move failed';
        showToast('Error', msg, 'error');
      }
    }
  };

  // Filter child files
  const filteredChildren = childFiles.filter((child) => {
    if (!showHiddenFiles && (child.is_hidden || child.name.startsWith('.'))) {
      return false;
    }
    if (searchQuery) {
      const matchesSearch = child.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch && !child.is_dir) return false;
    }
    if (categoryFilter !== 'ALL' && !child.is_dir) {
      if (categoryFilter === 'MD' && child.category !== 'markdown') return false;
      if (categoryFilter === 'CODE' && child.category !== 'code') return false;
      if (categoryFilter === 'HTML' && child.category !== 'html') return false;
      if (categoryFilter === 'DATA' && child.category !== 'data') return false;
      if (
        categoryFilter === 'MEDIA' &&
        child.category !== 'image' &&
        child.category !== 'audio' &&
        child.category !== 'video'
      )
        return false;
    }
    return true;
  });

  return (
    <div className="select-none text-xs">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, file);
        }}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`group relative flex items-center py-1.5 pr-2 rounded-md cursor-pointer transition-colors ${
          file.is_hidden || file.name.startsWith('.') ? 'opacity-70 hover:opacity-100' : ''
        } ${
          isSelected
            ? 'bg-[var(--selected-bg)] text-[var(--selected-text)] font-medium border-l-2 border-[var(--selected-border)]'
            : 'text-[var(--tx3)] hover:bg-[var(--s6)] hover:text-[var(--tx1)]'
        } ${isDragOver ? 'bg-[var(--info-bg)] ring-1 ring-[var(--selected-border)]' : ''}`}
      >
        {/* Left: Chevron + Icon + Name — fills all available width */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          {file.is_dir ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleDirExpanded(file.path);
              }}
              className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-[var(--tx2)] transition-transform"
            >
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  isExpanded ? 'rotate-90 text-[var(--warning-text)]' : ''
                }`}
              />
            </button>
          ) : (
            <div className="w-3.5 flex-shrink-0" />
          )}

          <span className="flex-shrink-0">{getFileIcon(file.category, file.extension, file.is_dir, isExpanded, 'w-4 h-4')}</span>

          {isInlineRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={inlineName}
              onChange={(e) => setInlineName(e.target.value)}
              onBlur={handleInlineRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInlineRenameSubmit();
                if (e.key === 'Escape') setIsInlineRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="px-1 py-0.5 text-xs bg-[var(--s1)] border border-[var(--selected-border)] rounded text-[var(--tx1)] font-mono focus:outline-none flex-1 min-w-0"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsInlineRenaming(true);
              }}
              className="truncate font-mono text-[11.5px] flex-1 min-w-0"
              title={file.name}
            >
              {file.name}
            </span>
          )}

          {/* Git badge — sits right after name, hidden on hover when actions appear */}
          {gitFileStatus && (
            <span
              className={`flex-shrink-0 font-mono font-bold text-[9px] px-1 rounded ml-auto group-hover:hidden ${
                gitFileStatus.worktree_status === 'conflicted' ? 'text-[var(--git-conflict)] bg-[var(--git-deleted-bg)]' :
                gitFileStatus.index_status ? 'text-[var(--git-staged)] bg-[var(--git-staged-bg)]' :
                gitFileStatus.worktree_status === 'untracked' ? 'text-[var(--git-untracked)] bg-[var(--s7)]' :
                gitFileStatus.worktree_status === 'deleted' ? 'text-[var(--git-deleted)] bg-[var(--git-deleted-bg)]' :
                'text-[var(--git-modified)] bg-[var(--git-modified-bg)]'
              }`}
              title={`Index: ${gitFileStatus.index_status ?? '—'}  Work: ${gitFileStatus.worktree_status ?? '—'}`}
            >
              {gitFileStatus.worktree_status === 'conflicted' ? 'C' :
               gitFileStatus.worktree_status === 'untracked' ? '?' :
               gitFileStatus.worktree_status === 'deleted' ? 'D' :
               gitFileStatus.worktree_status === 'modified' ? 'M' :
               gitFileStatus.index_status === 'added' ? 'A' :
               gitFileStatus.index_status === 'modified' ? 'M' :
               gitFileStatus.index_status === 'deleted' ? 'D' :
               gitFileStatus.index_status === 'renamed' ? 'R' : '·'}
            </span>
          )}
        </div>

        {/* Action buttons — hidden by default, appear on hover with bg to cover text underneath */}
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0 ml-1 bg-[var(--s6)] rounded px-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRenameRequest(file);
            }}
            title="Rename (F2)"
            className="p-0.5 rounded hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)]"
          >
            <Edit2 className="w-3 h-3" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              invoke('show_in_file_manager', { path: file.path });
            }}
            title="Show in Explorer"
            className="p-0.5 rounded hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)]"
          >
            <FolderSearch className="w-3 h-3" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRequest(file);
            }}
            title="Delete"
            className="p-0.5 rounded hover:bg-[var(--danger-bg)] text-[var(--tx4)] hover:text-[var(--danger-text)]"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, file);
            }}
            className="p-0.5 rounded hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)]"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Recursive Children Rendering */}
      {file.is_dir && isExpanded && (
        <div className="flex flex-col">
          {filteredChildren.length === 0 ? (
            <div
              style={{ paddingLeft: `${(depth + 1) * 14 + 14}px` }}
              className="py-1 text-[10.5px] text-[var(--tx6)] italic"
            >
              (empty)
            </div>
          ) : (
            filteredChildren.map((child) => (
              <FileTreeNode
                key={child.path}
                file={child}
                depth={depth + 1}
                onContextMenu={onContextMenu}
                onRenameRequest={onRenameRequest}
                onDeleteRequest={onDeleteRequest}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
