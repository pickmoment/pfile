import React from 'react';
import { Sparkles, Copy, Folder } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';

export const TitleBar: React.FC = () => {
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const showToast = useToastStore((s) => s.showToast);

  const handleCopyPath = () => {
    if (currentDirectory) {
      navigator.clipboard.writeText(currentDirectory);
      showToast('Copied', 'Directory path copied to clipboard', 'info');
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-9 bg-[#11131c] border-b border-slate-800/80 flex items-center justify-between px-3 select-none text-xs text-slate-300 font-sans"
    >
      {/* Left: App Branding */}
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
          <Sparkles className="w-3 h-3" />
        </div>
        <span className="font-semibold text-slate-100 tracking-tight">pfile</span>
        <span className="text-[10px] text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-1.5 py-0.2 rounded font-mono">
          AI Explorer
        </span>
      </div>

      {/* Center: Current Directory Path Pill */}
      {currentDirectory ? (
        <div
          onClick={handleCopyPath}
          title="Click to copy full path"
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#181c28] hover:bg-[#202536] border border-slate-700/60 text-slate-300 hover:text-slate-100 cursor-pointer transition-colors text-[11px] font-mono max-w-md truncate"
        >
          <Folder className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="truncate">{currentDirectory}</span>
          <Copy className="w-2.5 h-2.5 text-slate-400 flex-shrink-0 ml-0.5" />
        </div>
      ) : (
        <div className="text-[11px] text-slate-400">No folder open</div>
      )}

      {/* Right placeholder / status */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>v0.1.0</span>
      </div>
    </div>
  );
};
