import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { parse as parseYaml } from 'yaml';
import Editor from '@monaco-editor/react';
import { Copy, Check, ListTree, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Maximize2, X } from 'lucide-react';
import { useViewerStore } from '../../store/useViewerStore';
import { getViewerFontStack } from '../../utils/fontOptions';
import { useToastStore } from '../../store/useToastStore';
import { useThemeStore } from '../../store/useThemeStore';

interface MarkdownViewerProps {
  content: string;
  onChange?: (newContent: string) => void;
  isEditing?: boolean;
}
interface ParsedMarkdown {
  body: string;
  frontmatter: Array<[string, unknown]>;
}

interface TocHeading {
  id: string;
  text: string;
  level: number;
  line: number;
}

interface HeadingNode {
  position?: {
    start?: {
      line?: number;
    };
  };
}

const FRONTMATTER_PATTERN = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

const parseFrontmatter = (content: string): ParsedMarkdown => {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) return { body: content, frontmatter: [] };

  try {
    const value: unknown = parseYaml(match[1]);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { body: content, frontmatter: [] };
    }

    return {
      body: content.slice(match[0].length),
      frontmatter: Object.entries(value as Record<string, unknown>),
    };
  } catch {
    return { body: content, frontmatter: [] };
  }
};

const createHeadingSlug = (text: string): string => {
  const slug = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'heading';
};

const createUniqueHeadingId = (text: string, usedIds: Set<string>): string => {
  const base = createHeadingSlug(text);
  let id = base;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
};

const formatFrontmatterValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

// Mermaid Renderer Component
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const theme = useThemeStore((s) => s.theme);
  const viewerFontFamily = useViewerStore((s) => s.viewerFontFamily);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Keep mermaid's own theme in sync with the app's light/dark theme
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'light' ? 'default' : 'dark',
      securityLevel: 'loose',
      fontFamily: getViewerFontStack(viewerFontFamily),
    });
  }, [theme, viewerFontFamily]);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Invalid Mermaid chart';
          setError(msg);
        }
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart, theme]);

  if (error) {
    return (
      <div className="my-3 p-3 bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-lg text-xs text-[var(--danger-text)] font-mono">
        <p className="font-semibold mb-1 text-[var(--danger-text)]">Mermaid Render Error</p>
        <pre className="overflow-x-auto whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  return (
    <>
      <div className="relative group my-4 rounded-xl border border-[var(--bd2)] bg-[var(--s4)] shadow-inner">
        <button
          onClick={() => setIsExpanded(true)}
          title="Expand & Pan/Zoom"
          className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--s6)]/90 backdrop-blur-sm border border-[var(--bd1)] text-[var(--tx4)] hover:text-[var(--tx1)] hover:bg-[var(--bg-strong)] opacity-0 group-hover:opacity-100 transition-opacity text-[11px]"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Expand</span>
        </button>
        <div
          className="p-4 overflow-x-auto flex justify-center items-center cursor-zoom-in"
          onClick={() => setIsExpanded(true)}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {isExpanded && <MermaidFullscreenViewer svg={svg} onClose={() => setIsExpanded(false)} />}
    </>
  );
};

// Fullscreen pan/zoom viewer for a rendered Mermaid diagram
const MermaidFullscreenViewer: React.FC<{ svg: string; onClose: () => void }> = ({ svg, onClose }) => {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -10 : 10;
    setZoom((z) => Math.max(10, Math.min(800, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--s1)] animate-in fade-in duration-150"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--s5)]/90 border-b border-[var(--bd2)]">
        <span className="text-xs font-semibold text-[var(--tx3)]">Mermaid Diagram</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(10, z - 25))}
            title="Zoom Out"
            className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--tx1)]"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs text-[var(--tx4)] w-12 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(800, z + 25))}
            title="Zoom In"
            className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--tx1)]"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            title="Reset Zoom & Pan"
            className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--tx1)]"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="ml-1.5 p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--tx1)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pan/Zoom Canvas */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          className="[&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
};

// Code Block with Copy Button
const CodeBlock: React.FC<{
  language?: string;
  value: string;
  fontSize: number;
}> = ({ language, value, fontSize }) => {
  const [copied, setCopied] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    showToast('Copied Code', 'Code block copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  if (language === 'mermaid') {
    return <MermaidDiagram chart={value} />;
  }

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-[var(--bd2)] bg-[var(--s2)]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--s5)] border-b border-[var(--bd2)] text-[11px] text-[var(--tx4)] font-mono">
        <span>{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[var(--tx4)] hover:text-[var(--tx1)] px-2 py-0.5 rounded hover:bg-[var(--s7)] transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre style={{ fontSize }} className="p-3.5 text-[var(--tx2)] font-mono overflow-x-auto leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  );
};

const FrontmatterTable: React.FC<{ entries: Array<[string, unknown]>; fontSize: number }> = ({ entries, fontSize }) => (
  <section
    aria-label="Frontmatter"
    className="mb-5 inline-block min-w-72 max-w-full overflow-hidden rounded-md border border-[var(--bd2)] bg-[var(--s3)] align-top text-[11px]"
    style={{ fontSize }}
  >
    <div className="border-b border-[var(--bd2)] bg-[var(--s5)] px-2.5 py-1 font-semibold uppercase tracking-wider text-[10px] text-[var(--tx5)]">
      Frontmatter
    </div>
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-[var(--bd2)] last:border-b-0">
              <th className="w-28 whitespace-nowrap px-2.5 py-1 text-left align-top font-medium text-[var(--tx4)]">
                {key}
              </th>
              <td className="max-w-lg whitespace-pre-wrap break-words px-2.5 py-1 font-mono text-[var(--tx3)]">
                {formatFrontmatterValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  onChange,
  isEditing = false,
}) => {
  const viewerMode = useViewerStore((s) => s.viewerMode);
  const showToc = useViewerStore((s) => s.showToc);
  const toggleToc = useViewerStore((s) => s.toggleToc);
  const viewerFontScale = useViewerStore((s) => s.viewerFontScale);
  const viewerFontFamily = useViewerStore((s) => s.viewerFontFamily);
  const theme = useThemeStore((s) => s.theme);

  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const parsedMarkdown = useMemo(() => parseFrontmatter(content), [content]);

  // Extract headings for Table of Contents. IDs are generated once here so
  // the TOC and rendered headings always use the same unique identifier.
  const headings = useMemo<TocHeading[]>(() => {
    const lines = parsedMarkdown.body.split('\n');
    const items: TocHeading[] = [];
    const usedIds = new Set<string>();

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,4})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().replace(/[*_`[\]]/g, '');
        const id = createUniqueHeadingId(text, usedIds);
        items.push({ id, text, level, line: index + 1 });
      }
    });

    return items;
  }, [parsedMarkdown.body]);

  const headingIdByLine = useMemo(
    () => new Map(headings.map((heading) => [heading.line, heading.id])),
    [headings],
  );

  const getHeadingId = (node: HeadingNode | undefined, children: React.ReactNode): string => {
    const line = node?.position?.start?.line;
    return (line ? headingIdByLine.get(line) : undefined) || createHeadingSlug(String(children));
  };

  const scrollToHeading = (id: string) => {
    setActiveHeadingId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isSplit = viewerMode === 'split';
  const isSource = viewerMode === 'source' || isEditing;

  return (
    <div className="relative w-full h-full flex overflow-hidden bg-[var(--s2)]">
      {/* Main Content Area: Render / Source / Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Source View (Monaco) */}
        {(isSource || isSplit) && (
          <div className={`${isSplit ? 'w-1/2 border-r border-[var(--bd2)]' : 'w-full'} h-full`}>
            <Editor
              height="100%"
              defaultLanguage="markdown"
              theme={theme === 'light' ? 'vs' : 'vs-dark'}
              value={content}
              onChange={(val) => onChange?.(val || '')}
              options={{
                readOnly: !onChange,
                minimap: { enabled: false },
                fontSize: 13 * viewerFontScale / 100,
                fontFamily: getViewerFontStack(viewerFontFamily),
                wordWrap: 'on',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        )}

        {/* Rendered View */}
        {(!isSource || isSplit) && (
          <div className={`${isSplit ? 'w-1/2' : 'w-full'} h-full overflow-y-auto p-8 relative scroll-smooth`}>
            <article
              style={{ fontSize: 16 * viewerFontScale / 100 }}
              className="max-w-3xl mx-auto select-text prose prose-slate prose-headings:font-sans prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-[var(--tx3)] prose-p:leading-relaxed prose-a:text-[var(--accent)] prose-strong:text-[var(--tx1)] prose-code:font-mono prose-code:text-[var(--info-text)] prose-code:bg-[var(--s6)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-blockquote:text-[var(--tx4)] prose-blockquote:border-[var(--bd1)] prose-li:text-[var(--tx3)] prose-pre:p-0 prose-pre:bg-transparent prose-img:rounded-lg prose-table:border-collapse prose-th:border prose-th:border-[var(--bd1)] prose-th:p-2 prose-th:text-[var(--tx2)] prose-td:border prose-td:border-[var(--bd2)] prose-td:p-2 prose-td:text-[var(--tx3)] prose-hr:border-[var(--bd2)]"
            >
              {parsedMarkdown.frontmatter.length > 0 && (
                <FrontmatterTable entries={parsedMarkdown.frontmatter} fontSize={11 * viewerFontScale / 100} />
              )}
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={{
                  ul: ({ node: _node, className, children, ...props }) => {
                    const isTaskList = className?.includes('contains-task-list');
                    return (
                      <ul
                        className={`${isTaskList ? 'list-none pl-1' : 'list-disc pl-6'} my-3 space-y-1 text-[var(--tx3)] marker:text-[var(--tx4)] ${className || ''}`}
                        {...props}
                      >
                        {children}
                      </ul>
                    );
                  },
                  ol: ({ node: _node, className, children, ...props }) => (
                    <ol
                      className={`list-decimal pl-6 my-3 space-y-1 text-[var(--tx3)] marker:text-[var(--tx4)] ${className || ''}`}
                      {...props}
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ node: _node, className, children, ...props }) => (
                    <li
                      className={`pl-1 leading-relaxed text-[var(--tx3)] [&>p]:my-0 [&>input]:mr-2 ${className || ''}`}
                      {...props}
                    >
                      {children}
                    </li>
                  ),
                  table: ({ children }) => (
                    <table className="w-full border-collapse border border-[var(--bd1)] my-4">
                      {children}
                    </table>
                  ),
                  th: ({ children }) => (
                    <th className="border border-[var(--bd1)] bg-[var(--s5)] px-3 py-2 text-left font-semibold text-[var(--tx2)]">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-[var(--bd1)] px-3 py-2 text-[var(--tx3)]">
                      {children}
                    </td>
                  ),
                  h1: ({ node, children }) => (
                    <h1 id={getHeadingId(node, children)} style={{ fontSize: 24 * viewerFontScale / 100 }} className="scroll-mt-6 font-bold text-[var(--tx1)] border-b border-[var(--bd2)] pb-2 mb-4 mt-6">{children}</h1>
                  ),
                  h2: ({ node, children }) => (
                    <h2 id={getHeadingId(node, children)} style={{ fontSize: 20 * viewerFontScale / 100 }} className="scroll-mt-6 font-bold text-[var(--tx1)] border-b border-[var(--bd2)] pb-1 mb-3 mt-6">{children}</h2>
                  ),
                  h3: ({ node, children }) => (
                    <h3 id={getHeadingId(node, children)} style={{ fontSize: 18 * viewerFontScale / 100 }} className="scroll-mt-6 font-semibold text-[var(--tx2)] mb-2 mt-4">{children}</h3>
                  ),
                  h4: ({ node, children }) => (
                    <h4 id={getHeadingId(node, children)} className="scroll-mt-6 font-semibold text-[var(--tx2)] mb-2 mt-4">{children}</h4>
                  ),
                  code: ({ node: _node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !String(children).includes('\n');
                    if (isInline) {
                      return (
                        <code style={{ fontSize: 12 * viewerFontScale / 100 }} className="bg-[var(--s6)] text-[var(--info-text)] px-1.5 py-0.5 rounded font-mono" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <CodeBlock
                        language={match ? match[1] : ''}
                        value={String(children).replace(/\n$/, '')}
                        fontSize={12 * viewerFontScale / 100}
                      />
                    );
                  },
                }}
              >
                {parsedMarkdown.body}
              </ReactMarkdown>
            </article>
          </div>
        )}
      </div>

      {/* Floating TOC Toggle Button */}
      {headings.length > 0 && !isSource && (
        <button
          onClick={toggleToc}
          title="Toggle Table of Contents"
          className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-[var(--s6)]/90 hover:bg-[var(--s7)] border border-[var(--bd1)] text-[var(--tx3)] hover:text-[var(--tx1)] shadow-xl backdrop-blur-md transition-all"
        >
          <ListTree className="w-4 h-4 text-indigo-400" />
        </button>
      )}

      {/* TOC Drawer */}
      {headings.length > 0 && showToc && !isSource && (
        <aside className="w-64 h-full border-l border-[var(--bd2)] bg-[var(--s3)]/95 backdrop-blur-sm p-4 overflow-y-auto select-none flex-shrink-0">
          <div className="flex items-center justify-between mb-3 text-xs font-semibold text-[var(--tx4)] uppercase tracking-wider">
            <span>Table of Contents</span>
            <span className="text-[10px] text-[var(--tx5)] font-mono">{headings.length} items</span>
          </div>

          <nav className="space-y-1">
            {headings.map((h, i) => (
              <button
                key={i}
                onClick={() => scrollToHeading(h.id)}
                style={{ paddingLeft: `${(h.level - 1) * 10 + 6}px` }}
                className={`w-full text-left py-1 text-xs rounded transition-colors flex items-center gap-1.5 truncate ${
                  activeHeadingId === h.id
                    ? 'text-blue-400 font-medium bg-blue-500/10'
                    : 'text-[var(--tx4)] hover:text-[var(--tx2)] hover:bg-[var(--s7)]'
                }`}
                title={h.text}
              >
                <ChevronRight className="w-2.5 h-2.5 flex-shrink-0 text-[var(--tx6)]" />
                <span className="truncate">{h.text}</span>
              </button>
            ))}
          </nav>
        </aside>
      )}
    </div>
  );
};
