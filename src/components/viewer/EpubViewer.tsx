import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  List,
  Sparkles,
  User,
  Globe,
  Minus,
  Plus,
} from 'lucide-react';
import { FileMetadata } from '../../types/file';

// ── Types (mirror Rust) ─────────────────────────────────────────

interface EpubTocEntry {
  title: string;
  href: string;
  level: number;
}

interface EpubChapter {
  id: string;
  href: string;
  title: string;
  html: string;
}

interface EpubMetadata {
  title: string;
  author: string;
  language: string;
  description: string;
  toc: EpubTocEntry[];
  chapter_count: number;
  cover_base64: string | null;
}

interface EpubContent {
  metadata: EpubMetadata;
  chapters: EpubChapter[];
  css: string;
}

// ── Component ───────────────────────────────────────────────────

interface EpubViewerProps {
  file: FileMetadata;
}

export const EpubViewer: React.FC<EpubViewerProps> = ({ file }) => {
  const [epub, setEpub] = useState<EpubContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [tocOpen, setTocOpen] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setEpub(null);
    setCurrentChapter(0);

    invoke<EpubContent>('epub_read', { path: file.path })
      .then((data) => setEpub(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [file.path]);

  // Scroll to top on chapter change
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [currentChapter]);

  const chapter = epub?.chapters[currentChapter];

  // Sanitized CSS scoped to the reader
  const scopedCss = useMemo(() => {
    if (!epub?.css) return '';
    // Prefix all selectors with .epub-content to scope
    return epub.css
      .replace(/(@[^{]+\{)/g, '') // strip @font-face etc.
      .replace(/body\s*\{/g, '.epub-content {')
      .replace(/html\s*\{/g, '.epub-content {');
  }, [epub?.css]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--s2)] text-[var(--tx5)] gap-2">
        <Sparkles className="w-5 h-5 animate-spin text-blue-400" />
        <span className="text-xs font-mono">Reading EPUB…</span>
      </div>
    );
  }

  if (error || !epub) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--s2)] text-[var(--tx4)] p-6">
        <div className="p-4 bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-xl text-xs text-[var(--danger-text)] max-w-md text-center">
          <p className="font-semibold mb-1">Cannot read EPUB</p>
          <p className="font-mono text-[11px]">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const { metadata } = epub;
  const totalChapters = epub.chapters.length;

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s2)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--bd2)] bg-[var(--s3)] flex-shrink-0">
        <BookOpen className="w-5 h-5 text-teal-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[var(--tx1)] truncate">
            {metadata.title || file.name}
          </div>
          <div className="flex items-center gap-3 text-[10.5px] text-[var(--tx4)] font-mono mt-0.5">
            {metadata.author && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {metadata.author}
              </span>
            )}
            {metadata.language && (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {metadata.language}
              </span>
            )}
            <span>{totalChapters} chapters</span>
          </div>
        </div>

        {/* Font size controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setFontSize((s) => Math.max(12, s - 1))}
            className="p-1 rounded hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)]"
            title="Decrease font size"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[10px] text-[var(--tx5)] font-mono w-6 text-center">{fontSize}</span>
          <button
            onClick={() => setFontSize((s) => Math.min(28, s + 1))}
            className="p-1 rounded hover:bg-[var(--bg-strong)] text-[var(--tx4)] hover:text-[var(--tx2)]"
            title="Increase font size"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* TOC toggle */}
        <button
          onClick={() => setTocOpen(!tocOpen)}
          className={`p-1.5 rounded transition-colors ${
            tocOpen ? 'bg-[var(--info-bg)] text-[var(--info-text)]' : 'hover:bg-[var(--bg-muted)] text-[var(--tx4)]'
          }`}
          title="Table of Contents"
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* Body: TOC sidebar + Chapter content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* TOC Sidebar */}
        {tocOpen && (
          <aside className="w-64 flex-shrink-0 border-r border-[var(--bd2)] bg-[var(--s3)] overflow-y-auto">
            {/* Cover */}
            {metadata.cover_base64 && (
              <div className="p-3 border-b border-[var(--bd2)]">
                <img
                  src={metadata.cover_base64}
                  alt="Cover"
                  className="w-full h-auto rounded shadow-lg"
                />
              </div>
            )}

            {/* TOC entries */}
            {metadata.toc.length > 0 ? (
              <nav className="py-2">
                {metadata.toc.map((entry, i) => {
                  // Find matching chapter index
                  const hrefBase = entry.href.split('#')[0];
                  const chIdx = epub.chapters.findIndex(
                    (ch) => ch.href === hrefBase || ch.href.endsWith(hrefBase)
                  );
                  const isActive = chIdx === currentChapter;

                  return (
                    <button
                      key={i}
                      onClick={() => chIdx >= 0 && setCurrentChapter(chIdx)}
                      className={`w-full text-left px-3 py-1.5 text-[11.5px] truncate transition-colors ${
                        isActive
                          ? 'bg-[var(--selected-bg)] text-[var(--selected-text)] font-medium'
                          : 'text-[var(--tx3)] hover:bg-[var(--s6)] hover:text-[var(--tx1)]'
                      }`}
                      style={{ paddingLeft: `${(entry.level - 1) * 12 + 12}px` }}
                      title={entry.title}
                    >
                      {entry.title}
                    </button>
                  );
                })}
              </nav>
            ) : (
              // Fall back to chapter list
              <nav className="py-2">
                {epub.chapters.map((ch, i) => (
                  <button
                    key={ch.id}
                    onClick={() => setCurrentChapter(i)}
                    className={`w-full text-left px-3 py-1.5 text-[11.5px] truncate transition-colors ${
                      i === currentChapter
                        ? 'bg-[var(--selected-bg)] text-[var(--selected-text)] font-medium'
                        : 'text-[var(--tx3)] hover:bg-[var(--s6)] hover:text-[var(--tx1)]'
                    }`}
                    title={ch.title}
                  >
                    {ch.title}
                  </button>
                ))}
              </nav>
            )}
          </aside>
        )}

        {/* Chapter content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chapter reading area */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto px-8 py-6"
          >
            {chapter ? (
              <div className="max-w-3xl mx-auto">
                {/* Chapter title */}
                <h2 className="text-lg font-bold text-[var(--tx1)] mb-4 pb-2 border-b border-[var(--bd2)]">
                  {chapter.title}
                </h2>

                {/* Scoped CSS */}
                {scopedCss && <style>{scopedCss}</style>}

                {/* Chapter HTML */}
                <div
                  className="epub-content prose dark:prose-invert prose-slate max-w-none text-[var(--tx3)] leading-relaxed"
                  style={{ fontSize: `${fontSize}px` }}
                  dangerouslySetInnerHTML={{ __html: chapter.html }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--tx5)] text-xs">
                No chapter content
              </div>
            )}
          </div>

          {/* Bottom navigation */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--bd2)] bg-[var(--s3)] flex-shrink-0">
            <button
              onClick={() => setCurrentChapter((c) => Math.max(0, c - 1))}
              disabled={currentChapter === 0}
              className="flex items-center gap-1 px-3 py-1 text-[11px] rounded bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx3)] hover:text-[var(--tx1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              Previous
            </button>

            <span className="text-[10.5px] text-[var(--tx5)] font-mono">
              {currentChapter + 1} / {totalChapters}
            </span>

            <button
              onClick={() => setCurrentChapter((c) => Math.min(totalChapters - 1, c + 1))}
              disabled={currentChapter >= totalChapters - 1}
              className="flex items-center gap-1 px-3 py-1 text-[11px] rounded bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx3)] hover:text-[var(--tx1)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
