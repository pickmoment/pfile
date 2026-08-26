import React from 'react';
import { Radio, CheckCircle, FileText } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { formatBytes } from '../../utils/formatters';

export const StatusBar: React.FC = () => {
  const watcherActive = useFileStore((s) => s.watcherActive);
  const selectedFile = useFileStore((s) => s.selectedFile);
  const files = useFileStore((s) => s.files);

  return (
    <footer className="h-6 bg-[var(--s3)] border-t border-[var(--bd2)] px-3 flex items-center justify-between text-[11px] text-[var(--tx4)] font-mono select-none">
      {/* Left: Watcher Status */}
      <div className="flex items-center gap-3">
        <div
          title="Real-time file changes are automatically watched and updated"
          className="flex items-center gap-1.5 text-[var(--tx3)]"
        >
          {watcherActive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 font-medium">Live Watcher Active</span>
            </>
          ) : (
            <>
              <Radio className="w-3 h-3 text-[var(--tx5)]" />
              <span className="text-[var(--tx5)]">Watcher Idle</span>
            </>
          )}
        </div>

        <span className="text-[var(--tx7)]">|</span>

        {/* Selected / Directory Info */}
        <div className="flex items-center gap-1 text-[var(--tx4)]">
          {selectedFile ? (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-sky-400" />
              <span className="text-[var(--tx2)]">{selectedFile.name}</span>
              <span className="text-[var(--tx5)]">({formatBytes(selectedFile.size)})</span>
            </span>
          ) : (
            <span>{files.length} items</span>
          )}
        </div>
      </div>

      {/* Center: Keyboard Shortcuts Mini Hint */}
      <div className="hidden lg:flex items-center gap-3 text-[10.5px] text-[var(--tx5)]">
        <span><kbd className="bg-[var(--bg-muted)] px-1 py-0.2 rounded text-[var(--tx3)]">Ctrl+P</kbd> Quick Jump</span>
        <span><kbd className="bg-[var(--bg-muted)] px-1 py-0.2 rounded text-[var(--tx3)]">Ctrl+L</kbd> Path</span>
        <span><kbd className="bg-[var(--bg-muted)] px-1 py-0.2 rounded text-[var(--tx3)]">F2</kbd> Rename</span>
        <span><kbd className="bg-[var(--bg-muted)] px-1 py-0.2 rounded text-[var(--tx3)]">Del</kbd> Delete</span>
        <span><kbd className="bg-[var(--bg-muted)] px-1 py-0.2 rounded text-[var(--tx3)]">Ctrl+F</kbd> Search</span>
        <span><kbd className="bg-[var(--bg-muted)] px-1 py-0.2 rounded text-[var(--tx3)]">Ctrl+⇧+F</kbd> Focus</span>
      </div>

      {/* Right: Encoding and Format */}
      <div className="flex items-center gap-3">
        <span className="text-[var(--tx4)]">UTF-8</span>
        <span className="text-[var(--tx7)]">|</span>
        <span className="flex items-center gap-1 text-[var(--tx4)]">
          <CheckCircle className="w-3 h-3 text-blue-400" />
          <span>LF / CRLF</span>
        </span>
      </div>
    </footer>
  );
};
