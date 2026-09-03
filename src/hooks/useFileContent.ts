import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileMetadata, TokenStats } from '../types/file';

type TextCacheEntry = { content: string; modified: number; bytes: number };

const MAX_TEXT_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_TEXT_CACHE_ENTRIES = 32;
const MAX_TOKEN_CACHE_ENTRIES = 256;
let textCacheBytes = 0;
const textCache = new Map<string, TextCacheEntry>();
const tokenCache = new Map<string, { stats: TokenStats; modified: number }>();

function cacheText(path: string, content: string, modified: number) {
  const previous = textCache.get(path);
  if (previous) textCacheBytes -= previous.bytes;
  const entry = { content, modified, bytes: content.length * 2 };
  textCache.delete(path);
  textCache.set(path, entry);
  textCacheBytes += entry.bytes;

  while (textCache.size > MAX_TEXT_CACHE_ENTRIES || textCacheBytes > MAX_TEXT_CACHE_BYTES) {
    const oldest = textCache.entries().next().value as [string, TextCacheEntry] | undefined;
    if (!oldest) break;
    textCache.delete(oldest[0]);
    textCacheBytes -= oldest[1].bytes;
  }
}

function cacheTokens(path: string, stats: TokenStats, modified: number) {
  tokenCache.delete(path);
  tokenCache.set(path, { stats, modified });
  while (tokenCache.size > MAX_TOKEN_CACHE_ENTRIES) {
    const oldest = tokenCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    tokenCache.delete(oldest);
  }
}

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

        // Media and PDF viewers stream the original file through Tauri's
        // asset URL. Only spreadsheet parsers still need binary IPC data.
        const isPreviewableBinary =
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

        // Check the bounded text cache.
        const cached = textCache.get(file.path);
        let text = '';
        if (cached && cached.modified === file.modified_ms) {
          text = cached.content;
          // Refresh insertion order so frequently opened files stay resident.
          textCache.delete(file.path);
          textCache.set(file.path, cached);
        } else {
          text = await invoke('read_file_text', { path: file.path });
          if (currentReqId !== requestIdRef.current) return;
          cacheText(file.path, text, file.modified_ms);
        }
        const cachedTokens = tokenCache.get(file.path);
        if (cachedTokens && cachedTokens.modified === file.modified_ms) {
          setTokenStats(cachedTokens.stats);
          tokenCache.delete(file.path);
          tokenCache.set(file.path, cachedTokens);
        } else {
          try {
            const stats: TokenStats = await invoke('calculate_tokens', { text });
            if (currentReqId === requestIdRef.current) {
              setTokenStats(stats);
              cacheTokens(file.path, stats, file.modified_ms);
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
        const modified = Date.now();
        cacheText(file.path, newContent, modified);
        setContent(newContent);

        const stats: TokenStats = await invoke('calculate_tokens', { text: newContent });
        setTokenStats(stats);
        cacheTokens(file.path, stats, modified);
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
