import React from 'react';
import { FileCode2, GitCommitHorizontal, LoaderCircle, Minus, Plus } from 'lucide-react';
import { GitCommitDetail, GitCommitFile, GitFileStatusKind } from '../../types/file';
import { useViewerStore } from '../../store/useViewerStore';
import { Modal } from '../common/Modal';

interface GitDetailsModalProps {
  isOpen: boolean;
  title: string;
  detail?: GitCommitDetail | null;
  patch: string;
  selectedPath?: string | null;
  loading: boolean;
  error?: string | null;
  onSelectFile?: (path?: string) => void;
  onClose: () => void;
}

const statusLabel: Record<GitFileStatusKind, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  typechange: 'T',
  untracked: '?',
  ignored: 'I',
  conflicted: 'C',
};

const statusClass: Record<GitFileStatusKind, string> = {
  modified: 'text-amber-400',
  added: 'text-emerald-400',
  deleted: 'text-rose-400',
  renamed: 'text-sky-400',
  typechange: 'text-violet-400',
  untracked: 'text-[var(--tx4)]',
  ignored: 'text-[var(--tx6)]',
  conflicted: 'text-rose-400',
};

const CommitFileButton: React.FC<{
  file: GitCommitFile;
  selected: boolean;
  onClick: () => void;
}> = ({ file, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-mono transition-colors ${
      selected ? 'bg-[var(--selected-bg)] text-[var(--selected-text)]' : 'text-[var(--tx3)] hover:bg-[var(--s7)]'
    }`}
    title={file.old_path ? `${file.old_path} → ${file.path}` : file.path}
  >
    <span className={`w-4 text-center font-bold ${statusClass[file.status]}`}>{statusLabel[file.status]}</span>
    <span className="truncate">{file.path}</span>
  </button>
);

const PatchView: React.FC<{ patch: string }> = ({ patch }) => {
  const viewerFontScale = useViewerStore((state) => state.viewerFontScale);

  if (!patch) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[var(--tx5)]">
        No textual diff available.
      </div>
    );
  }

  return (
    <div
      style={{ fontSize: 11.5 * viewerFontScale / 100 }}
      className="h-full overflow-auto bg-[var(--s1)] font-mono leading-relaxed select-text"
    >
      {patch.split('\n').map((line, index) => {
        let className = 'text-[var(--tx3)]';
        if (line.startsWith('+++') || line.startsWith('---')) className = 'text-[var(--tx4)] font-semibold';
        else if (line.startsWith('+')) className = 'bg-[var(--success-bg)] text-[var(--success-text)]';
        else if (line.startsWith('-')) className = 'bg-[var(--danger-bg)] text-[var(--danger-text)]';
        else if (line.startsWith('@@')) className = 'bg-[var(--info-bg)] text-[var(--info-text)]';
        else if (line.startsWith('diff ') || line.startsWith('index ')) className = 'text-violet-400 font-semibold';

        return (
          <pre key={index} className={`min-w-max px-3 py-px whitespace-pre ${className}`}>
            {line || ' '}
          </pre>
        );
      })}
    </div>
  );
};

export const GitDetailsModal: React.FC<GitDetailsModalProps> = ({
  isOpen,
  title,
  detail,
  patch,
  selectedPath,
  loading,
  error,
  onSelectFile,
  onClose,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-6xl">
    <div className="h-[72vh] min-h-96 flex flex-col gap-3">
      {detail && (
        <section className="flex-shrink-0 rounded-lg border border-[var(--bd2)] bg-[var(--s3)] p-3 text-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[var(--tx2)]">
                <GitCommitHorizontal className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="font-mono text-blue-400">{detail.short_id}</span>
                <span className="font-semibold truncate">{detail.summary}</span>
              </div>
              <div className="mt-1 text-[11px] text-[var(--tx4)]">
                {detail.author} &lt;{detail.email}&gt; · {new Date(detail.timestamp * 1000).toLocaleString()}
              </div>
              <div className="mt-1 font-mono text-[10px] text-[var(--tx5)] break-all">{detail.id}</div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] flex-shrink-0">
              <span className="flex items-center text-[var(--success-text)]"><Plus className="w-3 h-3" />{detail.additions}</span>
              <span className="flex items-center text-[var(--danger-text)]"><Minus className="w-3 h-3" />{detail.deletions}</span>
              <span className="text-[var(--tx4)]">{detail.files.length} files</span>
            </div>
          </div>
          {detail.message && detail.message !== detail.summary && (
            <pre className="mt-3 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-[var(--s1)] px-3 py-2 font-mono text-[11px] text-[var(--tx3)]">
              {detail.message}
            </pre>
          )}
        </section>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden rounded-lg border border-[var(--bd2)]">
        {detail && onSelectFile && (
          <aside className="w-72 flex-shrink-0 overflow-y-auto border-r border-[var(--bd2)] bg-[var(--s3)]">
            <button
              onClick={() => onSelectFile()}
              className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-[11px] font-semibold border-b border-[var(--bd2)] ${
                !selectedPath ? 'bg-[var(--selected-bg)] text-[var(--selected-text)]' : 'text-[var(--tx3)] hover:bg-[var(--s7)]'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              All changes
            </button>
            {detail.files.map((file) => (
              <CommitFileButton
                key={`${file.status}-${file.path}`}
                file={file}
                selected={selectedPath === file.path}
                onClick={() => onSelectFile(file.path)}
              />
            ))}
          </aside>
        )}

        <main className="flex-1 min-w-0 bg-[var(--s1)]">
          {loading ? (
            <div className="h-full flex items-center justify-center gap-2 text-xs text-[var(--tx5)]">
              <LoaderCircle className="w-4 h-4 animate-spin text-blue-400" />
              Loading Git diff…
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center p-6 text-xs text-[var(--danger-text)]">{error}</div>
          ) : (
            <PatchView patch={patch} />
          )}
        </main>
      </div>
    </div>
  </Modal>
);
