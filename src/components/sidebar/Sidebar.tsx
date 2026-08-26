import React from 'react';
import { Favorites } from './Favorites';
import { FileTree } from './FileTree';
import { useFileStore } from '../../store/useFileStore';
import { HardDrive } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const files = useFileStore((s) => s.files);
  const currentDirectory = useFileStore((s) => s.currentDirectory);

  return (
    <aside className="w-full h-full bg-[#11131c] border-r border-slate-800/80 flex flex-col select-none overflow-hidden">
      {/* Pinned Favorites */}
      <Favorites />

      {/* Directory File Tree Header */}
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/40">
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-blue-400" />
          <span>Explorer</span>
        </div>
        {currentDirectory && (
          <span className="text-[10px] text-slate-500 font-mono lowercase">
            {files.length} items
          </span>
        )}
      </div>

      {/* File Tree List */}
      <FileTree />
    </aside>
  );
};
