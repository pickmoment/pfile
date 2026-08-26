import React, { useState } from 'react';
import { Star, ChevronDown, ChevronRight, X, Folder } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';

export const Favorites: React.FC = () => {
  const favorites = useFileStore((s) => s.favorites);
  const removeFavorite = useFileStore((s) => s.removeFavorite);
  const setCurrentDirectory = useFileStore((s) => s.setCurrentDirectory);
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const showToast = useToastStore((s) => s.showToast);

  const [isExpanded, setIsExpanded] = useState(true);

  if (favorites.length === 0) return null;

  return (
    <div className="border-b border-slate-800/80 pb-2 mb-2 select-none">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-semibold uppercase tracking-wider transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          <span>Favorites</span>
        </div>
        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-0.5 px-2 mt-1">
          {favorites.map((favPath) => {
            const folderName = favPath.split('/').filter(Boolean).pop() || favPath;
            const isCurrent = currentDirectory === favPath;

            return (
              <div
                key={favPath}
                onClick={() => {
                  setCurrentDirectory(favPath);
                  showToast('Switched Workspace', folderName, 'info');
                }}
                className={`group flex items-center justify-between px-2 py-1 rounded-md cursor-pointer transition-colors text-xs font-mono ${
                  isCurrent
                    ? 'bg-amber-400/10 text-amber-300 font-medium'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
                title={favPath}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate text-[11px]">{folderName}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFavorite(favPath);
                  }}
                  title="Remove from favorites"
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-opacity"
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
