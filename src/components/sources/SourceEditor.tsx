import { useEffect, useState, useMemo } from 'react';
import { Save, Trash2, Loader2, ExternalLink, Plus, X, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';
import { toast } from '@/components/ui/sonner';

import type { Note } from '@/schemas/note';
import { useUpdateNote, useDeleteNote } from '@/api/notes';

// ============================================================
// SourceEditor - form edit source
// ============================================================
//
// Source khác Note thường: trọng tâm là URL + ghi chú ngắn.
// Lưu vào fields:
//   title    → tên source
//   source   → URL chính
//   tags     → tags (tag1, tag2...)
//   content  → mô tả / ghi chú (plain text)
//   url1-5   → URL phụ
// ============================================================

interface SourceEditorProps {
  note: Note;
  onDeleted?: () => void;
}

export default function SourceEditor({ note, onDeleted }: SourceEditorProps) {
  const update = useUpdateNote();
  const remove = useDeleteNote();

  const [title, setTitle] = useState(note.title);
  const [mainUrl, setMainUrl] = useState(note.source ?? '');
  const [tags, setTags] = useState(note.tags ?? '');
  const [content, setContent] = useState(note.content);
  const [extraUrls, setExtraUrls] = useState<string[]>(() => {
    return [note.url1, note.url2, note.url3, note.url4, note.url5]
      .filter((u): u is string => Boolean(u))
      .concat(['']);
  });
  const [isDirty, setIsDirty] = useState(false);

  // Detect xem source có phải là packed project không
  const isPackedProject = useMemo(
    () =>
      (note.tags?.includes('packed') || note.source === 'project-packer') &&
      note.content.includes('===FILE_START==='),
    [note.tags, note.source, note.content],
  );

  // Extract pack-id từ tags (nếu có)
  const packId = useMemo(() => {
    if (!note.tags) return null;
    const match = note.tags.match(/pack-id:([^\s,]+)/);
    return match ? match[1] : null;
  }, [note.tags]);

  // Handler download packed project thành ZIP
  async function handleDownloadProject() {
    if (!isPackedProject) return;

    try {
      toast.info('Đang chuẩn bị download...');

      // Nếu có pack-id → fetch tất cả parts cùng pack-id
      let allContent = note.content;

      if (packId) {
        const { fetchJson } = await import('@/api/client');
        const { API } = await import('@/lib/config');
        const { parseNotes } = await import('@/schemas/note');

        toast.info('Đang tìm các parts liên quan...');
        const allNotes = await fetchJson<unknown[]>(API.NOTES);
        const parsed = parseNotes(allNotes);

        // Lọc tất cả sources có cùng pack-id
        const samePack = parsed.filter(
          (n) => n.type === 'source' && n.tags?.includes(`pack-id:${packId}`)
        );

        if (samePack.length > 1) {
          toast.info(`Tìm thấy ${samePack.length} parts, đang gộp...`);

          // Sort theo part number (part:X/Y)
          samePack.sort((a, b) => {
            const aMatch = a.tags?.match(/part:(\d+)\/\d+/);
            const bMatch = b.tags?.match(/part:(\d+)\/\d+/);
            const aNum = aMatch ? parseInt(aMatch[1]) : 0;
            const bNum = bMatch ? parseInt(bMatch[1]) : 0;
            return aNum - bNum;
          });

          // Gộp content của tất cả parts
          allContent = samePack.map((n) => n.content).join('\n\n');
        }
      }

      const { unpackText, buildZip, downloadBlob } = await import('@/lib/packer/unpack');
      toast.info('Đang giải nén project...');

      const { files } = unpackText(allContent);
      if (files.length === 0) {
        toast.error('Không parse được file nào từ source này');
        return;
      }

      toast.info(`Tìm thấy ${files.length} file, đang tạo ZIP...`);
      const blob = await buildZip(files);
      downloadBlob(blob, `${note.title || 'project'}-unpacked.zip`);
      toast.success(`Đã tải ${files.length} file`);
    } catch (e) {
      toast.error('Không download được project');
      console.error(e);
    }
  }

  // Handler xóa tất cả parts cùng pack (cho packed project)
  async function handleDeletePack() {
    if (!isPackedProject || !packId) {
      // Không phải packed project hoặc không có pack-id → xóa source thường
      return handleDelete();
    }

    try {
      const { fetchJson } = await import('@/api/client');
      const { API } = await import('@/lib/config');
      const { parseNotes } = await import('@/schemas/note');

      // Fetch tất cả sources cùng pack-id
      const allNotes = await fetchJson<unknown[]>(API.NOTES);
      const parsed = parseNotes(allNotes);
      const samePack = parsed.filter(
        (n) => n.type === 'source' && n.tags?.includes(`pack-id:${packId}`)
      );

      const count = samePack.length;
      const confirmMsg = count > 1
        ? `Xóa tất cả ${count} parts của pack này?\n\n${samePack.map(s => s.title).join('\n')}`
        : `Delete source "${note.title || 'Untitled'}"?`;

      if (!window.confirm(confirmMsg)) return;

      // Xóa tất cả parts
      let deleted = 0;
      for (const part of samePack) {
        try {
          await fetchJson(`${API.NOTES}/${part.id}`, { method: 'DELETE' });
          deleted++;
        } catch {
          // Continue nếu có part bị lỗi
        }
      }

      toast.success(`Đã xóa ${deleted}/${count} part${count > 1 ? 's' : ''}`);
      onDeleted?.();
    } catch (e) {
      toast.error('Không xóa được');
      console.error(e);
    }
  }

  // Reset khi switch sang source khác
  useEffect(() => {
    setTitle(note.title);
    setMainUrl(note.source ?? '');
    setTags(note.tags ?? '');
    setContent(note.content);
    setExtraUrls(
      [note.url1, note.url2, note.url3, note.url4, note.url5]
        .filter((u): u is string => Boolean(u))
        .concat(['']),
    );
    setIsDirty(false);
  }, [note.id]);

  // Auto-save 800ms
  useDebouncedEffect(
    () => {
      if (!isDirty) return;
      doSave({ silent: true });
    },
    [title, mainUrl, tags, content, extraUrls, isDirty],
    800,
  );

  function markDirty() {
    if (!isDirty) setIsDirty(true);
  }

  async function doSave({ silent = false } = {}) {
    // Tách extra URLs (loại bỏ rỗng), gán vào url1-5 (max 5)
    const filledUrls = extraUrls.filter(Boolean).slice(0, 5);
    const padded = [...filledUrls, ...Array(5 - filledUrls.length).fill('')];

    const updated: Note = {
      ...note,
      title,
      source: mainUrl,
      tags,
      content,
      url1: padded[0],
      url2: padded[1],
      url3: padded[2],
      url4: padded[3],
      url5: padded[4],
    };

    update.mutate(updated, {
      onSuccess: () => {
        setIsDirty(false);
        if (!silent) toast.success('Đã lưu');
      },
      onError: () => {
        if (!silent) toast.error('Không lưu được');
      },
    });
  }

  async function handleDelete() {
    if (!window.confirm(`Delete source "${note.title || 'Untitled'}"?`)) return;
    remove.mutate(note.id, {
      onSuccess: () => {
        toast.success('Đã xoá');
        onDeleted?.();
      },
      onError: () => toast.error('Không xoá được'),
    });
  }

  function updateExtraUrl(idx: number, value: string) {
    const next = [...extraUrls];
    next[idx] = value;
    // Tự động thêm 1 input rỗng cuối nếu vừa nhập input cuối
    if (idx === extraUrls.length - 1 && value && extraUrls.length < 5) {
      next.push('');
    }
    setExtraUrls(next);
    markDirty();
  }

  function removeExtraUrl(idx: number) {
    const next = extraUrls.filter((_, i) => i !== idx);
    setExtraUrls(next.length === 0 ? [''] : next);
    markDirty();
  }

  const saveStatus = update.isPending ? 'saving' : isDirty ? 'unsaved' : 'saved';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
        <SaveIndicator status={saveStatus} />
        <div className="flex gap-2">
          {isPackedProject && (
            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadProject}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download Project
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeletePack}
            disabled={remove.isPending}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isPackedProject && packId ? 'Xoá Pack' : 'Xoá'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => doSave()}
            disabled={!isDirty || update.isPending}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Lưu
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            placeholder="Tên source..."
            className="border-0 border-b border-border px-0 text-xl font-semibold focus-visible:ring-0"
          />

          {/* Main URL */}
          <div className="space-y-1">
            <Label>URL chính</Label>
            <UrlInput
              value={mainUrl}
              onChange={(v) => {
                setMainUrl(v);
                markDirty();
              }}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1">
            <Label>Tags</Label>
            <Input
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
                markDirty();
              }}
              placeholder="tag1, tag2..."
            />
          </div>

          <div className="space-y-1">
            <Label>URL liên quan ({extraUrls.filter(Boolean).length}/5)</Label>
            <div className="space-y-1.5">
              {extraUrls.map((url, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <UrlInput
                    value={url}
                    onChange={(v) => updateExtraUrl(idx, v)}
                    placeholder="https://..."
                  />
                  {url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExtraUrl(idx)}
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      title="Xoá URL"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {extraUrls.length < 5 && extraUrls[extraUrls.length - 1] && (
                <button
                  onClick={() => setExtraUrls([...extraUrls, ''])}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <Plus className="h-3 w-3" />
                  Thêm URL
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Mô tả / Ghi chú</Label>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                markDirty();
              }}
              placeholder="Mô tả ngắn về source này..."
              className="min-h-[200px] w-full resize-y border border-input bg-background p-3 text-sm leading-relaxed focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

function UrlInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex gap-1.5">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      {value && (
        <Button
          variant="outline"
          size="icon"
          asChild
          className="h-9 w-9 shrink-0"
          title="Mở trong tab mới"
        >
          <a href={value} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: 'saving' | 'unsaved' | 'saved' }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Đang lưu...
      </span>
    );
  }
  if (status === 'unsaved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 bg-primary" />
        Chưa lưu
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Đã lưu</span>;
}