import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { WrapText, MapPin } from 'lucide-react';
import { getLanguageFromPath } from '../../utils/formatters';

interface CodeViewerProps {
  filePath: string;
  content: string;
  onChange?: (newContent: string) => void;
  isEditing?: boolean;
  onSave?: () => Promise<void>;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  filePath,
  content,
  onChange,
  isEditing = false,
  onSave,
}) => {
  const language = getLanguageFromPath(filePath);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [minimapEnabled, setMinimapEnabled] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0d0f15]">
      {/* Code Editor Mini Controls Strip */}
      <div className="h-7 bg-[#11131c] border-b border-slate-800/80 px-3 flex items-center justify-between text-[11px] text-slate-400 select-none">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-300 font-medium uppercase text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
            {language}
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-mono">
            {isEditing ? 'Editing Mode (Ctrl+S to save)' : 'Read-only Mode'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWordWrap((w) => (w === 'on' ? 'off' : 'on'))}
            title="Toggle Word Wrap"
            className={`p-1 rounded transition-colors ${
              wordWrap === 'on' ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMinimapEnabled((m) => !m)}
            title="Toggle Minimap"
            className={`p-1 rounded transition-colors ${
              minimapEnabled ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 w-full h-full overflow-hidden">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={content}
          onChange={(val) => onChange?.(val || '')}
          options={{
            readOnly: !isEditing,
            minimap: { enabled: minimapEnabled },
            fontSize: 13,
            fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
            wordWrap,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
};
