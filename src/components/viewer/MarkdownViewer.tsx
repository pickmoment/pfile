import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import Editor from '@monaco-editor/react';
import { Copy, Check, ListTree, ChevronRight } from 'lucide-react';
import { useViewerStore } from '../../store/useViewerStore';
import { useToastStore } from '../../store/useToastStore';

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Fira Code, monospace',
});

interface MarkdownViewerProps {
  content: string;
  onChange?: (newContent: string) => void;
  isEditing?: boolean;
}

// Mermaid Renderer Component
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [chart]);

  if (error) {
    return (
      <div className="my-3 p-3 bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-lg text-xs text-[var(--danger-text)] font-mono">
        <p className="font-semibold mb-1 text-[var(--danger-text)]">Mermaid Render Error</p>
        <pre className="overflow-x-auto whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 p-4 bg-[var(--s4)] border border-[var(--bd2)] rounded-xl overflow-x-auto flex justify-center items-center shadow-inner"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// Code Block with Copy Button
const CodeBlock: React.FC<{
  language?: string;
  value: string;
}> = ({ language, value }) => {
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
      <pre className="p-3.5 text-xs text-[var(--tx2)] font-mono overflow-x-auto leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  );
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  onChange,
  isEditing = false,
}) => {
  const viewerMode = useViewerStore((s) => s.viewerMode);
  const showToc = useViewerStore((s) => s.showToc);
  const toggleToc = useViewerStore((s) => s.toggleToc);

  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  // Extract headings for Table of Contents
  const headings = useMemo(() => {
    const lines = content.split('\n');
    const items: Array<{ id: string; text: string; level: number }> = [];

    lines.forEach((line) => {
      const match = line.match(/^(#{1,4})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().replace(/[*_`[\]]/g, '');
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        items.push({ id, text, level });
      }
    });

    return items;
  }, [content]);

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
              theme="vs-dark"
              value={content}
              onChange={(val) => onChange?.(val || '')}
              options={{
                readOnly: !onChange,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'Fira Code, Consolas, monospace',
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
            <article className="max-w-3xl mx-auto prose prose-slate prose-headings:font-sans prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-[var(--tx3)] prose-p:leading-relaxed prose-a:text-[var(--accent)] prose-strong:text-[var(--tx1)] prose-code:font-mono prose-code:text-[var(--info-text)] prose-code:bg-[var(--s6)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-blockquote:text-[var(--tx4)] prose-blockquote:border-[var(--bd1)] prose-li:text-[var(--tx3)] prose-pre:p-0 prose-pre:bg-transparent prose-img:rounded-lg prose-table:border-collapse prose-th:border prose-th:border-[var(--bd1)] prose-th:p-2 prose-th:text-[var(--tx2)] prose-td:border prose-td:border-[var(--bd2)] prose-td:p-2 prose-td:text-[var(--tx3)] prose-hr:border-[var(--bd2)]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={{
                  h1: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                    return <h1 id={id} className="scroll-mt-6 text-2xl font-bold text-[var(--tx1)] border-b border-[var(--bd2)] pb-2 mb-4 mt-6">{children}</h1>;
                  },
                  h2: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                    return <h2 id={id} className="scroll-mt-6 text-xl font-bold text-[var(--tx1)] border-b border-[var(--bd2)] pb-1 mb-3 mt-6">{children}</h2>;
                  },
                  h3: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                    return <h3 id={id} className="scroll-mt-6 text-lg font-semibold text-[var(--tx2)] mb-2 mt-4">{children}</h3>;
                  },
                  code: ({ node: _node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !String(children).includes('\n');
                    if (isInline) {
                      return (
                        <code className="bg-[var(--s6)] text-[var(--info-text)] px-1.5 py-0.5 rounded font-mono text-xs" {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <CodeBlock
                        language={match ? match[1] : ''}
                        value={String(children).replace(/\n$/, '')}
                      />
                    );
                  },
                }}
              >
                {content}
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
