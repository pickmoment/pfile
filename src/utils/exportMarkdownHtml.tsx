import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import katexCss from 'katex/dist/katex.min.css?raw';
import { parseFrontmatter } from '../components/viewer/MarkdownViewer';

const MERMAID_FENCE_PATTERN = /```mermaid\r?\n([\s\S]*?)```/g;

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });

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

async function renderMermaidCharts(body: string, isDark: boolean): Promise<Map<string, string>> {
  const charts = new Set<string>();
  let match: RegExpExecArray | null;
  MERMAID_FENCE_PATTERN.lastIndex = 0;
  while ((match = MERMAID_FENCE_PATTERN.exec(body)) !== null) {
    charts.add(match[1].replace(/\n$/, ''));
  }

  const svgByChart = new Map<string, string>();
  if (charts.size === 0) return svgByChart;

  mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', securityLevel: 'loose' });

  await Promise.all(
    Array.from(charts).map(async (chart, index) => {
      try {
        const { svg } = await mermaid.render(`export-mermaid-${index}-${Date.now()}`, chart);
        svgByChart.set(chart, svg);
      } catch {
        svgByChart.set(chart, `<pre>${escapeHtml(chart)}</pre>`);
      }
    }),
  );

  return svgByChart;
}

function renderBodyToHtml(body: string, mermaidSvgByChart: Map<string, string>): string {
  return ReactDOMServer.renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        code: ({ node: _node, className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const value = String(children).replace(/\n$/, '');
          const isInline = !match && !value.includes('\n');
          if (isInline) {
            return <code {...props}>{children}</code>;
          }
          if (match?.[1] === 'mermaid') {
            const svg = mermaidSvgByChart.get(value) || `<pre>${escapeHtml(value)}</pre>`;
            return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
          }
          return (
            <pre>
              <code className={className} {...props}>{children}</code>
            </pre>
          );
        },
      }}
    >
      {body}
    </ReactMarkdown>,
  );
}

export async function buildStandaloneMarkdownHtml(content: string, title: string, isDark: boolean): Promise<string> {
  const { body, frontmatter } = parseFrontmatter(content);
  const mermaidSvgByChart = await renderMermaidCharts(body, isDark);
  const bodyHtml = renderBodyToHtml(body, mermaidSvgByChart);

  const frontmatterHtml =
    frontmatter.length > 0
      ? `<table class="frontmatter"><tbody>${frontmatter
          .map(
            ([key, value]) =>
              `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatFrontmatterValue(value))}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '';

  return `<!DOCTYPE html>
<html lang="ko" data-theme="${isDark ? 'dark' : 'light'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${katexCss}</style>
<style>${DOCUMENT_STYLES}</style>
</head>
<body>
<article class="markdown-body">
${frontmatterHtml}
${bodyHtml}
</article>
</body>
</html>
`;
}

const DOCUMENT_STYLES = `
:root {
  color-scheme: light dark;
}
body {
  margin: 0;
  padding: 2.5rem 1.5rem;
  background: #ffffff;
  display: flex;
  justify-content: center;
}
html[data-theme="dark"] body {
  background: #0d1117;
}
.markdown-body {
  width: 100%;
  max-width: 860px;
  color: #24292f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.7;
}
html[data-theme="dark"] .markdown-body {
  color: #c9d1d9;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
  font-weight: 700;
  margin-top: 1.6em;
  margin-bottom: 0.6em;
}
.markdown-body h1 { font-size: 1.7em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.4em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.2em; }
html[data-theme="dark"] .markdown-body h1,
html[data-theme="dark"] .markdown-body h2 { border-bottom-color: #30363d; }
.markdown-body p, .markdown-body ul, .markdown-body ol, .markdown-body blockquote, .markdown-body table {
  margin: 0.8em 0;
}
.markdown-body a { color: #0969da; }
html[data-theme="dark"] .markdown-body a { color: #58a6ff; }
.markdown-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: #eff1f3;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}
.markdown-body pre {
  background: #f6f8fa;
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
}
.markdown-body pre code { background: none; padding: 0; }
html[data-theme="dark"] .markdown-body code { background: #21262d; }
html[data-theme="dark"] .markdown-body pre { background: #161b22; }
.markdown-body blockquote {
  border-left: 4px solid #d0d7de;
  color: #57606a;
  padding: 0 1em;
}
html[data-theme="dark"] .markdown-body blockquote { border-left-color: #30363d; color: #8b949e; }
.markdown-body table { border-collapse: collapse; width: 100%; }
.markdown-body th, .markdown-body td {
  border: 1px solid #d0d7de;
  padding: 0.5em 0.8em;
  text-align: left;
}
html[data-theme="dark"] .markdown-body th,
html[data-theme="dark"] .markdown-body td { border-color: #30363d; }
.markdown-body th { background: #f6f8fa; }
html[data-theme="dark"] .markdown-body th { background: #161b22; }
.markdown-body img { max-width: 100%; border-radius: 6px; }
.markdown-body .frontmatter { font-size: 0.85em; margin-bottom: 1.5em; }
.markdown-body .frontmatter th { white-space: nowrap; width: 1%; color: #57606a; }
.markdown-body .mermaid-diagram { text-align: center; margin: 1.2em 0; }
.markdown-body .mermaid-diagram svg { max-width: 100%; height: auto; }
`;
