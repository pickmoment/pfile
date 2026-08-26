import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../store/useFileStore';
import { useViewerStore } from '../../store/useViewerStore';
import { useFileContent } from '../../hooks/useFileContent';
import { ViewerHeader } from './ViewerHeader';
import { MarkdownViewer } from './MarkdownViewer';
import { CodeViewer } from './CodeViewer';
import { HtmlSandbox } from './HtmlSandbox';
import { DataViewer } from './DataViewer';
import { MediaViewer } from './MediaViewer';
import { DiffViewer } from './DiffViewer';
import { ExcelViewer } from './ExcelViewer';
import { Sparkles, FileText, ArrowLeftRight, Binary, ExternalLink, Minimize2 } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

export const ViewerContainer: React.FC = () => {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const viewerMode = useViewerStore((s) => s.viewerMode);
  const diffTargetFile = useViewerStore((s) => s.diffTargetFile);
  const setDiffTargetFile = useViewerStore((s) => s.setDiffTargetFile);
  const isEditing = useViewerStore((s) => s.isEditing);
  const contentOnly = useViewerStore((s) => s.contentOnly);
  const toggleContentOnly = useViewerStore((s) => s.toggleContentOnly);

  const {
    content,
    binaryBase64,
    tokenStats,
    isLoading,
    error,
    saveContent,
    isBinary,
  } = useFileContent(selectedFile);

  const [editBuffer, setEditBuffer] = useState<string>('');
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // Sync buffer on file/content change
  useEffect(() => {
    setEditBuffer(content);
    setHasChanges(false);
  }, [content, selectedFile?.path]);

  const handleBufferChange = (newVal: string) => {
    setEditBuffer(newVal);
    setHasChanges(newVal !== content);
  };

  const handleSave = async () => {
    if (selectedFile && hasChanges) {
      await saveContent(editBuffer);
      setHasChanges(false);
    }
  };

  if (!selectedFile) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--s2)] text-[var(--tx5)] p-8 select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-[var(--bd2)] flex items-center justify-center text-indigo-400 mb-4 shadow-xl">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-[var(--tx3)]">pfile AI Rich Viewer</h3>
        <p className="text-xs text-[var(--tx5)] mt-1 max-w-sm text-center leading-relaxed">
          Select a markdown document, source file, interactive HTML prototype, data spreadsheet, or media asset from the explorer to preview and analyze.
        </p>
        <div className="flex items-center gap-3 mt-6 text-[11px] text-[var(--tx4)] font-mono">
          <span className="flex items-center gap-1 bg-[var(--s5)] px-2.5 py-1 rounded border border-[var(--bd2)]">
            <FileText className="w-3 h-3 text-sky-400" />
            Markdown & Mermaid
          </span>
          <span className="flex items-center gap-1 bg-[var(--s5)] px-2.5 py-1 rounded border border-[var(--bd2)]">
            <ArrowLeftRight className="w-3 h-3 text-indigo-400" />
            Diff Compare
          </span>
          <span className="flex items-center gap-1 bg-[var(--s5)] px-2.5 py-1 rounded border border-[var(--bd2)]">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Token Count
          </span>
        </div>
      </div>
    );
  }

  if (isLoading && !content && !binaryBase64) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--s2)] text-[var(--tx4)] gap-3">
        <Sparkles className="w-6 h-6 animate-spin text-blue-400" />
        <span className="text-xs font-mono">Loading {selectedFile.name}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--s2)] text-[var(--tx4)] p-6">
        <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded-xl text-xs text-rose-300 max-w-md text-center">
          <p className="font-semibold text-rose-200 mb-1">Notice</p>
          <p className="font-mono text-[11px] mb-3">{error}</p>
          <button
            onClick={() => invoke('open_in_default_app', { path: selectedFile.path })}
            className="px-3 py-1.5 bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx2)] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Default Application</span>
          </button>
        </div>
      </div>
    );
  }

  const ext = selectedFile.extension?.toLowerCase() || '';
  const isExcel = ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'xlsb' || ext === 'ods';
  const isMedia =
    selectedFile.category === 'image' ||
    selectedFile.category === 'audio' ||
    selectedFile.category === 'video' ||
    ext === 'pdf' ||
    ext === 'svg';

  // Active file content to display (use editBuffer if modified)
  const activeText = hasChanges ? editBuffer : content;

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s1)] overflow-hidden">
      {/* Viewer Header — hidden in content-only mode */}
      {!contentOnly && (
        <ViewerHeader
          file={selectedFile}
          content={activeText}
          tokenStats={tokenStats}
          onSave={!isBinary ? handleSave : undefined}
          hasUnsavedChanges={hasChanges}
        />
      )}

      {/* Floating exit button for content-only mode */}
      {contentOnly && (
        <button
          onClick={toggleContentOnly}
          title="Exit content-only mode (Esc)"
          className="fixed top-3 right-3 z-50 p-2 rounded-lg bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-white backdrop-blur-sm border border-[var(--bd1)] transition-all opacity-0 hover:opacity-100 focus:opacity-100"
          style={{ opacity: undefined }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.15')}
          ref={(el) => { if (el) el.style.opacity = '0.15'; }}
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}

      {/* Viewer Content Routing */}
      <div className="flex-1 w-full h-full overflow-hidden relative">
        {diffTargetFile ? (
          <DiffViewer
            originalFile={selectedFile}
            originalContent={activeText}
            targetFile={diffTargetFile}
            onClose={() => setDiffTargetFile(null)}
          />
        ) : isExcel ? (
          <ExcelViewer
            file={selectedFile}
            binaryBase64={binaryBase64}
          />
        ) : isMedia ? (
          <MediaViewer
            file={selectedFile}
            binaryBase64={binaryBase64}
            textContent={content}
          />
        ) : isBinary ? (
          // Unsupported binary files (zip, exe, dll, docx, etc.)
          <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--s2)] p-8 text-center select-none">
            <div className="w-16 h-16 rounded-2xl bg-[var(--s6)] border border-[var(--bd1)] flex items-center justify-center text-[var(--tx4)] mb-4 shadow-xl">
              <Binary className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--tx2)] font-mono">{selectedFile.name}</h3>
            <p className="text-xs text-[var(--tx5)] font-mono mt-1">
              Binary File ({formatBytes(selectedFile.size)})
            </p>
            <p className="text-xs text-[var(--tx4)] mt-2 max-w-sm">
              This binary file format is not directly previewable in text mode.
            </p>
            <button
              onClick={() => invoke('open_in_default_app', { path: selectedFile.path })}
              className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-lg transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in System Associated App</span>
            </button>
          </div>
        ) : selectedFile.category === 'markdown' ? (
          <MarkdownViewer
            content={activeText}
            onChange={handleBufferChange}
            isEditing={isEditing}
          />
        ) : selectedFile.category === 'html' && viewerMode !== 'source' && !isEditing ? (
          <HtmlSandbox htmlContent={activeText} />
        ) : selectedFile.category === 'data' && viewerMode !== 'source' ? (
          <DataViewer
            filePath={selectedFile.path}
            content={activeText}
            onChange={handleBufferChange}
            isEditing={isEditing}
          />
        ) : (
          <CodeViewer
            filePath={selectedFile.path}
            content={activeText}
            onChange={handleBufferChange}
            isEditing={isEditing}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
};
