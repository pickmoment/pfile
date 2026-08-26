import React from 'react';
import { Favorites } from './Favorites';
import { FileTree } from './FileTree';
import { GitPanel } from './GitPanel';
import { useFileStore } from '../../store/useFileStore';
import { useGitStore } from '../../store/useGitStore';
import { HardDrive } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const files = useFileStore((s) => s.files);
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const isRepo = useGitStore((s) => s.isRepo);
  const gitPanelOpen = useGitStore((s) => s.gitPanelOpen);

  return (
    <aside className="w-full h-full bg-[var(--s4)] border-r border-[var(--bd2)] flex flex-col select-none overflow-hidden">
      {/* Pinned Favorites */}
      <Favorites />

      {/* Directory File Tree Header */}
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-[var(--tx4)] uppercase tracking-wider border-b border-[var(--bd2)]">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-blue-400" />
          <span>Explorer</span>
        </div>
        {currentDirectory && (
          <span className="text-[10px] text-[var(--tx5)] font-mono lowercase">
            {files.length} items
          </span>
        )}
      </div>

      {/* File Tree List — shrinks when git panel is open */}
      <div className={`${isRepo && gitPanelOpen ? 'flex-1 min-h-0 max-h-[50%]' : 'flex-1 min-h-0'} overflow-hidden`}>
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
