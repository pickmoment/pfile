import React from 'react';
import { Minus, Plus, Type } from 'lucide-react';
import { Modal } from './Modal';
import { useUiPreferencesStore } from '../../store/useUiPreferencesStore';
import { UI_FONT_OPTIONS } from '../../utils/uiFontOptions';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const uiFontFamily = useUiPreferencesStore((s) => s.uiFontFamily);
  const setUiFontFamily = useUiPreferencesStore((s) => s.setUiFontFamily);
  const uiZoomLevel = useUiPreferencesStore((s) => s.uiZoomLevel);
  const setUiZoomLevel = useUiPreferencesStore((s) => s.setUiZoomLevel);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Appearance Settings">
      <div className="space-y-5">
        <div>
          <label htmlFor="ui-font-family" className="flex items-center gap-1.5 text-xs font-semibold text-[var(--tx2)] mb-2">
            <Type className="w-3.5 h-3.5" />
            App Font
          </label>
          <select
            id="ui-font-family"
            value={uiFontFamily}
            onChange={(e) => setUiFontFamily(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[var(--s3)] border border-[var(--bd1)] rounded-lg text-[var(--tx1)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          >
            {UI_FONT_OPTIONS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-[var(--tx5)]">
            Applies to the title bar, sidebar, toolbars, and dialogs. Content viewer fonts are set separately per file.
          </p>
        </div>

        <div>
          <span className="block text-xs font-semibold text-[var(--tx2)] mb-2">App Size (Zoom)</span>
          <div
            className="flex items-center bg-[var(--s2)] p-0.5 rounded-lg border border-[var(--bd2)] w-fit"
            aria-label="App zoom level"
          >
            <button
              onClick={() => setUiZoomLevel((zoom) => zoom - 10)}
              disabled={uiZoomLevel <= 50}
              title="Zoom out"
              className="p-1.5 rounded-md text-[var(--tx4)] hover:text-[var(--tx1)] hover:bg-[var(--s7)] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setUiZoomLevel(100)}
              title="Reset zoom"
              className="w-14 text-center text-[11px] font-mono text-[var(--tx3)] hover:text-[var(--tx1)]"
            >
              {uiZoomLevel}%
            </button>
            <button
              onClick={() => setUiZoomLevel((zoom) => zoom + 10)}
              disabled={uiZoomLevel >= 200}
              title="Zoom in"
              className="p-1.5 rounded-md text-[var(--tx4)] hover:text-[var(--tx1)] hover:bg-[var(--s7)] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--tx5)]">
            Scales the whole app window — text, icons, and layout together.
          </p>
        </div>
      </div>
    </Modal>
  );
};
