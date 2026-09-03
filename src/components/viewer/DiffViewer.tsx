import React, { useState, useEffect, useMemo } from 'react';
import { diffLines, Change } from 'diff';
import { invoke } from '@tauri-apps/api/core';
import { Columns, AlignJustify, X, Plus, Minus, GitCompare } from 'lucide-react';
import { FileMetadata } from '../../types/file';
const MAX_DIFF_COMPUTE_CHARS = 1_500_000;

import { useViewerStore } from '../../store/useViewerStore';

interface DiffViewerProps {
  originalFile: FileMetadata;
  originalContent: string;
  targetFile: FileMetadata;
  onClose: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalFile,
  originalContent,
  targetFile,
  onClose,
}) => {
  const diffMode = useViewerStore((s) => s.diffMode);
  const setDiffMode = useViewerStore((s) => s.setDiffMode);
  const viewerFontScale = useViewerStore((s) => s.viewerFontScale);

  const [targetContent, setTargetContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadTarget = async () => {
      setIsLoading(true);
      try {
        const text: string = await invoke('read_file_text', { path: targetFile.path });
        if (isMounted) {
          setTargetContent(text);
        }
      } catch (err) {
        console.error('Failed to load diff target file:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadTarget();
    return () => {
      isMounted = false;
    };
  }, [targetFile.path]);

  const diffTooLarge =
    originalContent.length > MAX_DIFF_COMPUTE_CHARS || targetContent.length > MAX_DIFF_COMPUTE_CHARS;
  const changes = useMemo(() => {
    if (diffTooLarge) return [];
    return diffLines(originalContent, targetContent);
  }, [diffTooLarge, originalContent, targetContent]);

  // Stats
  const { addedCount, removedCount } = useMemo(() => {
    let added = 0;
    let removed = 0;
    changes.forEach((c) => {
      const count = c.count || 0;
      if (c.added) added += count;
      if (c.removed) removed += count;
    });
    return { addedCount: added, removedCount: removed };
  }, [changes]);

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s1)] select-text overflow-hidden">
      {/* Diff Header */}
      <div className="h-10 bg-[var(--s4)] border-b border-[var(--bd2)] px-4 flex items-center justify-between text-xs text-[var(--tx3)] select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--info-text)]">
            <GitCompare className="w-4 h-4 text-indigo-400" />
            <span>Comparing:</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-[var(--danger-text)] bg-[var(--danger-bg)] px-2 py-0.5 rounded border border-[var(--danger-border)]">
              - {originalFile.name} (Base)
            </span>
            <span className="text-[var(--tx5)]">vs</span>
            <span className="text-[var(--success-text)] bg-[var(--success-bg)] px-2 py-0.5 rounded border border-[var(--success-border)]">
              + {targetFile.name} (Modified)
            </span>
          </div>

          {/* Change counts */}
          <div className="flex items-center gap-2 font-mono text-[11px] ml-2">
            <span className="flex items-center gap-0.5 text-[var(--success-text)] font-semibold">
              <Plus className="w-3 h-3" />
              {addedCount}
            </span>
            <span className="flex items-center gap-0.5 text-[var(--danger-text)] font-semibold">
              <Minus className="w-3 h-3" />
              {removedCount}
            </span>
          </div>
        </div>

        {/* Right: Mode switches and close */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--s1)] p-0.5 rounded-lg border border-[var(--bd2)]">
            <button
              onClick={() => setDiffMode('side-by-side')}
              title="Side by Side"
              className={`p-1.5 rounded text-xs transition-colors ${
                diffMode === 'side-by-side' ? 'bg-blue-600 text-white' : 'text-[var(--tx4)] hover:text-[var(--tx1)]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDiffMode('inline')}
              title="Inline Unified"
              className={`p-1.5 rounded text-xs transition-colors ${
                diffMode === 'inline' ? 'bg-blue-600 text-white' : 'text-[var(--tx4)] hover:text-[var(--tx1)]'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onClose}
            title="Exit Diff Mode"
            className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--danger-text)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diff Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[var(--tx5)] text-xs">
          Calculating diff...
        </div>
      ) : diffTooLarge ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[var(--tx5)] text-xs p-6 text-center">
          <p className="text-[var(--warning-text)] font-semibold">Diff preview skipped for very large files.</p>
          <p>Files larger than {(MAX_DIFF_COMPUTE_CHARS / 1_000_000).toFixed(1)} MB are opened in the source viewer to keep the app responsive.</p>
        </div>
      ) : diffMode === 'side-by-side' ? (
        <SideBySideDiff originalContent={originalContent} targetContent={targetContent} fontSize={11.5 * viewerFontScale / 100} />
      ) : (
        <InlineDiff changes={changes} fontSize={11.5 * viewerFontScale / 100} />
      )}
    </div>
  );
};

// Inline Unified Diff
const InlineDiff: React.FC<{ changes: Change[]; fontSize: number }> = ({ changes, fontSize }) => {
  let origLine = 1;
  let targetLine = 1;

  return (
    <div style={{ fontSize }} className="flex-1 overflow-auto font-mono p-2 leading-relaxed">
      {changes.map((change, cIdx) => {
        const lines = change.value.replace(/\n$/, '').split('\n');

        return lines.map((line, lIdx) => {
          let rowClass = 'hover:bg-[var(--s7)] text-[var(--tx3)]';
          let sign = ' ';
          let oNum = origLine.toString();
          let tNum = targetLine.toString();

          if (change.added) {
            rowClass = 'bg-[var(--success-bg)] hover:bg-[var(--success-bg)] text-[var(--success-text)]';
            sign = '+';
            oNum = '';
            targetLine++;
          } else if (change.removed) {
            rowClass = 'bg-[var(--danger-bg)] hover:bg-[var(--danger-bg)] text-[var(--danger-text)]';
            sign = '-';
            tNum = '';
            origLine++;
          } else {
            origLine++;
            targetLine++;
          }

          return (
            <div key={`${cIdx}-${lIdx}`} className={`flex items-start ${rowClass} py-0.5 px-1 rounded`}>
              <div className="w-10 text-right pr-2 text-[10.5px] text-[var(--tx6)] select-none flex-shrink-0">
                {oNum}
              </div>
              <div className="w-10 text-right pr-2 text-[10.5px] text-[var(--tx6)] select-none flex-shrink-0 border-r border-[var(--bd2)]">
                {tNum}
              </div>
              <div className="w-5 text-center font-bold select-none text-[11px] flex-shrink-0">
                {sign}
              </div>
              <pre className="flex-1 whitespace-pre-wrap break-all font-mono overflow-hidden">
                {line || ' '}
              </pre>
            </div>
          );
        });
      })}
    </div>
  );
};

// Side by Side Diff
const SideBySideDiff: React.FC<{ originalContent: string; targetContent: string; fontSize: number }> = ({
  originalContent,
  targetContent,
  fontSize,
}) => {
  const origLines = originalContent.split('\n');
  const targetLines = targetContent.split('\n');
  const maxLines = Math.max(origLines.length, targetLines.length);

  return (
    <div style={{ fontSize }} className="flex-1 flex overflow-hidden font-mono">
      {/* Left (Original) */}
      <div className="w-1/2 h-full border-r border-[var(--bd2)] flex flex-col overflow-hidden">
        <div className="px-3 py-1 bg-[var(--s3)] border-b border-[var(--bd2)] text-[11px] text-[var(--tx4)] font-semibold select-none">
          Original Base
        </div>
        <div className="flex-1 overflow-auto p-2">
          {Array.from({ length: maxLines }).map((_, i) => {
            const line = origLines[i];
            const targetLine = targetLines[i];
            const isDiff = line !== targetLine;
            return (
              <div
                key={i}
                className={`flex items-start py-0.5 px-1 rounded ${
                  line === undefined
                    ? 'bg-[var(--bg-deep)] text-[var(--tx6)]'
                    : isDiff
                    ? 'bg-[var(--danger-bg)] text-[var(--danger-text)]'
                    : 'text-[var(--tx3)] hover:bg-[var(--s7)]'
                }`}
              >
                <span className="w-8 text-right pr-2 text-[10.5px] text-[var(--tx6)] select-none flex-shrink-0">
                  {line !== undefined ? i + 1 : ''}
                </span>
                <pre className="flex-1 whitespace-pre-wrap break-all">
                  {line ?? ''}
                </pre>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right (Modified) */}
      <div className="w-1/2 h-full flex flex-col overflow-hidden">
        <div className="px-3 py-1 bg-[var(--s3)] border-b border-[var(--bd2)] text-[11px] text-[var(--tx4)] font-semibold select-none">
          Modified Target
        </div>
        <div className="flex-1 overflow-auto p-2">
          {Array.from({ length: maxLines }).map((_, i) => {
            const line = targetLines[i];
            const origLine = origLines[i];
            const isDiff = line !== origLine;
            return (
              <div
                key={i}
                className={`flex items-start py-0.5 px-1 rounded ${
                  line === undefined
                    ? 'bg-[var(--bg-deep)] text-[var(--tx6)]'
                    : isDiff
                    ? 'bg-[var(--success-bg)] text-[var(--success-text)]'
                    : 'text-[var(--tx3)] hover:bg-[var(--s7)]'
                }`}
              >
                <span className="w-8 text-right pr-2 text-[10.5px] text-[var(--tx6)] select-none flex-shrink-0">
                  {line !== undefined ? i + 1 : ''}
                </span>
                <pre className="flex-1 whitespace-pre-wrap break-all">
                  {line ?? ''}
                </pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
