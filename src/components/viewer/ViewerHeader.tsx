import React, { useState } from 'react';
import {
  Coins,
  Check,
  GitCompare,
  ExternalLink,
  Code2,
  Eye,
  Columns,
  Save,
  Edit3,
  X,
  Layers,
  Sparkles,
  Maximize2,
  Star,
  Minus,
  Plus,
  Type,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { FileMetadata, TokenStats } from '../../types/file';
import { getFileIcon } from '../../utils/fileIcons';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { formatFileForLlmContext } from '../../utils/llmPrompt';
import { useViewerStore } from '../../store/useViewerStore';
import { useToastStore } from '../../store/useToastStore';
import { useFileStore } from '../../store/useFileStore';
import { VIEWER_FONT_OPTIONS } from '../../utils/fontOptions';
import { Modal } from '../common/Modal';

interface ViewerHeaderProps {
  file: FileMetadata;
  content: string;
  tokenStats: TokenStats | null;
  onSave?: () => Promise<void>;
  hasUnsavedChanges?: boolean;
  onExitEditing?: () => void;
}

export const ViewerHeader: React.FC<ViewerHeaderProps> = ({
  file,
  content,
  tokenStats,
  onSave,
  hasUnsavedChanges,
  onExitEditing,
}) => {
  const viewerMode = useViewerStore((s) => s.viewerMode);
  const setViewerMode = useViewerStore((s) => s.setViewerMode);
  const isEditing = useViewerStore((s) => s.isEditing);
  const setIsEditing = useViewerStore((s) => s.setIsEditing);
  const setDiffTargetFile = useViewerStore((s) => s.setDiffTargetFile);
  const toggleContentOnly = useViewerStore((s) => s.toggleContentOnly);
  const viewerFontScale = useViewerStore((s) => s.viewerFontScale);
  const setViewerFontScale = useViewerStore((s) => s.setViewerFontScale);
  const viewerFontFamily = useViewerStore((s) => s.viewerFontFamily);
  const setViewerFontFamily = useViewerStore((s) => s.setViewerFontFamily);

  const files = useFileStore((s) => s.files);
  const favorites = useFileStore((s) => s.favorites);
  const addFavorite = useFileStore((s) => s.addFavorite);
  const removeFavorite = useFileStore((s) => s.removeFavorite);
  const showToast = useToastStore((s) => s.showToast);

  const [copiedLlm, setCopiedLlm] = useState(false);
  const [diffPickerOpen, setDiffPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCopyLlm = () => {
    const formatted = formatFileForLlmContext(file, content, tokenStats);
    navigator.clipboard.writeText(formatted);
    setCopiedLlm(true);
    showToast('Copied for LLM', `Formatted ${file.name} context into clipboard`, 'success');
    setTimeout(() => setCopiedLlm(false), 2000);
  };

  const handleOpenExternal = async () => {
    try {
      await invoke('open_in_default_app', { path: file.path });
    } catch (err: unknown) {
      showToast('Error', 'Failed to open with default app', 'error');
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
      showToast('Saved', `Saved changes to ${file.name}`, 'success');
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Save failed';
      showToast('Error', msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExitEditing = () => {
    if (hasUnsavedChanges && !window.confirm('Discard unsaved changes and exit editing mode?')) return;
    onExitEditing?.();
  };

  const isTextual =
    !file.is_binary &&
    file.extension !== 'xlsx' &&
    file.extension !== 'xls' &&
    (file.category === 'markdown' ||
      file.category === 'code' ||
      file.category === 'html' ||
      file.category === 'data' ||
      (file.category === 'document' && file.extension !== 'pdf'));
  const supportsFontScaling = isTextual && file.category !== 'html';

  return (
    <div className="bg-[var(--s5)] border-b border-[var(--bd2)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Left: File Icon, Name & Category Badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        {getFileIcon(file.category, file.extension, false, false, 'w-5 h-5')}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--tx1)] font-mono truncate max-w-md" title={file.name}>
              {file.name}
            </h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-[var(--bg-muted)] text-[var(--tx3)] border border-[var(--bd1)]">
              {file.extension ? file.extension.toUpperCase() : file.category.toUpperCase()}
            </span>
            <button
              onClick={() => {
                const isFav = favorites.includes(file.path);
                if (isFav) {
                  removeFavorite(file.path);
                  showToast('Removed', `${file.name} removed from favorites`, 'info');
                } else {
                  addFavorite(file.path);
                  showToast('Favorited', `${file.name} added to favorites`, 'success');
                }
              }}
              title={favorites.includes(file.path) ? 'Remove from favorites' : 'Add to favorites'}
              className="p-0.5 rounded transition-colors"
            >
              <Star className={`w-3.5 h-3.5 ${favorites.includes(file.path) ? 'text-amber-400 fill-amber-400' : 'text-[var(--tx5)] hover:text-amber-400'}`} />
            </button>
          </div>
          <span className="text-[11px] text-[var(--tx5)] font-mono truncate max-w-lg" title={file.path}>
            {file.path}
          </span>
        </div>
      </div>

      {/* Center: Token & File Metrics Pills */}
      {isTextual && (
        <div className="flex items-center gap-2 bg-[var(--s2)] px-3 py-1 rounded-lg border border-[var(--bd2)] text-xs">
          {tokenStats && (
            <div
              title="Estimated OpenAI BPE (cl100k) Token Count"
              className="flex items-center gap-1.5 text-amber-400 font-medium font-mono"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>~{formatNumber(tokenStats.token_count)} tokens</span>
            </div>
          )}
          {tokenStats && <div className="w-px h-3 bg-[var(--bg-muted)]" />}
          {tokenStats && (
            <div
              title="Word Count & Line Count"
              className="flex items-center gap-2 text-[var(--tx4)] font-mono text-[11px]"
            >
              <span>{formatNumber(tokenStats.word_count)} words</span>
              <span>•</span>
              <span>{formatNumber(tokenStats.line_count)} lines</span>
            </div>
          )}
          <div className="w-px h-3 bg-[var(--bg-muted)]" />
          <div title="File Size" className="text-[var(--tx4)] font-mono text-[11px]">
            {formatBytes(file.size)}
          </div>
        </div>
      )}

      {/* Right: Action Buttons & View Mode Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {supportsFontScaling && (
          <div
            className="flex items-center bg-[var(--s2)] p-0.5 rounded-lg border border-[var(--bd2)]"
            aria-label="Viewer font size"
          >
            <button
              onClick={() => setViewerFontScale((scale) => scale - 10)}
              disabled={viewerFontScale <= 70}
              title="Decrease viewer font size"
              className="p-1.5 rounded-md text-[var(--tx4)] hover:text-[var(--tx1)] hover:bg-[var(--s7)] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewerFontScale(100)}
              title="Reset viewer font size"
              className="w-11 text-center text-[10px] font-mono text-[var(--tx3)] hover:text-[var(--tx1)]"
            >
              {viewerFontScale}%
            </button>
            <button
              onClick={() => setViewerFontScale((scale) => scale + 10)}
              disabled={viewerFontScale >= 160}
              title="Increase viewer font size"
              className="p-1.5 rounded-md text-[var(--tx4)] hover:text-[var(--tx1)] hover:bg-[var(--s7)] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {supportsFontScaling && (
          <label
            className="flex items-center gap-1 bg-[var(--s2)] px-1.5 py-0.5 rounded-lg border border-[var(--bd2)] text-[var(--tx4)] hover:text-[var(--tx1)] cursor-pointer"
            title="Viewer font family"
          >
            <Type className="w-3.5 h-3.5 flex-shrink-0" />
            <select
              value={viewerFontFamily}
              onChange={(e) => setViewerFontFamily(e.target.value)}
              aria-label="Viewer font family"
              className="bg-transparent text-[10.5px] font-mono text-[var(--tx3)] hover:text-[var(--tx1)] focus:outline-none cursor-pointer max-w-[7.5rem]"
            >
              {VIEWER_FONT_OPTIONS.map((font) => (
                <option key={font.id} value={font.id} className="bg-[var(--s2)] text-[var(--tx1)]">
                  {font.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Markdown View Mode Toggle */}
        {file.category === 'markdown' && (
          <div className="flex items-center bg-[var(--s2)] p-0.5 rounded-lg border border-[var(--bd2)]">
            <button
              onClick={() => setViewerMode('rendered')}
              title="Rendered Markdown"
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewerMode === 'rendered' || viewerMode === 'auto'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--tx4)] hover:text-[var(--tx2)]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewerMode('source')}
              title="Source Code"
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewerMode === 'source' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--tx4)] hover:text-[var(--tx2)]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewerMode('split')}
              title="Split View (Render + Source)"
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewerMode === 'split' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--tx4)] hover:text-[var(--tx2)]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Data (JSON/CSV) Mode Toggle */}
        {file.category === 'data' && (
          <div className="flex items-center bg-[var(--s2)] p-0.5 rounded-lg border border-[var(--bd2)]">
            <button
              onClick={() => setViewerMode('tree')}
              title="Interactive Visual / Tree View"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                viewerMode === 'tree' || viewerMode === 'auto'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--tx4)] hover:text-[var(--tx2)]'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Interactive</span>
            </button>
            <button
              onClick={() => setViewerMode('source')}
              title="Raw Code / Editor"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                viewerMode === 'source' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--tx4)] hover:text-[var(--tx2)]'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>Code</span>
            </button>
          </div>
        )}

        {/* Edit / Save Toggle for Text Files */}
        {isTextual && onSave && (
          <>
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes *' : 'Saved'}</span>
                </button>
                <button
                  onClick={handleExitEditing}
                  disabled={isSaving}
                  title="Exit editing mode"
                  aria-label="Exit editing mode"
                  className="p-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx3)] hover:text-[var(--tx1)] text-xs transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                title="Edit File"
                className="p-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx3)] hover:text-[var(--tx1)] text-xs transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}

        {/* LLM Context Copy Button */}
        {isTextual && (
          <button
            onClick={handleCopyLlm}
            title="Copy formatted prompt context with tokens & markdown blocks"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copiedLlm
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm'
            }`}
          >
            {copiedLlm ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{copiedLlm ? 'Context Copied!' : 'Copy for LLM'}</span>
          </button>
        )}

        {/* Diff Button */}
        {isTextual && (
          <button
            onClick={() => setDiffPickerOpen(true)}
            title="Compare with another file (Diff)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--s7)] hover:bg-[var(--s8)] border border-[var(--bd1)] text-[var(--tx2)] hover:text-[var(--tx1)] text-xs transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Diff</span>
          </button>
        )}

        {/* Content Only Mode */}
        <button
          onClick={toggleContentOnly}
          title="Content only mode (Ctrl+Shift+F)"
          className="p-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)] text-xs transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Open External */}
        <button
          onClick={handleOpenExternal}
          title="Open in System Default Application"
          className="p-1.5 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)] text-xs transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Diff Target File Picker Modal */}
      <Modal
        isOpen={diffPickerOpen}
        onClose={() => setDiffPickerOpen(false)}
        title={`Select File to Compare with "${file.name}"`}
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <p className="text-xs text-[var(--tx4)] mb-2">Choose a file from current workspace to compare against:</p>
          {files
            .filter((f) => !f.is_dir && f.path !== file.path)
            .map((target) => (
              <button
                key={target.path}
                onClick={() => {
                  setDiffTargetFile(target);
                  setViewerMode('diff');
                  setDiffPickerOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[var(--s3)] hover:bg-blue-600/20 border border-[var(--bd2)] hover:border-blue-500/50 text-left transition-all text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(target.category, target.extension, false, false, 'w-4 h-4')}
                  <span className="font-mono text-[var(--tx2)] truncate">{target.name}</span>
                </div>
                <span className="text-[10px] text-[var(--tx5)] font-mono">{formatBytes(target.size)}</span>
              </button>
            ))}
        </div>
      </Modal>
    </div>
  );
};
