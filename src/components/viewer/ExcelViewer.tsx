import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Search, Table, Sheet, AlertTriangle } from 'lucide-react';
import { FileMetadata } from '../../types/file';
import { formatBytes } from '../../utils/formatters';

interface ExcelViewerProps {
  file: FileMetadata;
  binaryBase64: string;
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({ file, binaryBase64 }) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [search, setSearch] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!binaryBase64) return;

    try {
      const wb = XLSX.read(binaryBase64, { type: 'base64' });
      setWorkbook(wb);
      if (wb.SheetNames.length > 0) {
        setActiveSheetName(wb.SheetNames[0]);
      }
      setParseError(null);
    } catch (err: unknown) {
      console.error('Failed to parse Excel workbook:', err);
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Invalid or corrupted Excel file';
      setParseError(msg);
    }
  }, [binaryBase64, file.path]);

  // Convert active sheet to array of rows
  const { sheetRows, maxCols } = useMemo(() => {
    if (!workbook || !activeSheetName) return { sheetRows: [], maxCols: 0 };
    const sheet = workbook.Sheets[activeSheetName];
    if (!sheet) return { sheetRows: [], maxCols: 0 };

    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    let max = 0;
    rows.forEach((r) => {
      if (r.length > max) max = r.length;
    });

    return { sheetRows: rows, maxCols: max };
  }, [workbook, activeSheetName]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return sheetRows;
    const lower = search.toLowerCase();
    return sheetRows.filter((r) =>
      r.some((cell) => String(cell ?? '').toLowerCase().includes(lower))
    );
  }, [sheetRows, search]);

  const getColLetter = (index: number) => {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  if (parseError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--s1)] p-8">
        <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 max-w-md text-center space-y-2">
          <AlertTriangle className="w-6 h-6 mx-auto text-amber-400" />
          <p className="font-semibold text-amber-200">Unable to preview Excel spreadsheet</p>
          <p className="font-mono text-[11px] text-[var(--tx4)]">{parseError}</p>
        </div>
      </div>
    );
  }

  if (!workbook) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--s1)] text-xs text-[var(--tx5)] font-mono">
        Loading spreadsheet data...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s2)] overflow-hidden select-text">
      {/* Top Toolbar */}
      <div className="h-9 bg-[var(--s4)] border-b border-[var(--bd2)] px-3 flex items-center justify-between gap-3 text-xs select-none">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--tx4)]">
          <Table className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[var(--tx2)] font-semibold">{sheetRows.length} rows</span>
          <span>•</span>
          <span>{maxCols} cols</span>
          <span>•</span>
          <span>{formatBytes(file.size)}</span>
        </div>

        <div className="relative w-60">
          <Search className="w-3 h-3 text-[var(--tx5)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spreadsheet..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-[var(--s0)] border border-[var(--bd2)] rounded text-[var(--tx2)] placeholder-[var(--tx5)] focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Spreadsheet Grid Container */}
      <div className="flex-1 overflow-auto bg-[var(--s0)]">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="bg-[var(--s5)] sticky top-0 z-10 border-b border-[var(--bd1)]">
            <tr>
              {/* Top-left empty cell */}
              <th className="p-1.5 text-[10px] text-[var(--tx5)] font-semibold w-12 text-center bg-[var(--s3)] border-r border-b border-[var(--bd2)]">
                #
              </th>
              {/* Column header letters A, B, C ... */}
              {Array.from({ length: maxCols }).map((_, cIdx) => (
                <th
                  key={cIdx}
                  className="p-1.5 text-[10.5px] text-[var(--tx4)] font-semibold text-center min-w-[100px] border-r border-b border-[var(--bd2)] bg-[var(--s5)]"
                >
                  {getColLetter(cIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--bd2)]">
            {filteredRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[var(--s7)] transition-colors">
                {/* Row number header 1, 2, 3 ... */}
                <td className="p-1.5 text-[10px] text-[var(--tx6)] font-semibold text-center bg-[var(--s3)] border-r border-[var(--bd2)] select-none">
                  {rIdx + 1}
                </td>
                {/* Cells */}
                {Array.from({ length: maxCols }).map((_, cIdx) => {
                  const val = row[cIdx];
                  const strVal = val !== undefined && val !== null ? String(val) : '';
                  return (
                    <td
                      key={cIdx}
                      className="p-2 text-[var(--tx3)] border-r border-[var(--bd2)] max-w-sm truncate whitespace-nowrap"
                    >
                      {strVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet Tabs Bar */}
      {workbook.SheetNames.length > 0 && (
        <div className="h-8 bg-[var(--s4)] border-t border-[var(--bd2)] px-2 flex items-center gap-1 overflow-x-auto select-none">
          {workbook.SheetNames.map((name) => {
            const isActive = activeSheetName === name;
            return (
              <button
                key={name}
                onClick={() => setActiveSheetName(name)}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-mono rounded-t transition-colors border-t-2 ${
                  isActive
                    ? 'bg-[var(--s6)] text-emerald-400 border-emerald-500 font-semibold'
                    : 'text-[var(--tx4)] hover:text-[var(--tx2)] border-transparent hover:bg-[var(--s7)]'
                }`}
              >
                <Sheet className="w-3 h-3" />
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
