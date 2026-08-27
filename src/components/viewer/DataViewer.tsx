import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  Table as TableIcon,
  Layers,
  Code2,
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import { useToastStore } from '../../store/useToastStore';
import { useViewerStore } from '../../store/useViewerStore';

interface DataViewerProps {
  filePath: string;
  content: string;
  onChange?: (newContent: string) => void;
  isEditing?: boolean;
}

// JSON Tree Node
const JsonTreeNode: React.FC<{
  keyName?: string;
  value: unknown;
  depth?: number;
  search?: string;
}> = ({ keyName, value, depth = 0, search = '' }) => {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const showToast = useToastStore((s) => s.showToast);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    showToast('Copied Value', 'Copied JSON node to clipboard', 'info');
  };

  if (isObject) {
    const entries = isArray
      ? (value as unknown[]).map((v, i) => [i.toString(), v] as const)
      : Object.entries(value as Record<string, unknown>);

    const count = entries.length;

    return (
      <div className="font-mono select-text">
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${depth * 14}px` }}
          className="flex items-center gap-1.5 py-0.5 hover:bg-[var(--s7)] rounded cursor-pointer group"
        >
          <button className="text-[var(--tx5)] hover:text-[var(--tx3)] p-0.5">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {keyName !== undefined && (
            <span className="text-indigo-300 font-semibold">{keyName}: </span>
          )}

          <span className="text-[var(--tx4)]">
            {isArray ? `Array(${count}) [` : `Object {`}
          </span>

          {!isOpen && (
            <span className="text-[var(--tx6)] text-[11px]">
              ... {isArray ? ']' : '}'}
            </span>
          )}

          <button
            onClick={handleCopy}
            title="Copy subtree"
            className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 text-[var(--tx5)] hover:text-[var(--tx3)] transition-opacity"
          >
            <Copy className="w-2.5 h-2.5" />
          </button>
        </div>

        {isOpen && (
          <div className="space-y-0.5">
            {entries.map(([k, v]) => (
              <JsonTreeNode
                key={k}
                keyName={isArray ? undefined : k}
                value={v}
                depth={depth + 1}
                search={search}
              />
            ))}
            <div
              style={{ paddingLeft: `${depth * 14 + 16}px` }}
              className="text-[var(--tx4)] py-0.5"
            >
              {isArray ? ']' : '}'}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Primitive value
  let valueElem = <span className="text-[var(--tx4)]">null</span>;
  if (typeof value === 'string') {
    valueElem = <span className="text-emerald-400">"{value}"</span>;
  } else if (typeof value === 'number') {
    valueElem = <span className="text-sky-400 font-semibold">{value}</span>;
  } else if (typeof value === 'boolean') {
    valueElem = <span className="text-amber-400 font-bold">{value ? 'true' : 'false'}</span>;
  }

  return (
    <div
      style={{ paddingLeft: `${depth * 14 + 16}px` }}
      className="flex items-center gap-1.5 py-0.5 hover:bg-[var(--s7)] rounded font-mono group select-text"
    >
      {keyName !== undefined && (
        <span className="text-indigo-300 font-semibold">{keyName}: </span>
      )}
      {valueElem}
      <button
        onClick={handleCopy}
        title="Copy value"
        className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 text-[var(--tx5)] hover:text-[var(--tx3)] transition-opacity"
      >
        <Copy className="w-2.5 h-2.5" />
      </button>
    </div>
  );
};

// CSV / TSV Table View
const CsvTableView: React.FC<{ content: string; delimiter?: string; fontSize: number }> = ({
  content,
  delimiter = ',',
  fontSize,
}) => {
  const [filter, setFilter] = useState('');

  const { headers, rows } = useMemo(() => {
    const lines = content.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    // Simple parse (or comma split)
    const parseLine = (line: string) => {
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === delimiter && !inQuotes) {
          parts.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += c;
        }
      }
      parts.push(current.trim().replace(/^"|"$/g, ''));
      return parts;
    };

    const hdrs = parseLine(lines[0]);
    const rws = lines.slice(1).map(parseLine);
    return { headers: hdrs, rows: rws };
  }, [content, delimiter]);

  const filteredRows = useMemo(() => {
    if (!filter) return rows;
    const lower = filter.toLowerCase();
    return rows.filter((r) => r.some((cell) => cell.toLowerCase().includes(lower)));
  }, [rows, filter]);

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s2)] overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-2.5 bg-[var(--s4)] border-b border-[var(--bd2)] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-[var(--tx3)]">
            {rows.length} rows, {headers.length} columns
          </span>
        </div>
        <div className="relative w-56">
          <Search className="w-3 h-3 text-[var(--tx5)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search table rows..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-[var(--s0)] border border-[var(--bd2)] rounded text-[var(--tx2)] placeholder-[var(--tx5)] focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto">
        <table style={{ fontSize }} className="w-full text-left border-collapse font-mono">
          <thead className="bg-[var(--s5)] sticky top-0 z-10 border-b border-[var(--bd1)]">
            <tr>
              <th className="p-2.5 text-[11px] text-[var(--tx5)] font-semibold w-12 border-r border-[var(--bd2)]">
                #
              </th>
              {headers.map((h, i) => (
                <th key={i} className="p-2.5 text-[var(--tx2)] font-semibold border-r border-[var(--bd2)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--bd2)]">
            {filteredRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[var(--s7)] transition-colors">
                <td className="p-2 text-[11px] text-[var(--tx6)] border-r border-[var(--bd2)]">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2 text-[var(--tx3)] border-r border-[var(--bd2)] max-w-xs truncate">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const DataViewer: React.FC<DataViewerProps> = ({
  filePath,
  content,
  onChange,
  isEditing = false,
}) => {
  const viewerFontScale = useViewerStore((s) => s.viewerFontScale);
  const setViewerMode = useViewerStore((s) => s.setViewerMode);
  const [search, setSearch] = useState('');

  const ext = filePath.toLowerCase().split('.').pop() || '';
  const isCsv = ext === 'csv';
  const isTsv = ext === 'tsv';
  const isJson = ext === 'json' || ext === 'jsonc';

  const parsedJson = useMemo(() => {
    if (!isJson) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content, isJson]);

  // If CSV or TSV, default to table view
  if (isCsv || isTsv) {
    return (
      <div className="w-full h-full flex flex-col">
        <CsvTableView content={content} delimiter={isTsv ? '\t' : ','} fontSize={12 * viewerFontScale / 100} />
      </div>
    );
  }

  // Render parsed JSON as an interactive tree.
  if (isJson && parsedJson !== null && !isEditing) {
    return (
      <div className="w-full h-full flex flex-col bg-[var(--s1)] overflow-hidden">
        {/* Search & Mode Toolbar */}
        <div className="h-9 bg-[var(--s4)] border-b border-[var(--bd2)] px-3 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-[var(--tx5)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search JSON keys & values..."
                className="w-full pl-8 pr-3 py-1 text-xs bg-[var(--s0)] border border-[var(--bd2)] rounded-lg text-[var(--tx2)] placeholder-[var(--tx5)] focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[var(--s0)] p-0.5 rounded-lg border border-[var(--bd2)]">
            <button
              onClick={() => setViewerMode('tree')}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-blue-600 text-white shadow-sm"
            >
              <Layers className="w-3 h-3" />
              <span>Tree View</span>
            </button>
            <button
              onClick={() => setViewerMode('source')}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-[var(--tx4)] hover:text-[var(--tx1)]"
            >
              <Code2 className="w-3 h-3" />
              <span>Raw JSON</span>
            </button>
          </div>
        </div>

        {/* Tree Container */}
        <div style={{ fontSize: 12 * viewerFontScale / 100 }} className="flex-1 p-6 overflow-auto">
          <JsonTreeNode value={parsedJson} search={search} />
        </div>
      </div>
    );
  }

  // Fallback to Monaco code viewer
  return (
    <CodeViewer
      filePath={filePath}
      content={content}
      onChange={onChange}
      isEditing={isEditing}
    />
  );
};
