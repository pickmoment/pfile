import React from 'react';
import { Sparkles, Copy, Folder, Sun, Moon } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';
import { useThemeStore } from '../../store/useThemeStore';

export const TitleBar: React.FC = () => {
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const showToast = useToastStore((s) => s.showToast);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const handleCopyPath = () => {
    if (currentDirectory) {
      navigator.clipboard.writeText(currentDirectory);
      showToast('Copied', 'Directory path copied to clipboard', 'info');
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-9 bg-[var(--s4)] border-b border-[var(--bd2)] flex items-center justify-between px-3 select-none text-xs text-[var(--tx3)] font-sans"
    >
      {/* Left: App Branding */}
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
          <Sparkles className="w-3 h-3" />
        </div>
        <span className="font-semibold text-[var(--tx1)] tracking-tight">pfile</span>
        <span className="text-[10px] text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-1.5 py-0.2 rounded font-mono">
          AI Explorer
        </span>
      </div>

      {/* Center: Current Directory Path Pill */}
      {currentDirectory ? (
        <div
          onClick={handleCopyPath}
          title="Click to copy full path"
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[var(--s6)] hover:bg-[var(--s7)] border border-[var(--bd1)] text-[var(--tx3)] hover:text-[var(--tx1)] cursor-pointer transition-colors text-[11px] font-mono max-w-md truncate"
        >
          <Folder className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="truncate">{currentDirectory}</span>
          <Copy className="w-2.5 h-2.5 text-[var(--tx4)] flex-shrink-0 ml-0.5" />
        </div>
      ) : (
        <div className="text-[11px] text-[var(--tx4)]">No folder open</div>
      )}

      {/* Right placeholder / status */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--tx4)]">
        <button
          onClick={toggleTheme}
          title="Toggle light/dark theme"
          className="p-1 rounded-md hover:bg-[var(--s6)] text-[var(--tx4)] hover:text-[var(--tx1)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
        <span>v0.1.0</span>
      </div>
    </div>
  );
};
