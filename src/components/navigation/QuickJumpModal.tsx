import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Folder,
  Home,
  Monitor,
  FileText,
  Download,
  HardDrive,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';
import { FileMetadata } from '../../types/file';
import { getFileIcon } from '../../utils/fileIcons';
import { formatBytes } from '../../utils/formatters';

export const QuickJumpModal: React.FC = () => {
  const isQuickJumpOpen = useFileStore((s) => s.isQuickJumpOpen);
  const setQuickJumpOpen = useFileStore((s) => s.setQuickJumpOpen);
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const jumpToPath = useFileStore((s) => s.jumpToPath);
  const quickPaths = useFileStore((s) => s.quickPaths);
  const recentDirectories = useFileStore((s) => s.recentDirectories);
  const showHiddenFiles = useFileStore((s) => s.showHiddenFiles);
  const showToast = useToastStore((s) => s.showToast);
  const setSelectedFile = useFileStore((s) => s.setSelectedFile);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileMetadata[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isQuickJumpOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isQuickJumpOpen]);

  // Search files when query changes
  useEffect(() => {
    if (!isQuickJumpOpen) return;

    let isMounted = true;
    const executeSearch = async () => {
      const trimmed = query.trim();
      if (!trimmed) {
        setResults([]);
        setSelectedIndex(0);
        return;
      }

      setIsSearching(true);
      try {
        const root = currentDirectory || '.';
        const matches: FileMetadata[] = await invoke('search_files_recursive', {
          rootPath: root,
          query: trimmed,
          maxResults: 30,
          includeHidden: showHiddenFiles,
        });
        if (isMounted) {
          setResults(matches);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.warn('Search failed:', err);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    };

    const timer = setTimeout(executeSearch, 120);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, currentDirectory, isQuickJumpOpen]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuickJumpOpen(false);
      return;
    }

    const totalItems = query.trim()
      ? results.length
      : quickPaths.length + recentDirectories.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((idx) => (idx + 1) % Math.max(1, totalItems));
      scrollActiveIntoView((selectedIndex + 1) % Math.max(1, totalItems));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((idx) => (idx - 1 + totalItems) % Math.max(1, totalItems));
      scrollActiveIntoView((selectedIndex - 1 + totalItems) % Math.max(1, totalItems));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectCurrent();
      return;
    }
  };

  const scrollActiveIntoView = (index: number) => {
    const listEl = listRef.current;
    if (!listEl) return;
    const item = listEl.children[index] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  };

  const handleSelectCurrent = async () => {
    if (query.trim() && results.length > 0) {
      const chosen = results[selectedIndex];
      if (chosen) {
        if (chosen.is_dir) {
          await jumpToPath(chosen.path);
        } else {
          // Open parent if different, then select file
          const parts = chosen.path.split('/');
          const parent = parts.slice(0, -1).join('/') || '/';
          if (parent !== currentDirectory) {
            await jumpToPath(parent);
          }
          setSelectedFile(chosen);
        }
        setQuickJumpOpen(false);
      }
      return;
    }

    // When query is empty: quick paths or recents
    if (!query.trim()) {
      if (selectedIndex < quickPaths.length) {
        const item = quickPaths[selectedIndex];
        await jumpToPath(item.path);
        showToast('Opened', item.name, 'info');
        setQuickJumpOpen(false);
      } else {
        const recentIdx = selectedIndex - quickPaths.length;
        const targetPath = recentDirectories[recentIdx];
        if (targetPath) {
          await jumpToPath(targetPath);
          showToast('Opened Recent', targetPath.split('/').pop() || targetPath, 'info');
          setQuickJumpOpen(false);
        }
      }
    }
  };

  if (!isQuickJumpOpen) return null;

  const renderQuickPathIcon = (kind: string) => {
    switch (kind) {
      case 'home':
        return <Home className="w-4 h-4 text-sky-400" />;
      case 'desktop':
        return <Monitor className="w-4 h-4 text-purple-400" />;
      case 'documents':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'downloads':
        return <Download className="w-4 h-4 text-emerald-400" />;
      case 'drive':
        return <HardDrive className="w-4 h-4 text-amber-400" />;
      default:
        return <Folder className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setQuickJumpOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 backdrop-blur-sm p-4 select-none animate-in fade-in duration-100"
    >
      <div className="w-full max-w-xl bg-[#141724] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col divide-y divide-slate-800">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#10121b]">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Quick Jump: type file name or path... (Ctrl+P)"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
          />
          {isSearching ? (
            <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
          ) : (
            <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">
              ESC to close
            </span>
          )}
        </div>

        {/* Results / Quick Places List */}
        <div ref={listRef} className="max-h-96 overflow-y-auto p-2 space-y-1">
          {query.trim() ? (
            results.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                {isSearching ? 'Searching files in workspace...' : `No matching files found for "${query}"`}
              </div>
            ) : (
              results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                let relPath = item.path;
                if (currentDirectory && item.path.startsWith(currentDirectory)) {
                  relPath = item.path.slice(currentDirectory.length).replace(/^\//, '');
                }

                return (
                  <div
                    key={item.path}
                    onClick={() => {
                      setSelectedIndex(idx);
                      handleSelectCurrent();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors text-xs font-mono ${
                      isSelected
                        ? 'bg-blue-600/25 text-white ring-1 ring-blue-500/50'
                        : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {getFileIcon(item.category, item.extension, item.is_dir, false, 'w-4 h-4')}
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-100 truncate">{item.name}</span>
                        <span className="text-[10.5px] text-slate-500 truncate">{relPath}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-slate-500">
                      {!item.is_dir && <span>{formatBytes(item.size)}</span>}
                      <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'opacity-0'}`} />
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // Default Quick Places & Recent History
            <div className="space-y-3 p-1">
              {/* Quick Locations */}
              <div>
                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Quick Access Places
                </div>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {quickPaths.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          jumpToPath(item.path);
                          setQuickJumpOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors text-xs font-mono ${
                          isSelected
                            ? 'bg-blue-600/25 text-white ring-1 ring-blue-500/50'
                            : 'bg-[#0f111a] hover:bg-slate-800/60 text-slate-200'
                        }`}
                      >
                        {renderQuickPathIcon(item.kind)}
                        <span className="truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recent Directories */}
              {recentDirectories.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Recent Workspaces</span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {recentDirectories.map((dirPath, idx) => {
                      const absoluteIndex = quickPaths.length + idx;
                      const isSelected = absoluteIndex === selectedIndex;
                      const folderName = dirPath.split('/').filter(Boolean).pop() || dirPath;

                      return (
                        <div
                          key={dirPath}
                          onClick={() => {
                            jumpToPath(dirPath);
                            setQuickJumpOpen(false);
                          }}
                          onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-xs font-mono ${
                            isSelected
                              ? 'bg-blue-600/25 text-white ring-1 ring-blue-500/50'
                              : 'text-slate-300 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span className="font-medium text-slate-200">{folderName}</span>
                            <span className="text-[10px] text-slate-500 truncate max-w-xs">
                              {dirPath}
                            </span>
                          </div>
                          <ArrowRight className={`w-3 h-3 ${isSelected ? 'text-blue-400' : 'opacity-0'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 bg-[#0d0e17] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span><kbd className="bg-slate-800 px-1 py-0.2 rounded text-slate-400">↑↓</kbd> Navigate</span>
            <span><kbd className="bg-slate-800 px-1 py-0.2 rounded text-slate-400">↵</kbd> Select</span>
          </div>
          <span>Deep Workspace Search</span>
        </div>
      </div>
    </div>
  );
};
