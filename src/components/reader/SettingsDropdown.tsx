import { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Moon, Sun, Eye, EyeOff, Minus, Plus } from 'lucide-react';

type ReaderTheme = 'light' | 'sepia' | 'dark';

interface SettingsDropdownProps {
  theme: ReaderTheme;
  onThemeChange: () => void;
  selectionMaskEnabled: boolean;
  onToggleSelectionMask: () => void;
  selectionMaskTop: number;
  selectionMaskBottom: number;
  onMaskTopChange: (value: number) => void;
  onMaskBottomChange: (value: number) => void;
  scale?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  disableIosCallout?: boolean;
  onToggleIosCallout?: () => void;
}

export default function SettingsDropdown({
  theme,
  onThemeChange,
  selectionMaskEnabled,
  onToggleSelectionMask,
  selectionMaskTop,
  selectionMaskBottom,
  onMaskTopChange,
  onMaskBottomChange,
  scale,
  onZoomIn,
  onZoomOut,
  disableIosCallout = false,
  onToggleIosCallout,
}: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-zinc-400 hover:text-zinc-100"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl z-50">
          <div className="p-3 space-y-3">
            {/* Zoom */}
            {scale !== undefined && onZoomIn && onZoomOut && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Zoom</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onZoomOut}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-mono text-zinc-400 min-w-[3rem] text-center">
                      {Math.round(scale * 100)}%
                    </span>
                    <button
                      onClick={onZoomIn}
                      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="h-px bg-zinc-800" />
              </>
            )}

            {/* Theme */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">Theme</span>
              <button
                onClick={onThemeChange}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </>
                ) : theme === 'sepia' ? (
                  <>
                    <Sun className="h-4 w-4 text-amber-400" />
                    <span>Sepia</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </>
                )}
              </button>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Selection Mask Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">Selection Mask</span>
              <button
                onClick={onToggleSelectionMask}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {selectionMaskEnabled ? (
                  <>
                    <Eye className="h-4 w-4 text-blue-400" />
                    <span>ON</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span>OFF</span>
                  </>
                )}
              </button>
            </div>

            {/* Selection Mask Controls */}
            {selectionMaskEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Top (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={selectionMaskTop}
                    onChange={(e) => onMaskTopChange(Number(e.target.value))}
                    className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-center text-xs text-zinc-200"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Bottom (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={selectionMaskBottom}
                    onChange={(e) => onMaskBottomChange(Number(e.target.value))}
                    className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-center text-xs text-zinc-200"
                  />
                </div>
              </div>
            )}

            {/* iOS Callout Disable - Only show on mobile/touch devices */}
            {onToggleIosCallout && 'ontouchstart' in window && (
              <>
                <div className="h-px bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Disable iOS Menu</span>
                  <button
                    onClick={onToggleIosCallout}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                      disableIosCallout
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                    }`}
                  >
                    <span>{disableIosCallout ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
