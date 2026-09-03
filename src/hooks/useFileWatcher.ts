import { useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useFileStore } from '../store/useFileStore';
import { WatcherEventPayload } from '../types/tauri-events';

export function useFileWatcher() {
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    let debounceTimer: number | undefined;

    const setupListener = async () => {
      try {
        const cleanup = await listen<WatcherEventPayload>('file-watcher-event', () => {
          clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => {
            // One refresh updates both directory metadata and the selected file.
            void refreshDirectory();
          }, 150);
        });

        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      } catch (err: unknown) {
        if (!disposed) console.warn('Could not attach file watcher listener:', err);
      }
    };

    void setupListener();

    return () => {
      disposed = true;
      clearTimeout(debounceTimer);
      unlisten?.();
    };
  }, [refreshDirectory]);
}
