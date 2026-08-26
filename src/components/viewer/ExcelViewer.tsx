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
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0c12] p-8">
        <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 max-w-md text-center space-y-2">
          <AlertTriangle className="w-6 h-6 mx-auto text-amber-400" />
          <p className="font-semibold text-amber-200">Unable to preview Excel spreadsheet</p>
          <p className="font-mono text-[11px] text-slate-400">{parseError}</p>
        </div>
      </div>
    );
  }

  if (!workbook) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0b0c12] text-xs text-slate-500 font-mono">
        Loading spreadsheet data...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0c0d14] overflow-hidden select-text">
      {/* Top Toolbar */}
      <div className="h-9 bg-[#12141d] border-b border-slate-800 px-3 flex items-center justify-between gap-3 text-xs select-none">
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <Table className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-200 font-semibold">{sheetRows.length} rows</span>
          <span>•</span>
          <span>{maxCols} cols</span>
          <span>•</span>
          <span>{formatBytes(file.size)}</span>
        </div>

        <div className="relative w-60">
          <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spreadsheet..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-[#090a0f] border border-slate-800 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Spreadsheet Grid Container */}
      <div className="flex-1 overflow-auto bg-[#090a0f]">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead className="bg-[#141724] sticky top-0 z-10 border-b border-slate-700">
            <tr>
              {/* Top-left empty cell */}
              <th className="p-1.5 text-[10px] text-slate-500 font-semibold w-12 text-center bg-[#10121b] border-r border-b border-slate-800">
                #
              </th>
              {/* Column header letters A, B, C ... */}
              {Array.from({ length: maxCols }).map((_, cIdx) => (
                <th
                  key={cIdx}
                  className="p-1.5 text-[10.5px] text-slate-400 font-semibold text-center min-w-[100px] border-r border-b border-slate-800 bg-[#141724]"
                >
                  {getColLetter(cIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                {/* Row number header 1, 2, 3 ... */}
                <td className="p-1.5 text-[10px] text-slate-600 font-semibold text-center bg-[#10121b] border-r border-slate-800 select-none">
                  {rIdx + 1}
                </td>
                {/* Cells */}
                {Array.from({ length: maxCols }).map((_, cIdx) => {
                  const val = row[cIdx];
                  const strVal = val !== undefined && val !== null ? String(val) : '';
                  return (
                    <td
                      key={cIdx}
                      className="p-2 text-slate-300 border-r border-slate-800/60 max-w-sm truncate whitespace-nowrap"
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
        <div className="h-8 bg-[#11131c] border-t border-slate-800 px-2 flex items-center gap-1 overflow-x-auto select-none">
          {workbook.SheetNames.map((name) => {
            const isActive = activeSheetName === name;
            return (
              <button
                key={name}
                onClick={() => setActiveSheetName(name)}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-mono rounded-t transition-colors border-t-2 ${
                  isActive
                    ? 'bg-[#181c28] text-emerald-400 border-emerald-500 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
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
