import { invoke } from '@tauri-apps/api/core';
import { FileMetadata, TokenStats } from '../types/file';
import { formatBytes } from './formatters';

export function formatFileForLlmContext(
  file: FileMetadata,
  content: string,
  stats?: TokenStats | null
): string {
  const ext = file.extension?.toLowerCase() || '';
  const lang = ext ? ext : 'text';
  const sizeStr = formatBytes(file.size);
  const tokenStr = stats ? ` | ~${stats.token_count} tokens | ${stats.line_count} lines` : '';

  return `## File: \`${file.name}\` (${file.path})\n` +
    `<!-- Metadata: Size: ${sizeStr}${tokenStr} | Last Modified: ${new Date(file.modified_ms).toISOString()} -->\n\n` +
    `\`\`\`${lang}\n` +
    `${content}\n` +
    `\`\`\`\n`;
}

export function formatMultipleFilesForLlmContext(
  items: Array<{ file: FileMetadata; content: string; stats?: TokenStats | null }>
): string {
  return items
    .map(({ file, content, stats }) => formatFileForLlmContext(file, content, stats))
    .join('\n---\n\n');
}

export interface BatchLlmResult {
  prompt: string;
  totalTokens: number;
  totalLines: number;
  fileCount: number;
  skippedCount: number;
}

export async function generateBatchLlmContext(
  files: FileMetadata[]
): Promise<BatchLlmResult> {
  const items: Array<{ file: FileMetadata; content: string; stats?: TokenStats | null }> = [];
  let totalTokens = 0;
  let totalLines = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (file.is_dir || file.is_binary) {
      skippedCount++;
      continue;
    }

    try {
      const text: string = await invoke('read_file_text', { path: file.path });
      let stats: TokenStats | null = null;
      try {
        stats = await invoke('calculate_tokens', { text });
      } catch {
        stats = {
          token_count: Math.ceil(text.length / 4),
          line_count: text.split('\n').length,
          word_count: text.split(/\s+/).filter(Boolean).length,
          char_count: text.length,
        };
      }

      if (stats) {
        totalTokens += stats.token_count;
        totalLines += stats.line_count;
      }

      items.push({ file, content: text, stats });
    } catch {
      skippedCount++;
    }
  }

  return {
    prompt: formatMultipleFilesForLlmContext(items),
    totalTokens,
    totalLines,
    fileCount: items.length,
    skippedCount,
  };
}
