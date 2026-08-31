import React, { useState, useMemo, useRef } from 'react';
import { FileTreeNode } from './FileTreeNode';
import { ContextMenu } from './ContextMenu';
import { RenameDialog, DeleteConfirmDialog } from '../common/Dialogs';
import { FileMetadata } from '../../types/file';
import { useFileStore } from '../../store/useFileStore';
import { getVisibleFiles, isFileVisible } from '../../utils/fileTreeUtils';
import { FolderSearch, Sparkles, Search } from 'lucide-react';
export const FileTree: React.FC = () => {
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const files = useFileStore((s) => s.files);
  const dirCache = useFileStore((s) => s.dirCache);
  const expandedDirs = useFileStore((s) => s.expandedDirs);
  const selectedPaths = useFileStore((s) => s.selectedPaths);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const categoryFilter = useFileStore((s) => s.categoryFilter);
  const showHiddenFiles = useFileStore((s) => s.showHiddenFiles);
  const isLoading = useFileStore((s) => s.isLoading);
  const setSelectedFile = useFileStore((s) => s.setSelectedFile);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileMetadata;
  } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileMetadata | null>(null);
  const [deleteTargetPaths, setDeleteTargetPaths] = useState<string[] | null>(null);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [directoryMatchIndex, setDirectoryMatchIndex] = useState(0);
  const treeRef = useRef<HTMLDivElement>(null);
  const lastDirectorySearchKeyAt = useRef(0);

  const handleContextMenu = (e: React.MouseEvent, file: FileMetadata) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file,
    });
  };

  // Compute visible flattened files for Shift+Click range selection and select all
  const visibleFiles = useMemo(
    () =>
      getVisibleFiles(
        files,
        dirCache,
        expandedDirs,
        showHiddenFiles,
        searchQuery,
        categoryFilter
      ),
    [files, dirCache, expandedDirs, showHiddenFiles, searchQuery, categoryFilter]
  );

  const directoryMatches = useMemo(() => {
    if (!directorySearchQuery) return [];
    const normalizedQuery = directorySearchQuery.toLocaleLowerCase();
    return visibleFiles.filter(
      (file) => file.is_dir && file.name.toLocaleLowerCase().includes(normalizedQuery)
    );
  }, [directorySearchQuery, visibleFiles]);

  const selectDirectoryMatch = (index: number, matches = directoryMatches) => {
    const match = matches[index];
    if (!match) return;

    setSelectedFile(match);
    requestAnimationFrame(() => {
      const rows = treeRef.current?.querySelectorAll<HTMLElement>('[data-file-path]');
      const row = Array.from(rows ?? []).find((element) => element.dataset.filePath === match.path);
      row?.scrollIntoView({ block: 'nearest' });
    });
  };

  const handleTreeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('.monaco-editor');
    if (isInput || e.nativeEvent.isComposing) return;

    if (e.key === 'Escape' && directorySearchQuery) {
      e.preventDefault();
      e.stopPropagation();
      setDirectorySearchQuery('');
      setDirectoryMatchIndex(0);
      lastDirectorySearchKeyAt.current = 0;
      return;
    }

    if ((e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') && directorySearchQuery) {
      e.preventDefault();
      e.stopPropagation();
      if (directoryMatches.length === 0) return;

      const direction = e.key === 'ArrowUp' ? -1 : 1;
      const nextIndex = (directoryMatchIndex + direction + directoryMatches.length) % directoryMatches.length;
      setDirectoryMatchIndex(nextIndex);
      selectDirectoryMatch(nextIndex);
      return;
    }

    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    const nextQuery = now - lastDirectorySearchKeyAt.current <= 1000
      ? directorySearchQuery + e.key
      : e.key;
    lastDirectorySearchKeyAt.current = now;

    const normalizedQuery = nextQuery.toLocaleLowerCase();
    const nextMatches = visibleFiles.filter(
      (file) => file.is_dir && file.name.toLocaleLowerCase().includes(normalizedQuery)
    );
    setDirectorySearchQuery(nextQuery);
    setDirectoryMatchIndex(0);
    selectDirectoryMatch(0, nextMatches);
  };

  const filteredFiles = files.filter((file) =>
    isFileVisible(file, showHiddenFiles, searchQuery, categoryFilter)
  );

  if (!currentDirectory) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-[var(--tx5)] h-full select-none">
        <FolderSearch className="w-10 h-10 mb-3 text-[var(--tx6)] stroke-[1.5]" />
        <p className="text-xs font-medium text-[var(--tx4)]">No directory open</p>
        <p className="text-[11px] text-[var(--tx6)] mt-1 max-w-[200px]">
          Click "Open Folder" above to explore your AI code & documents
        </p>
      </div>
    );
  }

  if (isLoading && files.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-[var(--tx5)] gap-2">
        <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
        <span className="text-xs">Loading directory...</span>
      </div>
    );
  }

  return (
    <div
      ref={treeRef}
      tabIndex={0}
      onMouseDown={() => treeRef.current?.focus()}
      onKeyDown={handleTreeKeyDown}
      className="relative flex-1 min-h-0 overflow-y-auto px-1 py-1 space-y-0.5 select-none outline-none"
    >
      {directorySearchQuery && (
        <div className="sticky top-1 z-10 flex items-center gap-1.5 mx-1 mb-1 px-2 py-1 rounded-md bg-[var(--s6)]/95 border border-[var(--bd1)] shadow-lg text-[10px] font-mono text-[var(--tx3)] pointer-events-none">
          <Search className="w-3 h-3 flex-shrink-0 text-[var(--info-text)]" />
          <span className="truncate">{directorySearchQuery}</span>
          <span className="text-[var(--tx5)] ml-auto whitespace-nowrap">
            {directoryMatches.length > 0
              ? `${directoryMatchIndex + 1}/${directoryMatches.length} · Enter next · Esc clear`
              : 'No directory · Esc clear'}
          </span>
        </div>
      )}

      {filteredFiles.length === 0 ? (
        <div className="p-6 text-center text-[var(--tx5)] text-xs">
          {searchQuery || categoryFilter !== 'ALL'
            ? 'No files matching current filter'
            : 'Directory is empty'}
        </div>
      ) : (
        filteredFiles.map((file) => (
          <FileTreeNode
            key={file.path}
            file={file}
            depth={0}
            visibleFiles={visibleFiles}
            onContextMenu={handleContextMenu}
            onRenameRequest={(f) => setRenameTarget(f)}
            onDeleteRequest={(f) => {
              if (selectedPaths.includes(f.path) && selectedPaths.length > 1) {
                setDeleteTargetPaths(selectedPaths);
              } else {
                setDeleteTargetPaths([f.path]);
              }
            }}
          />
        ))
      )}

      {/* Context Menu Popup */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu(null)}
          onRename={(f) => setRenameTarget(f)}
          onDelete={(f) => {
            if (selectedPaths.includes(f.path) && selectedPaths.length > 1) {
              setDeleteTargetPaths(selectedPaths);
            } else {
              setDeleteTargetPaths([f.path]);
            }
          }}
        />
      )}

      {/* Rename Dialog */}
      {renameTarget && (
        <RenameDialog
          isOpen={true}
          onClose={() => setRenameTarget(null)}
          sourcePath={renameTarget.path}
          currentName={renameTarget.name}
        />
      )}

      {/* Delete Dialog */}
      {deleteTargetPaths && (
        <DeleteConfirmDialog
          isOpen={true}
          onClose={() => setDeleteTargetPaths(null)}
          targetPaths={deleteTargetPaths}
        />
      )}
    </div>
  );
};
