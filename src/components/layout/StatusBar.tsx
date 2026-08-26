import React from 'react';
import { Radio, CheckCircle, FileText } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { formatBytes } from '../../utils/formatters';

export const StatusBar: React.FC = () => {
  const watcherActive = useFileStore((s) => s.watcherActive);
  const selectedFile = useFileStore((s) => s.selectedFile);
  const files = useFileStore((s) => s.files);

  return (
    <footer className="h-6 bg-[#0f1118] border-t border-slate-800/80 px-3 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
      {/* Left: Watcher Status */}
      <div className="flex items-center gap-3">
        <div
          title="Real-time file changes are automatically watched and updated"
          className="flex items-center gap-1.5 text-slate-300"
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
              <Radio className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500">Watcher Idle</span>
            </>
          )}
        </div>

        <span className="text-slate-700">|</span>

        {/* Selected / Directory Info */}
        <div className="flex items-center gap-1 text-slate-400">
          {selectedFile ? (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-sky-400" />
              <span className="text-slate-200">{selectedFile.name}</span>
              <span className="text-slate-500">({formatBytes(selectedFile.size)})</span>
            </span>
          ) : (
            <span>{files.length} items</span>
          )}
        </div>
      </div>

      {/* Center: Keyboard Shortcuts Mini Hint */}
      <div className="hidden lg:flex items-center gap-3 text-[10.5px] text-slate-500">
        <span><kbd className="bg-slate-800 px-1 py-0.2 rounded text-slate-300">Ctrl+P</kbd> Quick Jump</span>
        <span><kbd className="bg-slate-800 px-1 py-0.2 rounded text-slate-300">Ctrl+L</kbd> Path</span>
        <span><kbd className="bg-slate-800 px-1 py-0.2 rounded text-slate-300">F2</kbd> Rename</span>
        <span><kbd className="bg-slate-800 px-1 py-0.2 rounded text-slate-300">Del</kbd> Delete</span>
        <span><kbd className="bg-slate-800 px-1 py-0.2 rounded text-slate-300">Ctrl+F</kbd> Search</span>
      </div>

      {/* Right: Encoding and Format */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400">UTF-8</span>
        <span className="text-slate-700">|</span>
        <span className="flex items-center gap-1 text-slate-400">
          <CheckCircle className="w-3 h-3 text-blue-400" />
          <span>LF / CRLF</span>
        </span>
      </div>
    </footer>
  );
};
