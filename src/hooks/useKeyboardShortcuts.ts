import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../store/useFileStore';
import { useClipboardStore } from '../store/useClipboardStore';
import { useToastStore } from '../store/useToastStore';

interface ShortcutOptions {
  onRename?: () => void;
  onDelete?: () => void;
  onSearchFocus?: () => void;
}

export function useKeyboardShortcuts(options: ShortcutOptions = {}) {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const selectedPaths = useFileStore((s) => s.selectedPaths);
  const currentDirectory = useFileStore((s) => s.currentDirectory);
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);
  const setQuickJumpOpen = useFileStore((s) => s.setQuickJumpOpen);
  const isQuickJumpOpen = useFileStore((s) => s.isQuickJumpOpen);
  const setIsAddressBarEditing = useFileStore((s) => s.setIsAddressBarEditing);
  const showHiddenFiles = useFileStore((s) => s.showHiddenFiles);
  const toggleShowHiddenFiles = useFileStore((s) => s.toggleShowHiddenFiles);
  const goBack = useFileStore((s) => s.goBack);
  const goForward = useFileStore((s) => s.goForward);
  const goUp = useFileStore((s) => s.goUp);
  const clipboard = useClipboardStore((s) => s.clipboard);
  const copy = useClipboardStore((s) => s.copy);
  const cut = useClipboardStore((s) => s.cut);
  const clearClipboard = useClipboardStore((s) => s.clear);

  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.monaco-editor');

      // Ctrl/Cmd + P or Ctrl/Cmd + K: Quick Jump Command Palette
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setQuickJumpOpen(!isQuickJumpOpen);
        return;
      }

      // Ctrl/Cmd + L: Focus Address Bar
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L') && !isInput) {
        e.preventDefault();
        setIsAddressBarEditing(true);
        return;
      }
      // Ctrl/Cmd + H: Toggle Hidden Files
      if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H') && !isInput) {
        e.preventDefault();
        toggleShowHiddenFiles();
        showToast(
          !showHiddenFiles ? 'Showing Hidden Files' : 'Hiding Hidden Files',
          !showHiddenFiles ? 'Dotfiles and hidden items are visible' : 'Dotfiles are now hidden',
          'info'
        );
        return;
      }


      // Alt + Left: Navigate Back
      if (e.altKey && e.key === 'ArrowLeft' && !isInput) {
        e.preventDefault();
        goBack();
        return;
      }

      // Alt + Right: Navigate Forward
      if (e.altKey && e.key === 'ArrowRight' && !isInput) {
        e.preventDefault();
        goForward();
        return;
      }

      // Alt + Up: Navigate Up to Parent
      if (e.altKey && e.key === 'ArrowUp' && !isInput) {
        e.preventDefault();
        goUp();
        return;
      }

      // F2: Rename
      if (e.key === 'F2' && selectedFile && !isInput) {
        e.preventDefault();
        options.onRename?.();
        return;
      }

      // Delete: Delete selected
      if (e.key === 'Delete' && selectedPaths.length > 0 && !isInput) {
        e.preventDefault();
        options.onDelete?.();
        return;
      }

      // Ctrl/Cmd + F: Focus Search
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F') && !isInput) {
        e.preventDefault();
        options.onSearchFocus?.();
        return;
      }

      // F5 or Ctrl+R: Refresh
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        await refreshDirectory();
        showToast('Refreshed', 'Workspace directory reloaded', 'info');
        return;
      }

      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !isInput) {
        if (selectedPaths.length > 0) {
          e.preventDefault();
          copy(selectedPaths);
          showToast('Copied', `${selectedPaths.length} item(s) copied to clipboard`, 'info');
        }
        return;
      }

      // Ctrl/Cmd + X: Cut
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X') && !isInput) {
        if (selectedPaths.length > 0) {
          e.preventDefault();
          cut(selectedPaths);
          showToast('Cut', `${selectedPaths.length} item(s) cut to clipboard`, 'info');
        }
        return;
      }

      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !isInput) {
        if (clipboard && clipboard.paths.length > 0 && currentDirectory) {
          e.preventDefault();
          try {
            if (clipboard.type === 'copy') {
              await invoke('copy_items', {
                sources: clipboard.paths,
                targetDir: currentDirectory,
              });
              showToast('Pasted', `Copied ${clipboard.paths.length} item(s)`, 'success');
            } else if (clipboard.type === 'cut') {
              await invoke('move_items', {
                sources: clipboard.paths,
                targetDir: currentDirectory,
              });
              clearClipboard();
              showToast('Moved', `Moved ${clipboard.paths.length} item(s)`, 'success');
            }
            await refreshDirectory();
          } catch (err: unknown) {
            const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Paste failed';
            showToast('Error', msg, 'error');
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedFile,
    selectedPaths,
    currentDirectory,
    refreshDirectory,
    clipboard,
    copy,
    cut,
    clearClipboard,
    showToast,
    isQuickJumpOpen,
    setQuickJumpOpen,
    setIsAddressBarEditing,
    showHiddenFiles,
    toggleShowHiddenFiles,
    goBack,
    goForward,
    goUp,
    options,
  ]);
}
