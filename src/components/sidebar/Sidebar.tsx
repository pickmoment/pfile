import React from 'react';
import { Favorites } from './Favorites';
import { FileTree } from './FileTree';
import { GitPanel } from './GitPanel';
import { useFileStore } from '../../store/useFileStore';
import { useGitStore } from '../../store/useGitStore';
import { getVisibleFiles } from '../../utils/fileTreeUtils';
import { HardDrive, CheckSquare, X } from 'lucide-react';
export const Sidebar: React.FC = () => {
  const files = useFileStore((s) => s.files);
  const dirCache = useFileStore((s) => s.dirCache);
  const expandedDirs = useFileStore((s) => s.expandedDirs);
  const showHiddenFiles = useFileStore((s) => s.showHiddenFiles);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const categoryFilter = useFileStore((s) => s.categoryFilter);
  const selectedPaths = useFileStore((s) => s.selectedPaths);
  const selectAll = useFileStore((s) => s.selectAll);
  const clearSelection = useFileStore((s) => s.clearSelection);
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const isRepo = useGitStore((s) => s.isRepo);
  const gitPanelOpen = useGitStore((s) => s.gitPanelOpen);

  const handleSelectAll = () => {
    const visible = getVisibleFiles(
      files,
      dirCache,
      expandedDirs,
      showHiddenFiles,
      searchQuery,
      categoryFilter
    );
    selectAll(visible);
  };
  return (
    <aside className="w-full h-full bg-[var(--s4)] border-r border-[var(--bd2)] flex flex-col select-none overflow-hidden">
      {/* Pinned Favorites */}
      <Favorites />

      {/* Directory File Tree Header */}
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-[var(--tx4)] border-b border-[var(--bd2)]">
        <div className="flex items-center gap-1.5 uppercase tracking-wider">
          <HardDrive className="w-3.5 h-3.5 text-blue-400" />
          <span>Explorer</span>
        </div>

        {currentDirectory && (
          <div className="flex items-center gap-1.5">
            {selectedPaths.length > 0 ? (
              <>
                <span className="px-1.5 py-0.2 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded text-[10px] font-mono font-medium lowercase">
                  {selectedPaths.length} sel
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  title="Select All (Ctrl+A)"
                  className="p-1 rounded hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-[var(--tx1)] transition-colors"
                >
                  <CheckSquare className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  title="Clear Selection (Esc)"
                  className="p-1 rounded hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-rose-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <span className="text-[10px] text-[var(--tx5)] font-mono lowercase">
                  {files.length} items
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  title="Select All (Ctrl+A)"
                  className="p-1 rounded hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-[var(--tx1)] transition-colors"
                >
                  <CheckSquare className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* File Tree List — shrinks when git panel is open */}
      <div className={`${isRepo && gitPanelOpen ? 'flex-1 min-h-0 max-h-[50%]' : 'flex-1 min-h-0'} overflow-hidden flex flex-col`}>
        <FileTree />
      </div>

      {/* Git Panel — collapsible bottom section */}
      {isRepo && gitPanelOpen && (
        <div className="flex-1 min-h-0 border-t border-[var(--bd2)] overflow-hidden">
          <GitPanel />
        </div>
      )}
    </aside>
  );
};
