import React, { useRef, useState, useEffect } from 'react';
import {
  FolderOpen,
  RotateCw,
  Search,
  Plus,
  FolderPlus,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  X,
  FileText,
  FileCode,
  Globe,
  Database,
  Image,
  LayoutGrid,
  Zap,
  MapPin,
  Home,
  Monitor,
  Download,
  HardDrive,
  Folder,
  Eye,
  EyeOff,
  Star,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';
import { FileFilterCategory } from '../../types/file';
import { CreateItemDialog } from '../common/Dialogs';

const CATEGORY_TABS: Array<{ id: FileFilterCategory; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'ALL', label: 'All', icon: LayoutGrid },
  { id: 'MD', label: 'Markdown', icon: FileText },
  { id: 'CODE', label: 'Code', icon: FileCode },
  { id: 'HTML', label: 'HTML', icon: Globe },
  { id: 'DATA', label: 'Data', icon: Database },
  { id: 'MEDIA', label: 'Media', icon: Image },
];

export const TopToolbar: React.FC = () => {
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const setCurrentDirectory = useFileStore((s) => s.setCurrentDirectory);
  const favorites = useFileStore((s) => s.favorites);
  const addFavorite = useFileStore((s) => s.addFavorite);
  const removeFavorite = useFileStore((s) => s.removeFavorite);
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const setSearchQuery = useFileStore((s) => s.setSearchQuery);
  const categoryFilter = useFileStore((s) => s.categoryFilter);
  const setCategoryFilter = useFileStore((s) => s.setCategoryFilter);
  const isLoading = useFileStore((s) => s.isLoading);
  const showHiddenFiles = useFileStore((s) => s.showHiddenFiles);
  const toggleShowHiddenFiles = useFileStore((s) => s.toggleShowHiddenFiles);
  const setQuickJumpOpen = useFileStore((s) => s.setQuickJumpOpen);
  const quickPaths = useFileStore((s) => s.quickPaths);
  const canGoBack = useFileStore((s) => s.canGoBack);
  const canGoForward = useFileStore((s) => s.canGoForward);
  const goBack = useFileStore((s) => s.goBack);
  const goForward = useFileStore((s) => s.goForward);
  const goUp = useFileStore((s) => s.goUp);

  const isAddressBarEditing = useFileStore((s) => s.isAddressBarEditing);
  const setIsAddressBarEditing = useFileStore((s) => s.setIsAddressBarEditing);

  const showToast = useToastStore((s) => s.showToast);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [addressInput, setAddressInput] = useState('');
  const [placesDropdownOpen, setPlacesDropdownOpen] = useState(false);

  const addressInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const placesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAddressBarEditing) {
      setAddressInput(currentDirectory);
      setTimeout(() => {
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
      }, 50);
    }
  }, [isAddressBarEditing, currentDirectory]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (placesDropdownRef.current && !placesDropdownRef.current.contains(e.target as Node)) {
        setPlacesDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory',
      });

      if (selected && typeof selected === 'string') {
        const normalized = selected.replace(/\\/g, '/');
        await setCurrentDirectory(normalized);
        showToast('Opened Folder', normalized, 'info');
      }
    } catch (err: unknown) {
      console.error('Failed to open directory dialog:', err);
    }
  };

  const handleAddressSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = addressInput.trim();
    if (!trimmed) {
      setIsAddressBarEditing(false);
      return;
    }

    try {
      await setCurrentDirectory(trimmed);
      setIsAddressBarEditing(false);
      showToast('Navigated', trimmed, 'success');
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Path does not exist';
      showToast('Error', msg, 'error');
    }
  };

  // Breadcrumbs
  const breadcrumbs = currentDirectory
    ? currentDirectory.split('/').filter(Boolean)
    : [];

  const handleBreadcrumbClick = async (index: number) => {
    if (!currentDirectory) return;
    const isWindowsDrive = currentDirectory.includes(':');
    let targetPath = '';

    if (isWindowsDrive && index === 0) {
      targetPath = `${breadcrumbs[0]}/`;
    } else if (isWindowsDrive) {
      targetPath = breadcrumbs.slice(0, index + 1).join('/');
    } else {
      targetPath = '/' + breadcrumbs.slice(0, index + 1).join('/');
    }

    if (targetPath !== currentDirectory) {
      await setCurrentDirectory(targetPath);
    }
  };

  const renderQuickPathIcon = (kind: string) => {
    switch (kind) {
      case 'home':
        return <Home className="w-3.5 h-3.5 text-sky-400" />;
      case 'desktop':
        return <Monitor className="w-3.5 h-3.5 text-purple-400" />;
      case 'documents':
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'downloads':
        return <Download className="w-3.5 h-3.5 text-emerald-400" />;
      case 'drive':
        return <HardDrive className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Folder className="w-3.5 h-3.5 text-[var(--tx4)]" />;
    }
  };

  return (
    <div className="bg-[var(--s5)] border-b border-[var(--bd2)] flex flex-col gap-2 p-2 text-xs text-[var(--tx3)] select-none">
      {/* Upper Row: Back/Forward/Up + Address Bar & Primary Actions */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Navigation Buttons (Back, Forward, Up, Open, Places) */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => goBack()}
            disabled={!canGoBack}
            title="Back (Alt+Left)"
            className="p-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--tx3)] hover:text-[var(--tx1)] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => goForward()}
            disabled={!canGoForward}
            title="Forward (Alt+Right)"
            className="p-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--tx3)] hover:text-[var(--tx1)] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => goUp()}
            title="Up to Parent Directory (Alt+Up)"
            className="p-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx3)] hover:text-[var(--tx1)] transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition-all ml-1"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open</span>
          </button>

          {/* Favorite current directory */}
          {currentDirectory && (() => {
            const isFav = favorites.includes(currentDirectory);
            return (
              <button
                onClick={() => {
                  if (isFav) removeFavorite(currentDirectory);
                  else addFavorite(currentDirectory);
                }}
                title={isFav ? 'Remove directory from favorites' : 'Add directory to favorites'}
                className="p-1.5 rounded-lg bg-[var(--s7)] hover:bg-[var(--s8)] border border-[var(--bd1)] text-[var(--tx3)] hover:text-[var(--tx1)] transition-colors"
              >
                <Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-400 fill-amber-400' : ''}`} />
              </button>
            );
          })()}
          {/* Quick Places Popover Trigger */}
          <div ref={placesDropdownRef} className="relative">
            <button
              onClick={() => setPlacesDropdownOpen(!placesDropdownOpen)}
              title="Quick Places & Drives"
              className="flex items-center gap-1 p-1.5 rounded-lg bg-[var(--s7)] hover:bg-[var(--s8)] border border-[var(--bd1)] text-[var(--tx3)] hover:text-[var(--tx1)] text-xs transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            {placesDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-[var(--s6)] border border-[var(--bd1)] rounded-xl shadow-2xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--tx5)]">
                  Quick System Places
                </div>
                <div className="space-y-0.5 mt-1">
                  {quickPaths.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => {
                        setCurrentDirectory(item.path);
                        setPlacesDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--info-bg)] hover:text-[var(--info-text)] text-left transition-colors font-mono text-[11px]"
                    >
                      {renderQuickPathIcon(item.kind)}
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => refreshDirectory()}
            disabled={isLoading}
            title="Refresh Workspace (F5)"
            className="p-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx3)] hover:text-[var(--tx1)] transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        {/* Center: Address Bar / Interactive Breadcrumbs */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {isAddressBarEditing ? (
            <form onSubmit={handleAddressSubmit} className="w-full">
              <input
                ref={addressInputRef}
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onBlur={() => setIsAddressBarEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsAddressBarEditing(false);
                }}
                placeholder="Type absolute or relative path and press Enter..."
                className="w-full px-2.5 py-1 text-xs bg-[var(--s2)] border border-blue-500 rounded-lg text-[var(--tx1)] font-mono focus:outline-none shadow-inner"
              />
            </form>
          ) : (
            <div
              onClick={() => setIsAddressBarEditing(true)}
              title="Click or press Ctrl+L to edit path directly"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--s2)] hover:bg-[var(--s6)] border border-[var(--bd2)] hover:border-[var(--bd1)] cursor-text transition-all text-[11.5px] font-mono overflow-x-auto no-scrollbar group"
            >
              <span className="text-[var(--tx6)] group-hover:text-[var(--tx4)] mr-1 select-none">📂</span>
              {breadcrumbs.map((segment, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-[var(--tx6)] mx-0.5 flex-shrink-0" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBreadcrumbClick(idx);
                    }}
                    className={`hover:text-blue-400 hover:underline px-1 py-0.2 rounded transition-colors truncate max-w-[140px] ${
                      idx === breadcrumbs.length - 1 ? 'text-[var(--tx1)] font-semibold' : 'text-[var(--tx4)]'
                    }`}
                    title={segment}
                  >
                    {segment}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Jump & New File/Folder */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Quick Jump (Ctrl+P) */}
          <button
            onClick={() => setQuickJumpOpen(true)}
            title="Quick File & Folder Jump (Ctrl+P / Cmd+P)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600/80 to-purple-600/80 hover:from-indigo-500 hover:to-purple-500 text-white text-[11px] font-medium shadow-sm transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Quick Jump</span>
            <span className="text-[10px] bg-[var(--info-bg)] px-1 py-0.2 rounded border border-[var(--info-border)] text-[var(--info-text)]">
              Ctrl+P
            </span>
          </button>

          {currentDirectory && (
            <>
              <button
                onClick={() => {
                  setCreateType('file');
                  setCreateDialogOpen(true);
                }}
                title="Create New File"
                className="p-1.5 rounded-lg bg-[var(--s7)] hover:bg-[var(--s8)] border border-[var(--bd1)] text-[var(--tx2)] hover:text-[var(--tx1)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
              </button>
              <button
                onClick={() => {
                  setCreateType('folder');
                  setCreateDialogOpen(true);
                }}
                title="Create New Folder"
                className="p-1.5 rounded-lg bg-[var(--s7)] hover:bg-[var(--s8)] border border-[var(--bd1)] text-[var(--tx2)] hover:text-[var(--tx1)] transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lower Row: Category Filter Tabs & File Search Bar */}
      <div className="flex items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-[var(--s3)] p-0.5 rounded-lg border border-[var(--bd2)]">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[var(--tx4)] hover:text-[var(--tx2)] hover:bg-[var(--s7)]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right tools: Hidden Files toggle & Search Bar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              toggleShowHiddenFiles();
              showToast(
                !showHiddenFiles ? 'Showing Hidden Files' : 'Hiding Hidden Files',
                !showHiddenFiles ? 'Dotfiles and hidden items are visible' : 'Dotfiles are now hidden',
                'info'
              );
            }}
            title={`Toggle Hidden Files (${showHiddenFiles ? 'Visible' : 'Hidden'}) • Ctrl+H`}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
              showHiddenFiles
                ? 'bg-[var(--warning-bg)] border-[var(--warning-border)] text-[var(--warning-text)]'
                : 'bg-[var(--s3)] border-[var(--bd2)] text-[var(--tx4)] hover:text-[var(--tx2)]'
            }`}
          >
            {showHiddenFiles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showHiddenFiles ? 'Hidden On' : 'Hidden Off'}</span>
          </button>

          {/* Search Bar */}
          <div className="relative w-60">
            <Search className="w-3.5 h-3.5 text-[var(--tx5)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter files... (Ctrl+F)"
              className="w-full pl-8 pr-7 py-1 text-xs bg-[var(--s3)] border border-[var(--bd2)] rounded-lg text-[var(--tx2)] placeholder-[var(--tx5)] focus:outline-none focus:border-blue-500 transition-all font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tx4)] hover:text-[var(--tx2)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create Dialog */}
      {currentDirectory && (
        <CreateItemDialog
          isOpen={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          type={createType}
          parentPath={currentDirectory}
        />
      )}
    </div>
  );
};
