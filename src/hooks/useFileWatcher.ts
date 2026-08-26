import { useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useFileStore } from '../store/useFileStore';
import { WatcherEventPayload } from '../types/tauri-events';

export function useFileWatcher() {
  const refreshDirectory = useFileStore((s) => s.refreshDirectory);
  const selectedFile = useFileStore((s) => s.selectedFile);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let debounceTimer: number | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen<WatcherEventPayload>('file-watcher-event', (event) => {
          clearTimeout(debounceTimer);

          debounceTimer = window.setTimeout(() => {
            refreshDirectory();
            if (selectedFile && event.payload.paths.includes(selectedFile.path)) {
              refreshDirectory();
            }
          }, 150);
        });
      } catch (err: unknown) {
        console.warn('Could not attach file watcher listener:', err);
      }
    };

    setupListener();

    return () => {
      clearTimeout(debounceTimer);
      if (unlisten) {
        unlisten();
      }
    };
  }, [refreshDirectory, selectedFile]);
}
