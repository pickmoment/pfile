import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileMetadata, TokenStats } from '../types/file';

const textCache = new Map<string, { content: string; modified: number }>();
const tokenCache = new Map<string, { stats: TokenStats; modified: number }>();

export function useFileContent(file: FileMetadata | null) {
  const [content, setContent] = useState<string>('');
  const [binaryBase64, setBinaryBase64] = useState<string>('');
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const ext = file?.extension?.toLowerCase() || '';
  const isBinary = Boolean(
    file?.is_binary ||
    file?.category === 'image' ||
    file?.category === 'audio' ||
    file?.category === 'video' ||
    ext === 'pdf' ||
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'xlsm' ||
    ext === 'xlsb' ||
    ext === 'ods' ||
    ext === 'docx' ||
    ext === 'doc' ||
    ext === 'pptx' ||
    ext === 'zip' ||
    ext === 'tar' ||
    ext === 'gz' ||
    ext === 'exe' ||
    ext === 'dll' ||
    ext === 'bin'
  );

  const loadContent = useCallback(async () => {
    const currentReqId = ++requestIdRef.current;

    if (!file || file.is_dir) {
      setContent('');
      setBinaryBase64('');
      setTokenStats(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isBinary) {
        // Clear text immediately to prevent stale large text renders
        setContent('');
        setTokenStats(null);

        // Only fetch binary base64 if needed for media/excel/pdf preview
        const isPreviewableBinary =
          file.category === 'image' ||
          file.category === 'audio' ||
          file.category === 'video' ||
          ext === 'pdf' ||
          ext === 'xlsx' ||
          ext === 'xls' ||
          ext === 'xlsm' ||
          ext === 'xlsb' ||
          ext === 'ods';

        if (isPreviewableBinary) {
          const base64Data: string = await invoke('read_file_binary_base64', { path: file.path });
          if (currentReqId !== requestIdRef.current) return;
          setBinaryBase64(base64Data);
        } else {
          setBinaryBase64('');
        }
      } else {
        setBinaryBase64('');

        // Check text cache
        const cached = textCache.get(file.path);
        let text = '';
        if (cached && cached.modified === file.modified_ms) {
          text = cached.content;
        } else {
          text = await invoke('read_file_text', { path: file.path });
          if (currentReqId !== requestIdRef.current) return;
          textCache.set(file.path, { content: text, modified: file.modified_ms });
        }

        if (currentReqId !== requestIdRef.current) return;
        setContent(text);

        // Compute tokens asynchronously without blocking UI
        const cachedTokens = tokenCache.get(file.path);
        if (cachedTokens && cachedTokens.modified === file.modified_ms) {
          setTokenStats(cachedTokens.stats);
        } else {
          try {
            const stats: TokenStats = await invoke('calculate_tokens', { text });
            if (currentReqId === requestIdRef.current) {
              setTokenStats(stats);
              tokenCache.set(file.path, { stats, modified: file.modified_ms });
            }
          } catch (tErr) {
            console.warn('Failed to calculate tokens:', tErr);
          }
        }
      }
    } catch (err: unknown) {
      if (currentReqId !== requestIdRef.current) return;
      console.error('Failed to load file content:', err);
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to read file';
      setError(msg);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [file, isBinary, ext]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const saveContent = useCallback(
    async (newContent: string) => {
      if (!file || isBinary) return;
      try {
        await invoke('write_file_text', { path: file.path, content: newContent });
        textCache.set(file.path, { content: newContent, modified: Date.now() });
        setContent(newContent);

        // Recalculate tokens
        const stats: TokenStats = await invoke('calculate_tokens', { text: newContent });
        setTokenStats(stats);
        tokenCache.set(file.path, { stats, modified: Date.now() });
      } catch (err: unknown) {
        console.error('Failed to save file:', err);
        throw err;
      }
    },
    [file, isBinary]
  );

  return {
    content,
    binaryBase64,
    tokenStats,
    isLoading,
    error,
    reload: loadContent,
    saveContent,
    isBinary,
  };
}
