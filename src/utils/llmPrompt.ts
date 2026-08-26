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
