import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Upload, Download, FileCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJsonStudioStore } from '@/tools/json-studio/store';
import { useJsonStudioEditorStore } from '@/tools/json-studio/editor-store';
import {
  ALL_FORMATS,
  FORMAT_META,
  detectFormat,
  formatFromFilename,
  parseByFormat,
  stringifyByFormat,
} from '@/tools/json-studio/lib/formats';
import { parseAsync } from '@/tools/json-studio/lib/parser-client';
import { downloadFile, getDefaultFilename } from '@/tools/json-studio/lib/export-formatter';
import type { SourceFormat } from '@/tools/json-studio/lib/types';
import { cn } from '@/lib/cn';

// ============================================================
// IOPanel - 2 dropdown gọn cho editor header:
//   1. File: Import | Export
//   2. Format: JSON / CSV / YAML / XML — source of truth là store.sourceFormat.
//
// Khi user đổi format trong dropdown:
//   - Nếu rawData đã parse OK → stringify sang format mới + sync textarea +
//     update store.sourceFormat. KHÔNG re-parse text cũ (đã có data object).
//   - Nếu data hiện tại không serialize được sang format mới
//     (vd object lồng → CSV) → toast cảnh báo + giữ format cũ.
//   - Nếu rawData lỗi → vẫn switch format (chỉ đổi parser) + giữ text,
//     editor store sẽ re-parse text theo format mới ở keystroke kế tiếp.
// ============================================================

export function IOPanel() {
  const rawData = useJsonStudioStore((s) => s.rawData);
  const filename = useJsonStudioStore((s) => s.sourceFilename);
  const format = useJsonStudioStore((s) => s.sourceFormat);
  const setData = useJsonStudioStore((s) => s.setData);
  const error = useJsonStudioEditorStore((s) => s.error);
  const editorText = useJsonStudioEditorStore.getState; // dùng getState để né subscribe

  const [actionOpen, setActionOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const actionRef = useRef<HTMLDivElement | null>(null);
  const formatRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Click outside để đóng dropdown
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (actionOpen && !actionRef.current?.contains(e.target as Node)) setActionOpen(false);
      if (formatOpen && !formatRef.current?.contains(e.target as Node)) setFormatOpen(false);
    };
    if (actionOpen || formatOpen) {
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }
  }, [actionOpen, formatOpen]);

  // === Format switch ===
  const handleFormatChange = async (next: SourceFormat) => {
    setFormatOpen(false);
    if (next === format) return;

    setConverting(true);
    try {
      // Nếu editor đang error: data store có thể stale → reparse text trước
      // theo format hiện tại, nếu fail thì chỉ switch format (giữ text).
      let dataToConvert: unknown = rawData;
      if (error) {
        const currentText = editorText().text;
        try {
          dataToConvert = await parseByFormat(currentText.trim(), format);
        } catch {
          // Không convert được — switch format và để user fix text.
          setData(rawData, next, replaceExt(filename, next));
          return;
        }
      }

      const converted = await stringifyByFormat(dataToConvert, next);
      if (converted === null) {
        // CSV trả null khi data không tìm được shape phù hợp.
        toast.error(
          `Không convert được sang ${FORMAT_META[next].label}. Data shape không phù hợp.`
        );
        return;
      }

      // Re-parse text mới để rawData store khớp với CSV/XML đã được
      // wrap/unwrap (vd JSON `{fruits: [...]}` → CSV chỉ chứa fruits array;
      // bất cứ format → XML đều wrap thêm root). Nếu re-parse fail thì
      // fallback dùng data gốc (hiếm khi xảy ra trừ khi stringify lỗi silent).
      let finalData: unknown = dataToConvert;
      try {
        finalData = await parseByFormat(converted, next);
      } catch {
        // Giữ dataToConvert làm fallback.
      }

      setData(finalData, next, replaceExt(filename, next));
      useJsonStudioEditorStore.getState().syncFromData(converted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Convert fail';
      toast.error(`Lỗi convert: ${msg}`);
    } finally {
      setConverting(false);
    }
  };

  // === Import flow ===
  const handleImport = () => {
    setActionOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File quá lớn (>20MB).');
      return;
    }
    try {
      const text = await file.text();
      // Ưu tiên extension, fallback content detect, fallback dropdown format hiện tại.
      const fromExt = formatFromFilename(file.name);
      const fromContent = detectFormat(text);
      const useFormat: SourceFormat = fromExt ?? fromContent ?? format;

      const { promise } = parseAsync(text, useFormat);
      const data = await promise;

      setData(data, useFormat, file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import fail';
      toast.error(`Lỗi import: ${msg}`);
    }
  };

  // === Export flow ===
  const handleExport = async () => {
    setActionOpen(false);
    try {
      const content = await stringifyByFormat(rawData, format);
      if (content === null) {
        toast.error(
          `Không export được sang ${FORMAT_META[format].label}. Data shape không phù hợp.`
        );
        return;
      }
      downloadFile(content, getDefaultFilename(filename, format), FORMAT_META[format].mime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export fail';
      toast.error(`Lỗi export: ${msg}`);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept={FORMAT_META[format].accept}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Dropdown 1: File */}
      <div className="relative" ref={actionRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setActionOpen((v) => !v);
            setFormatOpen(false);
          }}
          className="gap-1"
        >
          <FileCog className="h-3.5 w-3.5" />
          File
          <ChevronDown className="h-3 w-3" />
        </Button>
        {actionOpen && (
          <div
            className={cn(
              'absolute left-0 top-full z-50 mt-1 w-max min-w-full border border-border bg-popover p-1 shadow-md',
              'text-sm text-popover-foreground'
            )}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 whitespace-nowrap px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={handleImport}
            >
              <Upload className="h-3.5 w-3.5" />
              Import file
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 whitespace-nowrap px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              Export file
            </button>
          </div>
        )}
      </div>

      {/* Dropdown 2: Format */}
      <div className="relative" ref={formatRef}>
        <Button
          variant="outline"
          size="sm"
          disabled={converting}
          onClick={() => {
            setFormatOpen((v) => !v);
            setActionOpen(false);
          }}
          className="gap-1"
        >
          {FORMAT_META[format].label}
          <ChevronDown className="h-3 w-3" />
        </Button>
        {formatOpen && (
          <div
            className={cn(
              'absolute right-0 top-full z-50 mt-1 w-max min-w-full border border-border bg-popover p-1 shadow-md',
              'text-sm text-popover-foreground'
            )}
          >
            {ALL_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                className={cn(
                  'flex w-full items-center whitespace-nowrap px-2 py-1.5 text-left text-xs hover:bg-muted',
                  format === f && 'bg-muted font-medium'
                )}
                onClick={() => void handleFormatChange(f)}
              >
                {FORMAT_META[f].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Đổi extension cho phù hợp format mới. `data.json` → `data.yaml`. */
function replaceExt(name: string, fmt: SourceFormat): string {
  const base = name.replace(/\.[^.]+$/, '') || 'data';
  return `${base}.${FORMAT_META[fmt].extension}`;
}