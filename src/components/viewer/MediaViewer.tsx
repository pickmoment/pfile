import React, { useState, useRef, useEffect } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import {
  ZoomIn,
  ZoomOut,
  Grid,
  Code2,
  Eye,
  Music,
  RotateCcw,
  Captions,
} from 'lucide-react';
import { FileMetadata } from '../../types/file';
import { CodeViewer } from './CodeViewer';
import { formatBytes } from '../../utils/formatters';

interface MediaViewerProps {
  file: FileMetadata;
  binaryBase64: string;
  textContent?: string;
}

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(t: string): number {
  const parts = t.trim().split(':');
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (parts.length === 3) {
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
    seconds = parseFloat(parts[2].replace(',', '.')) || 0;
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10) || 0;
    seconds = parseFloat(parts[1].replace(',', '.')) || 0;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function srtToVtt(srt: string): string {
  const normalized = srt.replace(/\r\n/g, '\n').replace(/,(\d{3})/g, '.$1');
  return `WEBVTT\n\n${normalized}`;
}

function parseVtt(vtt: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = vtt.replace(/\r\n/g, '\n').split('\n');
  const timeRe = /([\d:.]+)\s*-->\s*([\d:.]+)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(timeRe);
    if (!match) continue;

    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    const textLines: string[] = [];
    i++;
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i]);
      i++;
    }
    if (textLines.length > 0) {
      cues.push({ start, end, text: textLines.join('\n') });
    }
  }

  return cues;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  file,
  binaryBase64,
  textContent = '',
}) => {
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showCheckerboard, setShowCheckerboard] = useState(true);
  const [svgMode, setSvgMode] = useState<'visual' | 'code'>('visual');
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState<string | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeCueText, setActiveCueText] = useState('');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);

  const ext = file.extension?.toLowerCase() || '';
  const isSvg = ext === 'svg';
  const isAudio = file.category === 'audio';
  const isVideo = file.category === 'video';
  const isPdf = ext === 'pdf';
  const isImage = file.category === 'image' || isSvg;

  // Derive mime type
  const mimeType = isSvg
    ? 'image/svg+xml'
    : isPdf
    ? 'application/pdf'
    : isAudio
    ? `audio/${ext === 'mp3' ? 'mpeg' : ext === 'm4a' ? 'mp4' : ext}`
    : isVideo
    ? `video/${ext}`
    : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const dataUri = isSvg && textContent
    ? `data:image/svg+xml;utf8,${encodeURIComponent(textContent)}`
    : binaryBase64
    ? `data:${mimeType};base64,${binaryBase64}`
    : convertFileSrc(file.path);

  // Reset zoom/pan when file changes
  useEffect(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  }, [file.path]);

  // Look for a sibling subtitle file (.vtt / .srt) matching the media file name
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    setSubtitleTrackUrl(null);
    setSubtitleCues([]);
    setActiveCueText('');
    setSubtitlesEnabled(true);

    if (!isAudio && !isVideo) return;

    const lastDot = file.path.lastIndexOf('.');
    const lastSlash = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'));
    const base = lastDot > lastSlash ? file.path.slice(0, lastDot) : file.path;
    const candidates = [`${base}.vtt`, `${base}.srt`];

    (async () => {
      for (const candidate of candidates) {
        try {
          const raw: string = await invoke('read_file_text', { path: candidate });
          if (cancelled) return;

          const vttText = candidate.endsWith('.srt') ? srtToVtt(raw) : raw;
          const cues = parseVtt(vttText);
          const blob = new Blob([vttText], { type: 'text/vtt' });
          createdUrl = URL.createObjectURL(blob);

          setSubtitleTrackUrl(createdUrl);
          setSubtitleCues(cues);
          return;
        } catch {
          // No subtitle file at this candidate path — try the next one
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file.path, isAudio, isVideo]);

  // Toggle native track visibility (the `default` attribute only applies on mount)
  useEffect(() => {
    const track = trackRef.current?.track;
    if (track) track.mode = subtitlesEnabled ? 'showing' : 'hidden';
  }, [subtitlesEnabled, subtitleTrackUrl]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    if (subtitleCues.length === 0) return;
    const t = e.currentTarget.currentTime;
    const cue = subtitleCues.find((c) => t >= c.start && t <= c.end);
    setActiveCueText(cue?.text || '');
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (isImage) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setZoom((z) => Math.max(10, Math.min(500, z + delta)));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isImage) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && isImage) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // SVG Code Mode
  if (isSvg && svgMode === 'code') {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="h-9 bg-[var(--s4)] border-b border-[var(--bd2)] px-3 flex items-center justify-between text-xs">
          <span className="text-[var(--tx4)] font-mono">SVG XML Source</span>
          <button
            onClick={() => setSvgMode('visual')}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 text-white text-[11px]"
          >
            <Eye className="w-3 h-3" />
            <span>Visual Render</span>
          </button>
        </div>
        <div className="flex-1">
          <CodeViewer filePath={file.path} content={textContent} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[var(--s1)] overflow-hidden select-none">
      {/* Media Toolbar */}
      <div className="h-9 bg-[var(--s4)] border-b border-[var(--bd2)] px-3 flex items-center justify-between text-xs text-[var(--tx3)]">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--tx4)]">
          <span className="uppercase text-[var(--tx3)] font-semibold">{ext}</span>
          <span>•</span>
          <span>{formatBytes(file.size)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {(isAudio || isVideo) && (subtitleTrackUrl || subtitleCues.length > 0) && (
            <button
              onClick={() => setSubtitlesEnabled((v) => !v)}
              title={subtitlesEnabled ? 'Hide Subtitles' : 'Show Subtitles'}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] ${
                subtitlesEnabled ? 'bg-[var(--info-bg)] text-[var(--info-text)]' : 'hover:bg-[var(--bg-muted)] text-[var(--tx4)]'
              }`}
            >
              <Captions className="w-3.5 h-3.5" />
              <span>CC</span>
            </button>
          )}
          {isImage && (
            <>
              {isSvg && (
                <button
                  onClick={() => setSvgMode('code')}
                  title="View SVG Source Code"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-muted)] hover:bg-[var(--bg-strong)] text-[var(--tx3)] text-[11px] mr-1"
                >
                  <Code2 className="w-3 h-3" />
                  <span>Source</span>
                </button>
              )}
              <button
                onClick={() => setZoom((z) => Math.max(10, z - 25))}
                title="Zoom Out"
                className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--tx1)]"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-[var(--tx4)] w-12 text-center">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(500, z + 25))}
                title="Zoom In"
                className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--tx1)]"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoom(100);
                  setPan({ x: 0, y: 0 });
                }}
                title="Reset Zoom & Pan"
                className="p-1.5 rounded hover:bg-[var(--bg-muted)] text-[var(--tx4)] hover:text-[var(--tx1)]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowCheckerboard((c) => !c)}
                title="Toggle Transparency Grid"
                className={`p-1.5 rounded transition-colors ${
                  showCheckerboard ? 'bg-[var(--info-bg)] text-[var(--info-text)]' : 'hover:bg-[var(--bg-muted)] text-[var(--tx4)]'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Media Canvas Body */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`flex-1 w-full h-full flex items-center justify-center p-6 overflow-hidden relative ${
          showCheckerboard && isImage
            ? 'bg-[radial-gradient(var(--s7)_1px,transparent_1px)] [background-size:16px_16px] bg-[var(--s2)]'
            : 'bg-[var(--s0)]'
        } ${isDragging ? 'cursor-grabbing' : isImage ? 'cursor-grab' : ''}`}
      >
        {isImage && (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            className="flex items-center justify-center max-w-full max-h-full"
          >
            <img
              src={dataUri}
              alt={file.name}
              draggable={false}
              className="max-w-none shadow-2xl rounded pointer-events-none"
            />
          </div>
        )}

        {isAudio && (
          <div className="flex flex-col items-center justify-center gap-6 p-8 bg-[var(--s5)] border border-[var(--bd2)] rounded-2xl shadow-2xl max-w-md w-full">
            <div className="w-20 h-20 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-inner">
              <Music className="w-10 h-10" />
            </div>
            <div className="text-center font-mono">
              <h3 className="text-sm font-semibold text-[var(--tx1)] truncate max-w-xs">{file.name}</h3>
              <p className="text-xs text-[var(--tx5)] mt-1">{formatBytes(file.size)}</p>
            </div>
            <audio src={dataUri} controls className="w-full" onTimeUpdate={handleTimeUpdate} />
            {subtitleCues.length > 0 && subtitlesEnabled && (
              <p className="text-center text-sm text-[var(--tx1)] min-h-[1.5em] px-2 whitespace-pre-line">
                {activeCueText}
              </p>
            )}
          </div>
        )}

        {isVideo && (
          <div className="max-w-4xl max-h-full flex items-center justify-center bg-black rounded-xl overflow-hidden shadow-2xl border border-[var(--bd2)]">
            <video src={dataUri} controls className="w-full h-full max-h-[70vh]">
              {subtitleTrackUrl && (
                <track
                  ref={trackRef}
                  kind="subtitles"
                  src={subtitleTrackUrl}
                  srcLang="ko"
                  label="자막"
                  default
                />
              )}
            </video>
          </div>
        )}

        {isPdf && (
          <div className="w-full h-full flex flex-col">
            <object
              data={dataUri}
              type="application/pdf"
              className="w-full h-full rounded-lg border border-[var(--bd2)]"
            >
              <div className="flex flex-col items-center justify-center h-full text-[var(--tx4)] gap-2">
                <p>PDF Viewer is not supported directly in this environment.</p>
                <a
                  href={dataUri}
                  download={file.name}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold"
                >
                  Download PDF
                </a>
              </div>
            </object>
          </div>
        )}
      </div>
    </div>
  );
};
