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
  Layers,
  Sparkles,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { FileMetadata, TokenStats } from '../../types/file';
import { getFileIcon } from '../../utils/fileIcons';
import { formatBytes, formatNumber } from '../../utils/formatters';
import { formatFileForLlmContext } from '../../utils/llmPrompt';
import { useViewerStore } from '../../store/useViewerStore';
import { useToastStore } from '../../store/useToastStore';
import { useFileStore } from '../../store/useFileStore';
import { Modal } from '../common/Modal';

interface ViewerHeaderProps {
  file: FileMetadata;
  content: string;
  tokenStats: TokenStats | null;
  onSave?: () => Promise<void>;
  hasUnsavedChanges?: boolean;
}

export const ViewerHeader: React.FC<ViewerHeaderProps> = ({
  file,
  content,
  tokenStats,
  onSave,
  hasUnsavedChanges,
}) => {
  const viewerMode = useViewerStore((s) => s.viewerMode);
  const setViewerMode = useViewerStore((s) => s.setViewerMode);
  const isEditing = useViewerStore((s) => s.isEditing);
  const setIsEditing = useViewerStore((s) => s.setIsEditing);
  const setDiffTargetFile = useViewerStore((s) => s.setDiffTargetFile);

  const files = useFileStore((s) => s.files);
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

  const isTextual =
    !file.is_binary &&
    file.extension !== 'xlsx' &&
    file.extension !== 'xls' &&
    (file.category === 'markdown' ||
      file.category === 'code' ||
      file.category === 'html' ||
      file.category === 'data' ||
      (file.category === 'document' && file.extension !== 'pdf'));

  return (
    <div className="bg-[#141722] border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Left: File Icon, Name & Category Badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        {getFileIcon(file.category, file.extension, false, false, 'w-5 h-5')}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100 font-mono truncate max-w-md" title={file.name}>
              {file.name}
            </h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
              {file.extension ? file.extension.toUpperCase() : file.category.toUpperCase()}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono truncate max-w-lg" title={file.path}>
            {file.path}
          </span>
        </div>
      </div>

      {/* Center: Token & File Metrics Pills */}
      {isTextual && (
        <div className="flex items-center gap-2 bg-[#0d0f15] px-3 py-1 rounded-lg border border-slate-800 text-xs">
          {tokenStats && (
            <div
              title="Estimated OpenAI BPE (cl100k) Token Count"
              className="flex items-center gap-1.5 text-amber-400 font-medium font-mono"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>~{formatNumber(tokenStats.token_count)} tokens</span>
            </div>
          )}
          {tokenStats && <div className="w-px h-3 bg-slate-800" />}
          {tokenStats && (
            <div
              title="Word Count & Line Count"
              className="flex items-center gap-2 text-slate-400 font-mono text-[11px]"
            >
              <span>{formatNumber(tokenStats.word_count)} words</span>
              <span>•</span>
              <span>{formatNumber(tokenStats.line_count)} lines</span>
            </div>
          )}
          <div className="w-px h-3 bg-slate-800" />
          <div title="File Size" className="text-slate-400 font-mono text-[11px]">
            {formatBytes(file.size)}
          </div>
        </div>
      )}

      {/* Right: Action Buttons & View Mode Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Markdown View Mode Toggle */}
        {file.category === 'markdown' && (
          <div className="flex items-center bg-[#0d0f15] p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewerMode('rendered')}
              title="Rendered Markdown"
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewerMode === 'rendered' || viewerMode === 'auto'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewerMode('source')}
              title="Source Code"
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewerMode === 'source' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewerMode('split')}
              title="Split View (Render + Source)"
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewerMode === 'split' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Data (JSON/CSV) Mode Toggle */}
        {file.category === 'data' && (
          <div className="flex items-center bg-[#0d0f15] p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewerMode('tree')}
              title="Interactive Visual / Tree View"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                viewerMode === 'tree' || viewerMode === 'auto'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Interactive</span>
            </button>
            <button
              onClick={() => setViewerMode('source')}
              title="Raw Code / Editor"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                viewerMode === 'source' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
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
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes *' : 'Saved'}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                title="Edit File"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2230] hover:bg-[#282e42] border border-slate-700 text-slate-200 hover:text-white text-xs transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Diff</span>
          </button>
        )}

        {/* Open External */}
        <button
          onClick={handleOpenExternal}
          title="Open in System Default Application"
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors"
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
          <p className="text-xs text-slate-400 mb-2">Choose a file from current workspace to compare against:</p>
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
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#0f1118] hover:bg-blue-600/20 border border-slate-800 hover:border-blue-500/50 text-left transition-all text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(target.category, target.extension, false, false, 'w-4 h-4')}
                  <span className="font-mono text-slate-200 truncate">{target.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">{formatBytes(target.size)}</span>
              </button>
            ))}
        </div>
      </Modal>
    </div>
  );
};
