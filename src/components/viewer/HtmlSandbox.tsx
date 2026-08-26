import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  RotateCw,
  Terminal,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { DeviceViewport } from '../../types/file';
import { useViewerStore } from '../../store/useViewerStore';

interface HtmlSandboxProps {
  htmlContent: string;
}

interface ConsoleMessage {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  time: string;
}

const VIEWPORT_WIDTHS: Record<DeviceViewport, string> = {
  desktop: '100%',
  laptop: '1024px',
  tablet: '768px',
  mobile: '375px',
};

export const HtmlSandbox: React.FC<HtmlSandboxProps> = ({ htmlContent }) => {
  const viewportSize = useViewerStore((s) => s.viewportSize);
  const setViewportSize = useViewerStore((s) => s.setViewportSize);

  const [consoleLogs, setConsoleLogs] = useState<ConsoleMessage[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [key, setKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Script to inject into iframe for capturing console messages
  const injectedHtml = useMemoInjectedHtml(htmlContent);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.source === 'pfile-iframe-console') {
        const newMsg: ConsoleMessage = {
          id: Math.random().toString(36).substring(2, 9),
          type: event.data.type,
          args: event.data.args,
          time: new Date().toLocaleTimeString(),
        };
        setConsoleLogs((prev) => [...prev.slice(-99), newMsg]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRefresh = () => {
    setKey((k) => k + 1);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s1)] overflow-hidden">
      {/* Sandbox Toolbar */}
      <div className="h-9 bg-[var(--s4)] border-b border-[var(--bd2)] px-3 flex items-center justify-between text-xs text-[var(--tx3)] select-none">
        {/* Left: Device Viewport Switcher */}
        <div className="flex items-center gap-1 bg-[var(--s1)] p-0.5 rounded-lg border border-[var(--bd2)]">
          <button
            onClick={() => setViewportSize('desktop')}
            title="Desktop (100%)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              viewportSize === 'desktop' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--tx4)] hover:text-[var(--tx1)]'
            }`}
          >
            <Monitor className="w-3 h-3" />
            <span>Desktop</span>
          </button>
          <button
            onClick={() => setViewportSize('laptop')}
            title="Laptop (1024px)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              viewportSize === 'laptop' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--tx4)] hover:text-[var(--tx1)]'
            }`}
          >
            <Laptop className="w-3 h-3" />
            <span>Laptop</span>
          </button>
          <button
            onClick={() => setViewportSize('tablet')}
            title="Tablet (768px)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              viewportSize === 'tablet' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--tx4)] hover:text-[var(--tx1)]'
            }`}
          >
            <Tablet className="w-3 h-3" />
            <span>Tablet</span>
          </button>
          <button
            onClick={() => setViewportSize('mobile')}
            title="Mobile (375px)"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              viewportSize === 'mobile' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--tx4)] hover:text-[var(--tx1)]'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            <span>Mobile</span>
          </button>
        </div>

        {/* Right: Refresh & Console Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            title="Reload Sandbox Frame"
            className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--tx1)] transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors border ${
              showConsole
                ? 'bg-[var(--info-bg)] border-[var(--info-border)] text-[var(--info-text)]'
                : 'bg-[var(--bg-muted)] border-[var(--bd1)] text-[var(--tx3)] hover:text-[var(--tx1)]'
            }`}
          >
            <Terminal className="w-3 h-3 text-indigo-400" />
            <span>Console ({consoleLogs.length})</span>
            {showConsole ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 w-full h-full bg-[var(--s6)] p-3 flex justify-center items-stretch overflow-auto">
        <div
          style={{ width: VIEWPORT_WIDTHS[viewportSize] }}
          className="h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-200 border border-[var(--bd1)] relative"
        >
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={injectedHtml}
            title="HTML Prototype Preview"
            sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
            className="w-full h-full border-0"
          />
        </div>
      </div>

      {/* Console Bottom Bar */}
      {showConsole && (
        <div className="h-44 bg-[var(--s1)] border-t border-[var(--bd2)] flex flex-col font-mono text-xs select-text">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--s4)] border-b border-[var(--bd2)] text-[var(--tx4)]">
            <span className="font-semibold text-[11px] uppercase tracking-wider">Iframe Logs</span>
            <button
              onClick={() => setConsoleLogs([])}
              title="Clear Logs"
              className="p-1 rounded hover:bg-[var(--s7)] text-[var(--tx4)] hover:text-rose-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 p-2 overflow-y-auto space-y-1">
            {consoleLogs.length === 0 ? (
              <div className="text-[var(--tx6)] italic text-[11px] p-2">No console output recorded</div>
            ) : (
              consoleLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 text-[11px] py-0.5 ${
                    log.type === 'error'
                      ? 'text-[var(--danger-text)] bg-[var(--danger-bg)] px-1 rounded'
                      : log.type === 'warn'
                      ? 'text-amber-400'
                      : 'text-[var(--tx3)]'
                  }`}
                >
                  <span className="text-[var(--tx6)] flex-shrink-0">[{log.time}]</span>
                  <span className="font-semibold uppercase text-[10px] flex-shrink-0">
                    [{log.type}]
                  </span>
                  <span className="break-all whitespace-pre-wrap">{log.args.join(' ')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function useMemoInjectedHtml(html: string) {
  return React.useMemo(() => {
    const consoleInterceptor = `
      <script>
        (function() {
          const originalLog = console.log;
          const originalWarn = console.warn;
          const originalError = console.error;
          const originalInfo = console.info;

          function send(type, args) {
            try {
              window.parent.postMessage({
                source: 'pfile-iframe-console',
                type: type,
                args: Array.from(args).map(a => {
                  try {
                    return typeof a === 'object' ? JSON.stringify(a) : String(a);
                  } catch (e) {
                    return String(a);
                  }
                })
              }, '*');
            } catch (err) {}
          }

          console.log = function() { send('log', arguments); originalLog.apply(console, arguments); };
          console.warn = function() { send('warn', arguments); originalWarn.apply(console, arguments); };
          console.error = function() { send('error', arguments); originalError.apply(console, arguments); };
          console.info = function() { send('info', arguments); originalInfo.apply(console, arguments); };

          window.onerror = function(msg, url, line, col, error) {
            send('error', [msg + ' (line ' + line + ')']);
          };
        })();
      </script>
    `;

    if (html.includes('<head>')) {
      return html.replace('<head>', '<head>' + consoleInterceptor);
    }
    return consoleInterceptor + html;
  }, [html]);
}
