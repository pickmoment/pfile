import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GitBranch,
  GitCommitHorizontal,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  RotateCcw,
  Check,
  Clock,
  Undo2,
  Eye,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';
import { GitDetailsModal } from './GitDetailsModal';
import { GitBranchMenu } from './GitBranchMenu';
import { GitCommitDetail, GitFileStatus, GitLogEntry } from '../../types/file';

// ── Status badge helper ─────────────────────────────────────────

function statusLabel(s: GitFileStatus): string {
  if (s.worktree_status === 'conflicted') return 'C';
  const idx = s.index_status;
  const wt = s.worktree_status;
  if (idx && wt) return statusChar(idx) + statusChar(wt);
  return statusChar(idx ?? wt ?? 'untracked');
}

function statusChar(kind: string): string {
  switch (kind) {
    case 'modified':  return 'M';
    case 'added':     return 'A';
    case 'deleted':   return 'D';
    case 'renamed':   return 'R';
    case 'untracked': return '?';
    case 'conflicted': return 'C';
    default:          return '·';
  }
}

function statusColor(s: GitFileStatus): string {
  if (s.worktree_status === 'conflicted') return 'text-[var(--git-deleted)]';
  if (s.index_status) return 'text-[var(--git-staged)]';
  if (s.worktree_status === 'untracked') return 'text-[var(--tx5)]';
  if (s.worktree_status === 'deleted') return 'text-[var(--git-deleted)]';
  return 'text-[var(--git-modified)]';
}

function fileName(path: string): string {
  return path.split('/').pop() || path;
}

// ── Sub-components ──────────────────────────────────────────────

const FileEntry: React.FC<{
  file: GitFileStatus;
  action: 'stage' | 'unstage';
  onAction: (path: string) => void;
  onDiscard?: (path: string) => void;
  onView: (file: GitFileStatus) => void;
}> = ({ file, action, onAction, onDiscard, onView }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => onView(file)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') onView(file);
    }}
    className="group flex items-center gap-1.5 px-2 py-[3px] hover:bg-[var(--s6)] rounded text-[11.5px] cursor-pointer"
    title="View diff"
  >
    <span className={`font-mono font-bold w-5 text-center text-[10px] ${statusColor(file)}`}>
      {statusLabel(file)}
    </span>
    <span className="flex-1 truncate text-[var(--tx2)]" title={file.path}>
      {fileName(file.path)}
    </span>
    <span className="truncate text-[var(--tx6)] text-[10px] max-w-[100px]" title={file.path}>
      {file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''}
    </span>
    <Eye className="w-3 h-3 text-[var(--tx5)] opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {onDiscard && file.worktree_status && file.worktree_status !== 'untracked' && (
        <button
          onClick={(e) => { e.stopPropagation(); onDiscard(file.path); }}
          className="p-0.5 rounded hover:bg-[var(--s8)] text-[var(--tx5)] hover:text-red-400"
          title="Discard changes"
        >
          <Undo2 className="w-3 h-3" />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onAction(file.path); }}
        className="p-0.5 rounded hover:bg-[var(--s8)] text-[var(--tx5)] hover:text-[var(--tx1)]"
        title={action === 'stage' ? 'Stage' : 'Unstage'}
      >
        {action === 'stage' ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      </button>
    </div>
  </div>
);

// ── Main Panel ──────────────────────────────────────────────────

export const GitPanel: React.FC = () => {
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const showToast = useToastStore((s) => s.showToast);

  const isRepo = useGitStore((s) => s.isRepo);
  const files = useGitStore((s) => s.files);
  const stagedCount = useGitStore((s) => s.stagedCount);
  const log = useGitStore((s) => s.log);
  const commitMessage = useGitStore((s) => s.commitMessage);
  const isCommitting = useGitStore((s) => s.isCommitting);
  const gitPanelTab = useGitStore((s) => s.gitPanelTab);

  const refreshGitStatus = useGitStore((s) => s.refreshGitStatus);
  const loadLog = useGitStore((s) => s.loadLog);
  const stageFiles = useGitStore((s) => s.stageFiles);
  const unstageFiles = useGitStore((s) => s.unstageFiles);
  const stageAll = useGitStore((s) => s.stageAll);
  const unstageAll = useGitStore((s) => s.unstageAll);
  const commit = useGitStore((s) => s.commit);
  const discardFiles = useGitStore((s) => s.discardFiles);
  const getDiff = useGitStore((s) => s.getDiff);
  const getCommitDetail = useGitStore((s) => s.getCommitDetail);
  const getCommitDiff = useGitStore((s) => s.getCommitDiff);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const setGitPanelTab = useGitStore((s) => s.setGitPanelTab);

  const [stagedOpen, setStagedOpen] = useState(true);
  const [changesOpen, setChangesOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState('Git Diff');
  const [commitDetail, setCommitDetail] = useState<GitCommitDetail | null>(null);
  const [selectedCommitPath, setSelectedCommitPath] = useState<string | null>(null);
  const [patch, setPatch] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const detailsRequestRef = useRef(0);


  // Auto-refresh periodically (every 5s when panel is visible)
  useEffect(() => {
    if (!currentDirectory || !isRepo) return;
    const id = setInterval(() => refreshGitStatus(currentDirectory), 5000);
    return () => clearInterval(id);
  }, [currentDirectory, isRepo, refreshGitStatus]);

  // Load log when tab switches
  useEffect(() => {
    if (gitPanelTab === 'log' && currentDirectory && isRepo) {
      loadLog(currentDirectory);
    }
  }, [gitPanelTab, currentDirectory, isRepo, loadLog]);

  const handleStage = useCallback((path: string) => {
    if (currentDirectory) stageFiles(currentDirectory, [path]);
  }, [currentDirectory, stageFiles]);

  const handleUnstage = useCallback((path: string) => {
    if (currentDirectory) unstageFiles(currentDirectory, [path]);
  }, [currentDirectory, unstageFiles]);

  const handleDiscard = useCallback((path: string) => {
    if (currentDirectory) discardFiles(currentDirectory, [path]);
  }, [currentDirectory, discardFiles]);


  const handleWorkingDiff = useCallback(async (file: GitFileStatus, staged: boolean) => {
    if (!currentDirectory) return;
    const requestId = ++detailsRequestRef.current;
    setDetailsOpen(true);
    setDetailsTitle(`${staged ? 'Staged' : 'Working Tree'} · ${file.path}`);
    setCommitDetail(null);
    setSelectedCommitPath(null);
    setPatch('');
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const nextPatch = await getDiff(currentDirectory, file.path, staged);
      if (requestId === detailsRequestRef.current) setPatch(nextPatch);
    } catch (err: unknown) {
      if (requestId === detailsRequestRef.current) setDetailsError(String(err));
    } finally {
      if (requestId === detailsRequestRef.current) setDetailsLoading(false);
    }
  }, [currentDirectory, getDiff]);

  const handleLogEntry = useCallback(async (entry: GitLogEntry) => {
    if (!currentDirectory) return;
    const requestId = ++detailsRequestRef.current;
    setDetailsOpen(true);
    setDetailsTitle(`Commit ${entry.short_id}`);
    setCommitDetail(null);
    setSelectedCommitPath(null);
    setPatch('');
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const [detail, nextPatch] = await Promise.all([
        getCommitDetail(currentDirectory, entry.id),
        getCommitDiff(currentDirectory, entry.id),
      ]);
      if (requestId === detailsRequestRef.current) {
        setCommitDetail(detail);
        setPatch(nextPatch);
      }
    } catch (err: unknown) {
      if (requestId === detailsRequestRef.current) setDetailsError(String(err));
    } finally {
      if (requestId === detailsRequestRef.current) setDetailsLoading(false);
    }
  }, [currentDirectory, getCommitDetail, getCommitDiff]);

  const handleCommitFile = useCallback(async (filePath?: string) => {
    if (!currentDirectory || !commitDetail) return;
    const requestId = ++detailsRequestRef.current;
    setSelectedCommitPath(filePath ?? null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const nextPatch = await getCommitDiff(currentDirectory, commitDetail.id, filePath);
      if (requestId === detailsRequestRef.current) setPatch(nextPatch);
    } catch (err: unknown) {
      if (requestId === detailsRequestRef.current) setDetailsError(String(err));
    } finally {
      if (requestId === detailsRequestRef.current) setDetailsLoading(false);
    }
  }, [commitDetail, currentDirectory, getCommitDiff]);

  const handleDetailsClose = useCallback(() => {
    detailsRequestRef.current += 1;
    setDetailsOpen(false);
  }, []);
  const handleCommit = useCallback(async () => {
    if (!currentDirectory) return;
    try {
      const shortId = await commit(currentDirectory);
      if (shortId) {
        showToast('Committed', `${shortId} — ${commitMessage.slice(0, 40)}`, 'success');
      }
    } catch (err) {
      showToast('Commit failed', String(err), 'error');
    }
  }, [currentDirectory, commit, commitMessage, showToast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  }, [handleCommit]);

  if (!isRepo) return null;

  // Separate staged vs unstaged files
  const staged = files.filter((f) => f.index_status !== null);
  const unstaged = files.filter(
    (f) => f.worktree_status !== null && f.worktree_status !== 'ignored'
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Branch Header */}
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-[var(--bd2)]">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx4)] uppercase tracking-wider">
          <GitBranch className="w-3.5 h-3.5 text-orange-400" />
          <span>Source Control</span>
        </div>
        <button
          onClick={() => currentDirectory && refreshGitStatus(currentDirectory)}
          className="p-0.5 rounded hover:bg-[var(--s6)] text-[var(--tx5)] hover:text-[var(--tx2)]"
          title="Refresh"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      <GitBranchMenu currentDirectory={currentDirectory} />

      {/* Tab Switcher */}
      <div className="flex border-b border-[var(--bd2)]">
        <button
          onClick={() => setGitPanelTab('changes')}
          className={`flex-1 py-1.5 text-[11px] font-medium text-center transition-colors ${
            gitPanelTab === 'changes'
              ? 'text-[var(--tx1)] border-b-2 border-blue-400'
              : 'text-[var(--tx5)] hover:text-[var(--tx3)]'
          }`}
        >
          Changes
          {files.length > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--s7)] text-[var(--tx4)]">
              {files.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setGitPanelTab('log')}
          className={`flex-1 py-1.5 text-[11px] font-medium text-center transition-colors ${
            gitPanelTab === 'log'
              ? 'text-[var(--tx1)] border-b-2 border-blue-400'
              : 'text-[var(--tx5)] hover:text-[var(--tx3)]'
          }`}
        >
          <Clock className="w-3 h-3 inline-block mr-1 -mt-0.5" />
          Log
        </button>
      </div>

      {/* Changes Tab */}
      {gitPanelTab === 'changes' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Commit Input */}
          <div className="px-2 pt-2 pb-1.5 border-b border-[var(--bd2)]">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Commit message (Ctrl+Enter to commit)"
              className="w-full bg-[var(--s6)] border border-[var(--bd2)] rounded px-2 py-1.5 text-[11.5px] text-[var(--tx2)] placeholder:text-[var(--tx6)] resize-none focus:outline-none focus:border-blue-500/50"
              rows={2}
            />
            <button
              onClick={handleCommit}
              disabled={isCommitting || !commitMessage.trim() || stagedCount === 0}
              className="mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-3 h-3" />
              {isCommitting ? 'Committing…' : `Commit (${stagedCount} staged)`}
            </button>
          </div>

          {/* File Lists */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {/* Staged Files */}
            {staged.length > 0 && (
              <div>
                <button
                  onClick={() => setStagedOpen(!stagedOpen)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[var(--git-staged)] uppercase tracking-wider hover:bg-[var(--s6)]"
                >
                  {stagedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>Staged ({staged.length})</span>
                  <div className="flex-1" />
                  <button
                    onClick={(e) => { e.stopPropagation(); currentDirectory && unstageAll(currentDirectory); }}
                    className="p-0.5 rounded hover:bg-[var(--s8)] text-[var(--tx5)] hover:text-[var(--tx2)]"
                    title="Unstage all"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </button>
                {stagedOpen && staged.map((file) => (
                  <FileEntry
                    key={`s-${file.path}`}
                    file={file}
                    action="unstage"
                    onAction={handleUnstage}
                    onView={(selected) => handleWorkingDiff(selected, true)}
                  />
                ))}
              </div>
            )}

            {/* Unstaged Changes */}
            {unstaged.length > 0 && (
              <div>
                <button
                  onClick={() => setChangesOpen(!changesOpen)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[var(--git-modified)] uppercase tracking-wider hover:bg-[var(--s6)]"
                >
                  {changesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>Changes ({unstaged.length})</span>
                  <div className="flex-1" />
                  <button
                    onClick={(e) => { e.stopPropagation(); currentDirectory && stageAll(currentDirectory); }}
                    className="p-0.5 rounded hover:bg-[var(--s8)] text-[var(--tx5)] hover:text-[var(--tx2)]"
                    title="Stage all"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </button>
                {changesOpen && unstaged.map((file) => (
                  <FileEntry
                    key={`u-${file.path}`}
                    file={file}
                    action="stage"
                    onAction={handleStage}
                    onDiscard={handleDiscard}
                    onView={(selected) => handleWorkingDiff(selected, false)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {staged.length === 0 && unstaged.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-[var(--tx5)] text-[11px]">
                <Check className="w-6 h-6 mb-2 text-emerald-500/50" />
                <span>Working tree clean</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Tab */}
      {gitPanelTab === 'log' && (
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {log.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--tx5)] text-[11px]">
              <GitCommitHorizontal className="w-6 h-6 mb-2 text-[var(--tx6)]" />
              <span>No commits yet</span>
            </div>
          )}
          {log.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleLogEntry(entry)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') handleLogEntry(entry);
              }}
              className="px-3 py-1.5 border-b border-[var(--bd2)] hover:bg-[var(--s6)] cursor-pointer"
              title="View commit details"
            >
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="font-mono text-blue-400 text-[10px]">{entry.short_id}</span>
                <span className="text-[var(--tx2)] truncate flex-1">{entry.summary}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--tx5)] mt-0.5">
                <span>{entry.author}</span>
                <span>·</span>
                <span>{entry.relative_time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <GitDetailsModal
        isOpen={detailsOpen}
        title={detailsTitle}
        detail={commitDetail}
        patch={patch}
        selectedPath={selectedCommitPath}
        loading={detailsLoading}
        error={detailsError}
        onSelectFile={commitDetail ? handleCommitFile : undefined}
        onClose={handleDetailsClose}
      />
    </div>
  );
};
