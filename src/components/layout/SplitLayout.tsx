import React, { useState, useEffect, useRef } from 'react';

interface SplitLayoutProps {
  sidebar: React.ReactNode;
  content: React.ReactNode;
  defaultSidebarWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

const SIDEBAR_WIDTH_KEY = 'pfile_sidebar_width';

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  sidebar,
  content,
  defaultSidebarWidth = 320,
  minWidth = 240,
  maxWidth = 600,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      return saved ? Math.max(minWidth, Math.min(maxWidth, Number(saved))) : defaultSidebarWidth;
    } catch {
      return defaultSidebarWidth;
    }
  });

  const [isDragging, setIsDragging] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX - rect.left));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        try {
          localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
        } catch {
          // ignore
        }
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, sidebarWidth]);

  return (
    <div
      ref={splitRef}
      className={`flex-1 w-full h-full flex overflow-hidden relative ${
        isDragging ? 'select-none cursor-col-resize' : ''
      }`}
    >
      {/* Left Sidebar */}
      <div
        style={{ width: `${sidebarWidth}px` }}
        className="h-full flex-shrink-0 flex flex-col overflow-hidden"
      >
        {sidebar}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={() => setIsDragging(true)}
        onDoubleClick={() => setSidebarWidth(defaultSidebarWidth)}
        title="Drag to resize sidebar (Double-click to reset)"
        className={`w-1 h-full cursor-col-resize flex-shrink-0 transition-colors z-20 ${
          isDragging ? 'bg-blue-500' : 'bg-[var(--bd2)] hover:bg-blue-500/60'
        }`}
      />

      {/* Right Main Viewer */}
      <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden bg-[var(--s1)]">
        {content}
      </div>
    </div>
  );
};
