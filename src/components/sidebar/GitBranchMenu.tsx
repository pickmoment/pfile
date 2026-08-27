import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  GitBranch,
  LoaderCircle,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useGitStore } from '../../store/useGitStore';
import { useToastStore } from '../../store/useToastStore';

interface GitBranchMenuProps {
  currentDirectory: string;
}

export const GitBranchMenu: React.FC<GitBranchMenuProps> = ({ currentDirectory }) => {
  const branch = useGitStore((state) => state.branch);
  const isDetached = useGitStore((state) => state.isDetached);
  const ahead = useGitStore((state) => state.ahead);
  const behind = useGitStore((state) => state.behind);
  const branches = useGitStore((state) => state.branches);
  const loadBranches = useGitStore((state) => state.loadBranches);
  const createBranch = useGitStore((state) => state.createBranch);
  const checkoutBranch = useGitStore((state) => state.checkoutBranch);
  const deleteBranch = useGitStore((state) => state.deleteBranch);
  const pull = useGitStore((state) => state.pull);
  const push = useGitStore((state) => state.push);
  const refreshDirectory = useFileStore((state) => state.refreshDirectory);
  const showToast = useToastStore((state) => state.showToast);

  const [open, setOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    loadBranches(currentDirectory).catch((error) => {
      showToast('Branch list failed', String(error), 'error');
    });
  }, [currentDirectory, loadBranches, showToast]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newBranchName.trim();
    if (!name || busy) return;
    setBusy('create');
    try {
      await createBranch(currentDirectory, name);
      await refreshDirectory();
      setNewBranchName('');
      showToast('Branch created', `Created and checked out ${name}`, 'success');
    } catch (error) {
      showToast('Create branch failed', String(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleCheckout = async (name: string) => {
    if (busy || name === branch) return;
    setBusy(`checkout:${name}`);
    try {
      await checkoutBranch(currentDirectory, name);
      await refreshDirectory();
      showToast('Branch switched', `Checked out ${name}`, 'success');
    } catch (error) {
      showToast('Checkout failed', String(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (busy || name === branch || !window.confirm(`Delete local branch "${name}"?`)) return;
    setBusy(`delete:${name}`);
    try {
      await deleteBranch(currentDirectory, name);
      showToast('Branch deleted', name, 'success');
    } catch (error) {
      showToast('Delete branch failed', String(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePull = async () => {
    if (busy) return;
    setBusy('pull');
    try {
      const message = await pull(currentDirectory);
      await refreshDirectory();
      showToast('Pull complete', message, 'success');
    } catch (error) {
      showToast('Pull failed', String(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePush = async () => {
    if (busy) return;
    setBusy('push');
    try {
      const message = await push(currentDirectory);
      showToast('Push complete', message, 'success');
    } catch (error) {
      showToast('Push failed', String(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="border-b border-[var(--bd2)] bg-[var(--s3)]">
      <div className="px-2 py-1.5 flex items-center gap-1">
        <button
          onClick={() => setOpen((value) => !value)}
          className="flex-1 min-w-0 flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-[var(--tx3)] hover:bg-[var(--s6)]"
          title="Manage branches"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <GitBranch className="w-3 h-3 text-orange-400 flex-shrink-0" />
          <span className={`font-mono font-medium truncate ${isDetached ? 'text-[var(--warning-text)]' : 'text-[var(--tx2)]'}`}>
            {isDetached ? `detached@${branch}` : branch ?? 'no branch'}
          </span>
          {(ahead > 0 || behind > 0) && (
            <span className="ml-auto font-mono text-[10px] text-[var(--tx5)]">
              {ahead > 0 ? `↑${ahead}` : ''}{behind > 0 ? ` ↓${behind}` : ''}
            </span>
          )}
        </button>
        <button
          onClick={handlePull}
          disabled={Boolean(busy) || isDetached}
          className="p-1 rounded text-[var(--tx4)] hover:text-sky-400 hover:bg-[var(--s6)] disabled:opacity-30"
          title="Pull (fast-forward only)"
        >
          {busy === 'pull' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handlePush}
          disabled={Boolean(busy) || isDetached}
          className="p-1 rounded text-[var(--tx4)] hover:text-emerald-400 hover:bg-[var(--s6)] disabled:opacity-30"
          title="Push current branch"
        >
          {busy === 'push' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--bd2)]">
          <form onSubmit={handleCreate} className="flex items-center gap-1 p-2 border-b border-[var(--bd2)]">
            <input
              value={newBranchName}
              onChange={(event) => setNewBranchName(event.target.value)}
              placeholder="New branch name"
              className="flex-1 min-w-0 rounded border border-[var(--bd2)] bg-[var(--s1)] px-2 py-1 text-[11px] font-mono text-[var(--tx2)] placeholder:text-[var(--tx6)] focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!newBranchName.trim() || Boolean(busy)}
              className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30"
              title="Create and checkout branch"
            >
              {busy === 'create' ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </button>
          </form>

          <div className="max-h-40 overflow-y-auto py-1">
            {branches.map((item) => (
              <div key={item.name} className="group flex items-center gap-1 px-2 hover:bg-[var(--s6)]">
                <button
                  onClick={() => handleCheckout(item.name)}
                  disabled={Boolean(busy) || item.current}
                  className="flex-1 min-w-0 flex items-center gap-2 py-1 text-left text-[11px] font-mono text-[var(--tx3)] disabled:cursor-default"
                  title={item.upstream ? `${item.name} → ${item.upstream}` : item.name}
                >
                  <span className="w-3 flex-shrink-0 text-emerald-400">
                    {item.current ? <Check className="w-3 h-3" /> : busy === `checkout:${item.name}` ? <LoaderCircle className="w-3 h-3 animate-spin" /> : null}
                  </span>
                  <span className={item.current ? 'text-[var(--tx1)] font-semibold truncate' : 'truncate'}>{item.name}</span>
                </button>
                {!item.current && (
                  <button
                    onClick={() => handleDelete(item.name)}
                    disabled={Boolean(busy)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--tx5)] hover:text-rose-400 disabled:opacity-20"
                    title="Delete local branch"
                  >
                    {busy === `delete:${item.name}` ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
