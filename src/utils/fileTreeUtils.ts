import { FileFilterCategory, FileMetadata } from '../types/file';

/**
 * Filter a single file metadata item according to search, category, and hidden flags.
 */
export function isFileVisible(
  file: FileMetadata,
  showHiddenFiles: boolean,
  searchQuery: string,
  categoryFilter: FileFilterCategory
): boolean {
  if (!showHiddenFiles && (file.is_hidden || file.name.startsWith('.'))) {
    return false;
  }

  if (searchQuery) {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch && !file.is_dir) return false;
  }

  if (categoryFilter !== 'ALL' && !file.is_dir) {
    if (categoryFilter === 'MD' && file.category !== 'markdown') return false;
    if (categoryFilter === 'CODE' && file.category !== 'code') return false;
    if (categoryFilter === 'HTML' && file.category !== 'html') return false;
    if (categoryFilter === 'DATA' && file.category !== 'data') return false;
    if (
      categoryFilter === 'MEDIA' &&
      file.category !== 'image' &&
      file.category !== 'audio' &&
      file.category !== 'video'
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Traverses files and expanded directories in visual display order, returning all visible items.
 */
export function getVisibleFiles(
  files: FileMetadata[],
  dirCache: Record<string, FileMetadata[]>,
  expandedDirs: Set<string>,
  showHiddenFiles: boolean,
  searchQuery: string,
  categoryFilter: FileFilterCategory
): FileMetadata[] {
  const result: FileMetadata[] = [];

  const traverse = (items: FileMetadata[]) => {
    for (const item of items) {
      if (isFileVisible(item, showHiddenFiles, searchQuery, categoryFilter)) {
        result.push(item);
        if (item.is_dir && expandedDirs.has(item.path)) {
          const children = dirCache[item.path] || [];
          traverse(children);
        }
      }
    }
  };

  traverse(files);
  return result;
}

/**
 * Retrieves all FileMetadata objects corresponding to selectedPaths from files and dirCache.
 */
export function getSelectedFiles(
  selectedPaths: string[],
  files: FileMetadata[],
  dirCache: Record<string, FileMetadata[]>
): FileMetadata[] {
  if (selectedPaths.length === 0) return [];

  const pathSet = new Set(selectedPaths);
  const fileMap = new Map<string, FileMetadata>();

  // Add top-level files
  for (const f of files) {
    if (pathSet.has(f.path)) {
      fileMap.set(f.path, f);
    }
  }

  // Add cached directory children
  for (const children of Object.values(dirCache)) {
    for (const f of children) {
      if (pathSet.has(f.path)) {
        fileMap.set(f.path, f);
      }
    }
  }

  // Return in the order of selectedPaths, or fallback to mock metadata if not cached yet
  return selectedPaths.map((p) => {
    const found = fileMap.get(p);
    if (found) return found;

    // Fallback minimal metadata if not in cache
    const name = p.split('/').pop() || p;
    const dotIdx = name.lastIndexOf('.');
    const ext = dotIdx > 0 ? name.slice(dotIdx + 1) : null;
    return {
      name,
      path: p,
      is_dir: false,
      size: 0,
      modified_ms: Date.now(),
      extension: ext,
      category: 'other',
      is_binary: false,
      is_hidden: name.startsWith('.'),
      readonly: false,
    } as FileMetadata;
  });
}
