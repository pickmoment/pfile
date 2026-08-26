import React, { useState, useEffect, useMemo } from 'react';
import { diffLines, Change } from 'diff';
import { invoke } from '@tauri-apps/api/core';
import { Columns, AlignJustify, X, Plus, Minus, GitCompare } from 'lucide-react';
import { FileMetadata } from '../../types/file';
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

  // Compute diff
  const changes = useMemo(() => {
    return diffLines(originalContent, targetContent);
  }, [originalContent, targetContent]);

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
    <div className="w-full h-full flex flex-col bg-[#0b0c12] select-text overflow-hidden">
      {/* Diff Header */}
      <div className="h-10 bg-[#12141e] border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-300 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
            <GitCompare className="w-4 h-4 text-indigo-400" />
            <span>Comparing:</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
              - {originalFile.name} (Base)
            </span>
            <span className="text-slate-500">vs</span>
            <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              + {targetFile.name} (Modified)
            </span>
          </div>

          {/* Change counts */}
          <div className="flex items-center gap-2 font-mono text-[11px] ml-2">
            <span className="flex items-center gap-0.5 text-emerald-400 font-semibold">
              <Plus className="w-3 h-3" />
              {addedCount}
            </span>
            <span className="flex items-center gap-0.5 text-rose-400 font-semibold">
              <Minus className="w-3 h-3" />
              {removedCount}
            </span>
          </div>
        </div>

        {/* Right: Mode switches and close */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0a0b10] p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setDiffMode('side-by-side')}
              title="Side by Side"
              className={`p-1.5 rounded text-xs transition-colors ${
                diffMode === 'side-by-side' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDiffMode('inline')}
              title="Inline Unified"
              className={`p-1.5 rounded text-xs transition-colors ${
                diffMode === 'inline' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onClose}
            title="Exit Diff Mode"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diff Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
          Calculating diff...
        </div>
      ) : diffMode === 'side-by-side' ? (
        <SideBySideDiff originalContent={originalContent} targetContent={targetContent} />
      ) : (
        <InlineDiff changes={changes} />
      )}
    </div>
  );
};

// Inline Unified Diff
const InlineDiff: React.FC<{ changes: Change[] }> = ({ changes }) => {
  let origLine = 1;
  let targetLine = 1;

  return (
    <div className="flex-1 overflow-auto font-mono text-xs p-2 leading-relaxed">
      {changes.map((change, cIdx) => {
        const lines = change.value.replace(/\n$/, '').split('\n');

        return lines.map((line, lIdx) => {
          let rowClass = 'hover:bg-slate-800/30 text-slate-300';
          let sign = ' ';
          let oNum = origLine.toString();
          let tNum = targetLine.toString();

          if (change.added) {
            rowClass = 'bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-200';
            sign = '+';
            oNum = '';
            targetLine++;
          } else if (change.removed) {
            rowClass = 'bg-rose-950/30 hover:bg-rose-950/50 text-rose-200';
            sign = '-';
            tNum = '';
            origLine++;
          } else {
            origLine++;
            targetLine++;
          }

          return (
            <div key={`${cIdx}-${lIdx}`} className={`flex items-start ${rowClass} py-0.5 px-1 rounded`}>
              <div className="w-10 text-right pr-2 text-[10.5px] text-slate-600 select-none flex-shrink-0">
                {oNum}
              </div>
              <div className="w-10 text-right pr-2 text-[10.5px] text-slate-600 select-none flex-shrink-0 border-r border-slate-800">
                {tNum}
              </div>
              <div className="w-5 text-center font-bold select-none text-[11px] flex-shrink-0">
                {sign}
              </div>
              <pre className="flex-1 whitespace-pre-wrap break-all font-mono text-[11.5px] overflow-hidden">
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
const SideBySideDiff: React.FC<{ originalContent: string; targetContent: string }> = ({
  originalContent,
  targetContent,
}) => {
  const origLines = originalContent.split('\n');
  const targetLines = targetContent.split('\n');
  const maxLines = Math.max(origLines.length, targetLines.length);

  return (
    <div className="flex-1 flex overflow-hidden font-mono text-xs">
      {/* Left (Original) */}
      <div className="w-1/2 h-full border-r border-slate-800 flex flex-col overflow-hidden">
        <div className="px-3 py-1 bg-[#10121a] border-b border-slate-800 text-[11px] text-slate-400 font-semibold select-none">
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
                    ? 'bg-slate-900/40 text-slate-600'
                    : isDiff
                    ? 'bg-rose-950/25 text-rose-200'
                    : 'text-slate-300 hover:bg-slate-800/30'
                }`}
              >
                <span className="w-8 text-right pr-2 text-[10.5px] text-slate-600 select-none flex-shrink-0">
                  {line !== undefined ? i + 1 : ''}
                </span>
                <pre className="flex-1 whitespace-pre-wrap break-all text-[11.5px]">
                  {line ?? ''}
                </pre>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right (Modified) */}
      <div className="w-1/2 h-full flex flex-col overflow-hidden">
        <div className="px-3 py-1 bg-[#10121a] border-b border-slate-800 text-[11px] text-slate-400 font-semibold select-none">
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
                    ? 'bg-slate-900/40 text-slate-600'
                    : isDiff
                    ? 'bg-emerald-950/25 text-emerald-200'
                    : 'text-slate-300 hover:bg-slate-800/30'
                }`}
              >
                <span className="w-8 text-right pr-2 text-[10.5px] text-slate-600 select-none flex-shrink-0">
                  {line !== undefined ? i + 1 : ''}
                </span>
                <pre className="flex-1 whitespace-pre-wrap break-all text-[11.5px]">
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
