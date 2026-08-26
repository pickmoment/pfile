import React from 'react';
import {
  FileText,
  FileCode,
  FileJson,
  FileSpreadsheet,
  Image,
  Music,
  Video,
  File as FileIcon,
  Folder,
  FolderOpen,
  Globe,
  Settings,
  Terminal,
  Database,
  Layers,
  Sparkles,
  FileArchive,
  BookOpen,
} from 'lucide-react';
import { FileCategory } from '../types/file';

export function getFileIcon(
  category: FileCategory,
  extension: string | null,
  isDir: boolean,
  isOpen = false,
  className = 'w-4 h-4'
): React.ReactElement {
  if (isDir) {
    if (isOpen) {
      return <FolderOpen className={`${className} text-amber-400 flex-shrink-0`} />;
    }
    return <Folder className={`${className} text-amber-400/90 flex-shrink-0`} />;
  }

  const ext = extension?.toLowerCase() || '';

  if (category === 'markdown') {
    return <FileText className={`${className} text-sky-400 flex-shrink-0`} />;
  }

  if (category === 'html') {
    return <Globe className={`${className} text-orange-400 flex-shrink-0`} />;
  }

  if (category === 'image') {
    return <Image className={`${className} text-emerald-400 flex-shrink-0`} />;
  }

  if (category === 'audio') {
    return <Music className={`${className} text-pink-400 flex-shrink-0`} />;
  }

  if (category === 'video') {
    return <Video className={`${className} text-rose-400 flex-shrink-0`} />;
  }

  if (category === 'archive') {
    return <FileArchive className={`${className} text-violet-400 flex-shrink-0`} />;
  }

  if (category === 'data') {
    if (ext === 'json' || ext === 'jsonc') {
      return <FileJson className={`${className} text-yellow-400 flex-shrink-0`} />;
    }
    if (ext === 'csv' || ext === 'tsv') {
      return <FileSpreadsheet className={`${className} text-emerald-400 flex-shrink-0`} />;
    }
    if (ext === 'yaml' || ext === 'yml' || ext === 'toml' || ext === 'env') {
      return <Settings className={`${className} text-teal-400 flex-shrink-0`} />;
    }
    if (ext === 'sql' || ext === 'db') {
      return <Database className={`${className} text-cyan-400 flex-shrink-0`} />;
    }
    return <Layers className={`${className} text-yellow-300 flex-shrink-0`} />;
  }

  if (category === 'code') {
    if (ext === 'ts' || ext === 'tsx') {
      return <FileCode className={`${className} text-blue-400 flex-shrink-0`} />;
    }
    if (ext === 'js' || ext === 'jsx' || ext === 'mjs') {
      return <FileCode className={`${className} text-yellow-300 flex-shrink-0`} />;
    }
    if (ext === 'rs') {
      return <FileCode className={`${className} text-orange-500 flex-shrink-0`} />;
    }
    if (ext === 'py') {
      return <FileCode className={`${className} text-emerald-400 flex-shrink-0`} />;
    }
    if (ext === 'sh' || ext === 'bash' || ext === 'bat' || ext === 'ps1') {
      return <Terminal className={`${className} text-green-400 flex-shrink-0`} />;
    }
    if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') {
      return <Sparkles className={`${className} text-indigo-400 flex-shrink-0`} />;
    }
    return <FileCode className={`${className} text-blue-400 flex-shrink-0`} />;
  }

  if (ext === 'pdf') {
    return <FileText className={`${className} text-red-400 flex-shrink-0`} />;
  }

  if (ext === 'epub') {
    return <BookOpen className={`${className} text-teal-400 flex-shrink-0`} />;
  }

  return <FileIcon className={`${className} text-[var(--tx4)] flex-shrink-0`} />;
}
