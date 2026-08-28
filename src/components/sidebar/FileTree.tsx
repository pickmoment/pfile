import React, { useState, useMemo } from 'react';
import { FileTreeNode } from './FileTreeNode';
import { ContextMenu } from './ContextMenu';
import { RenameDialog, DeleteConfirmDialog } from '../common/Dialogs';
import { FileMetadata } from '../../types/file';
import { useFileStore } from '../../store/useFileStore';
import { getVisibleFiles } from '../../utils/fileTreeUtils';
import { FolderSearch, Sparkles } from 'lucide-react';
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
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileMetadata;
  } | null>(null);

  // Rename Dialog State
  const [renameTarget, setRenameTarget] = useState<FileMetadata | null>(null);

  // Delete Dialog State
  const [deleteTargetPaths, setDeleteTargetPaths] = useState<string[] | null>(null);

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

  // Filter top-level items
  const filteredFiles = files.filter((file) => {
    // Hidden files check
    if (!showHiddenFiles && (file.is_hidden || file.name.startsWith('.'))) {
      return false;
    }

    if (searchQuery) {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch && !file.is_dir) return false;
    }
    if (categoryFilter !== 'ALL' && !file.is_dir) {
      if (categoryFilter === 'MD' && file.category !== 'markdown') return false;
      if (categoryFilter === 'CODE' && file.category !== 'code') return false;
      if (categoryFilter === 'HTML' && file.category !== 'html') return false;
      if (categoryFilter === 'DATA' && file.category !== 'data') return false;
      if (
        categoryFilter === 'MEDIA' &&
        file.category !== 'image' &&
        file.category !== 'audio' &&
        file.category !== 'video'
      )
        return false;
    }
    return true;
  });

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
    <div className="flex-1 min-h-0 overflow-y-auto px-1 py-1 space-y-0.5 select-none">
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
