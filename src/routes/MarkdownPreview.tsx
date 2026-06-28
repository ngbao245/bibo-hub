import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Download, RotateCcw } from 'lucide-react';

import CodeEditor from '@/components/CodeEditor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';

import { renderMarkdown } from '@/lib/markdown-preview/render';
import { exportPreviewToPdf } from '@/lib/markdown-preview/export-pdf';
import { syncScroll } from '@/lib/markdown-preview/sync-scroll';
import { DEFAULT_INPUT } from '@/lib/markdown-preview/default-input';

import '@/styles/markdown-preview.css';

// ============================================================
// Markdown Preview — editor markdown + live preview 2 cột
// ============================================================
//
// Port từ markdown-live-preview tool gốc. Khác biệt chính:
//   - Editor dùng <CodeEditor> (textarea + line gutter + Ctrl C/X/V VSCode-style)
//     thay vì Monaco — đã có sẵn ở src/components/CodeEditor.tsx.
//   - State persist qua useLocalStorage thay vì Storehouse.
//   - Sync scroll 2 chiều (tool gốc chỉ editor → preview).
//   - Toast dùng sonner.
// ============================================================

export default function MarkdownPreviewPage() {
  const [md, setMd] = useLocalStorage('md-preview/content', DEFAULT_INPUT);
  const [sync, setSync] = useLocalStorage('md-preview/sync', false);
  const [lightTheme, setLightTheme] = useLocalStorage('md-preview/light', false);
  const [exporting, setExporting] = useState(false);

  // Debounce render để gõ liền tay không lag với markdown lớn.
  const [html, setHtml] = useState(() => renderMarkdown(md));
  useDebouncedEffect(() => setHtml(renderMarkdown(md)), [md], 80);

  const editorScrollRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);

  // CodeEditor render <textarea> bên trong, scroll thật ở đó (không phải wrapper).
  // Bám sự kiện scroll trực tiếp lên textarea sau khi mount.
  useEffect(() => {
    const wrapper = editorScrollRef.current;
    const preview = previewRef.current;
    if (!wrapper || !preview) return;
    const ta = wrapper.querySelector<HTMLTextAreaElement>('textarea');
    if (!ta) return;

    const onEditorScroll = () => {
      if (!sync) return;
      syncScroll(ta, preview, lock);
    };
    const onPreviewScroll = () => {
      if (!sync) return;
      syncScroll(preview, ta, lock);
    };

    ta.addEventListener('scroll', onEditorScroll);
    preview.addEventListener('scroll', onPreviewScroll);
    return () => {
      ta.removeEventListener('scroll', onEditorScroll);
      preview.removeEventListener('scroll', onPreviewScroll);
    };
  }, [sync]);

  function handleReset() {
    if (md !== DEFAULT_INPUT && !window.confirm('Reset markdown? Mọi thay đổi sẽ mất.')) return;
    setMd(DEFAULT_INPUT);
    editorScrollRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.scrollTo({ top: 0 });
    previewRef.current?.scrollTo({ top: 0 });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(md);
      toast.success('Đã copy markdown');
    } catch {
      toast.error('Copy thất bại');
    }
  }

  async function handleExport() {
    if (!previewRef.current || exporting) return;
    setExporting(true);
    try {
      await exportPreviewToPdf(previewRef.current);
      toast.success('Đã export PDF');
    } catch {
      toast.error('Export PDF thất bại');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="mr-auto text-sm font-semibold">Markdown Preview</h1>

        <Button variant="outline" size="sm" onClick={handleReset} className="h-7 gap-1 px-2 text-xs">
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 gap-1 px-2 text-xs">
          <Copy className="h-3 w-3" />
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Download className="h-3 w-3" />
          {exporting ? 'Exporting...' : 'Export PDF'}
        </Button>

        <label className="ml-2 flex select-none items-center gap-1.5 text-xs">
          <Checkbox checked={sync} onCheckedChange={(v) => setSync(!!v)} />
          Sync scroll
        </label>
        <label className="flex select-none items-center gap-1.5 text-xs">
          <Checkbox checked={lightTheme} onCheckedChange={(v) => setLightTheme(!!v)} />
          Light preview
        </label>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor pane. CodeEditor render <textarea> bên trong tự scroll, sync nghe ở effect. */}
        <div
          ref={editorScrollRef}
          className="flex w-1/2 flex-col overflow-hidden border-r border-border"
        >
          <CodeEditor value={md} onChange={setMd} placeholder="Type markdown..." />
        </div>

        {/* Preview pane. data-theme scoped để chỉ preview đổi sang light, app theme giữ nguyên. */}
        <div
          ref={previewRef}
          data-md-preview-root
          data-theme={lightTheme ? 'light' : undefined}
          className="w-1/2 overflow-auto bg-background"
        >
          <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}