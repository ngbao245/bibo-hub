import { useEffect, useState } from 'react';
import { Save, Trash2, Loader2, ExternalLink, Plus, X } from 'lucide-react';

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

  function handleDelete() {
    const ok = window.confirm(`Xoá source "${note.title || 'Untitled'}"?`);
    if (!ok) return;
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
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={remove.isPending}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xoá
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
