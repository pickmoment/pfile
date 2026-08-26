import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from './Modal';
import { useFileStore } from '../../store/useFileStore';
import { useToastStore } from '../../store/useToastStore';
import { Trash2, AlertTriangle } from 'lucide-react';

interface CreateItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'file' | 'folder';
  parentPath: string;
}

export const CreateItemDialog: React.FC<CreateItemDialogProps> = ({
  isOpen,
  onClose,
  type,
  parentPath,
}) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    if (isOpen) {
      setName(type === 'file' ? 'untitled.md' : 'new-folder');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, type]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      if (type === 'file') {
        await invoke('create_file', { parentPath, name: trimmed });
        showToast('Created', `File "${trimmed}" created`, 'success');
      } else {
        await invoke('create_directory', { parentPath, name: trimmed });
        showToast('Created', `Directory "${trimmed}" created`, 'success');
      }
      await refreshDirectory();
      onClose();
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Creation failed';
      showToast('Error', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'file' ? 'New File' : 'New Folder'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-[var(--tx3)] hover:text-white bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || isSubmitting}
            onClick={() => handleSubmit()}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-medium text-[var(--tx3)]">
          {type === 'file' ? 'File Name (with extension)' : 'Folder Name'}
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'file' ? 'e.g. analysis.md, server.ts' : 'e.g. components, docs'}
          className="w-full px-3 py-2 text-xs bg-[var(--s3)] border border-[var(--bd1)] rounded-lg text-[var(--tx1)] placeholder-[var(--tx5)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
        />
        <p className="text-[11px] text-[var(--tx4)]">
          Location: <span className="font-mono text-[var(--tx3)]">{parentPath}</span>
        </p>
      </form>
    </Modal>
  );
};

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourcePath: string;
  currentName: string;
}

export const RenameDialog: React.FC<RenameDialogProps> = ({
  isOpen,
  onClose,
  sourcePath,
  currentName,
}) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const dotIdx = currentName.lastIndexOf('.');
          if (dotIdx > 0) {
            inputRef.current.setSelectionRange(0, dotIdx);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke('rename_item', { sourcePath, newName: trimmed });
      showToast('Renamed', `Renamed to "${trimmed}"`, 'success');
      await refreshDirectory();
      onClose();
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Rename failed';
      showToast('Error', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Item"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-[var(--tx3)] hover:text-white bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || name === currentName || isSubmitting}
            onClick={() => handleSubmit()}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSubmitting ? 'Renaming...' : 'Rename'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-medium text-[var(--tx3)]">New Name</label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-[var(--s3)] border border-[var(--bd1)] rounded-lg text-[var(--tx1)] placeholder-[var(--tx5)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
        />
      </form>
    </Modal>
  );
};

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetPaths: string[];
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  targetPaths,
}) => {
  const [permanent, setPermanent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);
  const selectedFile = useFileStore((s) => s.selectedFile);
  const setSelectedFile = useFileStore((s) => s.setSelectedFile);
  const showToast = useToastStore((s) => s.showToast);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await invoke('delete_items', { paths: targetPaths, permanent });
      showToast(
        permanent ? 'Deleted Permanently' : 'Moved to Trash',
        `${targetPaths.length} item(s) removed`,
        'success'
      );

      if (selectedFile && targetPaths.includes(selectedFile.path)) {
        setSelectedFile(null);
      }

      await refreshDirectory();
      onClose();
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Delete failed';
      showToast('Error', msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Item(s)"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-[var(--tx3)] hover:text-white bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isDeleting ? 'Deleting...' : permanent ? 'Delete Permanently' : 'Move to Trash'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-rose-200">
              Are you sure you want to delete {targetPaths.length} item(s)?
            </p>
              <ul className="mt-1.5 max-h-24 overflow-y-auto space-y-0.5 text-[var(--tx3)] font-mono text-[11px]">
              {targetPaths.map((p) => (
                <li key={p} className="truncate">
                  • {p.split('/').pop() || p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--tx3)] select-none">
          <input
            type="checkbox"
            checked={permanent}
            onChange={(e) => setPermanent(e.target.checked)}
            className="rounded border-[var(--bd1)] bg-[var(--bg-deep)] text-rose-500 focus:ring-rose-500/30"
          />
          <span>Permanently delete (skip OS Recycle Bin / Trash)</span>
        </label>
      </div>
    </Modal>
  );
};
