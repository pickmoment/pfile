import React, { useState } from 'react';
import { Star, ChevronDown, ChevronRight, X, Folder } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';
import { getFileIcon } from '../../utils/fileIcons';

export const Favorites: React.FC = () => {
  const favorites = useFileStore((s) => s.favorites);
  const removeFavorite = useFileStore((s) => s.removeFavorite);
  const setCurrentDirectory = useFileStore((s) => s.setCurrentDirectory);
  const setSelectedFile = useFileStore((s) => s.setSelectedFile);
  const jumpToPath = useFileStore((s) => s.jumpToPath);
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const selectedFile = useFileStore((s) => s.selectedFile);
  const showToast = useToastStore((s) => s.showToast);

  const [isExpanded, setIsExpanded] = useState(true);

  if (favorites.length === 0) return null;

  const handleClick = async (favPath: string) => {
    const name = favPath.split('/').filter(Boolean).pop() || favPath;
    // Heuristic: paths with an extension are files, otherwise folders
    const lastSegment = favPath.split('/').pop() || '';
    const isLikelyFile = lastSegment.includes('.') && !lastSegment.startsWith('.');

    if (isLikelyFile) {
      // Navigate to parent directory, then select the file
      const parent = favPath.split('/').slice(0, -1).join('/') || '/';
      if (parent !== currentDirectory) {
        await jumpToPath(parent);
      }
      // Build a minimal FileMetadata to select
      setSelectedFile({
        name: lastSegment,
        path: favPath,
        is_dir: false,
        size: 0,
        modified_ms: 0,
        extension: lastSegment.includes('.') ? lastSegment.split('.').pop() || null : null,
        category: 'other',
        is_binary: false,
        is_hidden: lastSegment.startsWith('.'),
        readonly: false,
      });
      showToast('Opened Favorite', name, 'info');
    } else {
      await setCurrentDirectory(favPath);
      showToast('Switched Workspace', name, 'info');
    }
  };

  return (
    <div className="border-b border-[var(--bd2)] pb-2 mb-2 select-none">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[var(--tx4)] hover:text-[var(--tx2)] text-xs font-semibold uppercase tracking-wider transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          <span>Favorites</span>
          <span className="text-[10px] text-[var(--tx5)] font-normal normal-case tracking-normal">
            {favorites.length}
          </span>
        </div>
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-0.5 px-2 mt-1">
          {favorites.map((favPath) => {
            const name = favPath.split('/').filter(Boolean).pop() || favPath;
            const lastSegment = favPath.split('/').pop() || '';
            const isLikelyFile = lastSegment.includes('.') && !lastSegment.startsWith('.');
            const isCurrent = isLikelyFile
              ? selectedFile?.path === favPath
              : currentDirectory === favPath;
            const ext = isLikelyFile && lastSegment.includes('.')
              ? lastSegment.split('.').pop() || null
              : null;

            return (
              <div
                key={favPath}
                onClick={() => handleClick(favPath)}
                className={`group flex items-center justify-between px-2 py-1 rounded-md cursor-pointer transition-colors text-xs font-mono ${
                  isCurrent
                    ? 'bg-[var(--warning-bg)] text-[var(--warning-text)] font-medium'
                    : 'text-[var(--tx3)] hover:bg-[var(--s7)] hover:text-[var(--tx1)]'
                }`}
                title={favPath}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isLikelyFile ? (
                    getFileIcon('other', ext, false, false, 'w-3.5 h-3.5 flex-shrink-0')
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  )}
                  <span className="truncate text-[11px]">{name}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFavorite(favPath);
                  }}
                  title="Remove from favorites"
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-rose-400 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
