
import { useMemo, useState } from 'react';
import { Lock, Plus, Trash2, Save, Copy } from 'lucide-react';

import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/api/notes';
import { encryptSecret, decryptSecret } from '@/lib/secretCrypto';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { LoadingState, EmptyState } from '@/components/shared';

import type { Note } from '@/schemas/note';

// ============================================================
// Secret Modal — notes mã hoá bằng password
// ============================================================

export default function Secret() {
  return (
    <ToolModal id="secret" title="Secret Notes" className="max-w-4xl">
      <SecretContent />
    </ToolModal>
  );
}

function SecretContent() {
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Lock className="mb-3 h-12 w-12 text-destructive" />
        <h2 className="mb-2 text-lg font-semibold text-foreground">Chỉ dành cho admin</h2>
        <p className="text-sm text-muted-foreground">
          Secret Notes yêu cầu quyền admin. Liên hệ admin để được cấp.
        </p>
      </div>
    );
  }

  return <SecretApp />;
}

// ============================================================
// Secret notes app: list + editor
// ============================================================
function SecretApp() {
  const notesQuery = useNotes();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter và decrypt secret notes
  const secretNotes = useMemo(() => {
    if (!notesQuery.data) return [];
    return notesQuery.data
      .filter((n) => n.type === 'secret')
      .map((n) => ({
        ...n,
        title: decryptSecret(n.title),
        content: decryptSecret(n.content),
        url1: n.url1 ? decryptSecret(n.url1) : null,
      }))
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [notesQuery.data]);

  const selectedNote = secretNotes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="grid h-[60vh] grid-cols-1 gap-px bg-border md:grid-cols-[280px_1fr]">
      {/* List */}
      <div className="flex flex-col overflow-hidden bg-background">
        <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider">Notes</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setSelectedId('__new__')}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notesQuery.isLoading ? (
            <LoadingState
              variant="skeleton"
              layout="list"
              count={3}
              itemClassName="h-12"
              className="p-2"
            />
          ) : secretNotes.length === 0 ? (
            <EmptyState compact icon={Lock} title="Chưa có secret note nào" />
          ) : (
            <ul>
              {secretNotes.map((note) => (
                <li key={note.id}>
                  <button
                    onClick={() => setSelectedId(note.id)}
                    className={cn(
                      'w-full border-b border-border px-3 py-2 text-left transition-colors',
                      selectedId === note.id ? 'bg-popover' : 'hover:bg-popover/50',
                    )}
                  >
                    <div className="truncate text-sm">{note.title || 'Untitled'}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="overflow-y-auto bg-background">
        {selectedId === '__new__' ? (
          <SecretEditor key="new" note={null} onSaved={(id) => setSelectedId(id)} onCancel={() => setSelectedId(null)} />
        ) : selectedNote ? (
          <SecretEditor key={selectedNote.id} note={selectedNote} onSaved={(id) => setSelectedId(id)} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Chọn một note hoặc tạo note mới
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Secret editor (form)
// ============================================================
interface SecretEditorProps {
  note: Note | null;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}

function SecretEditor({ note, onSaved, onDeleted, onCancel }: SecretEditorProps) {
  const create = useCreateNote();
  const update = useUpdateNote();
  const remove = useDeleteNote();

  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  // urls đơn giản: 1 dòng/url, lưu vào url1 với separator '|' (giống v1)
  const [urlsText, setUrlsText] = useState(
    note?.url1 ? note.url1.split('|').filter(Boolean).join('\n') : '',
  );

  function handleSave() {
    const urls = urlsText
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
      .join('|');

    const payload = {
      title: encryptSecret(title.trim() || 'Untitled'),
      content: encryptSecret(content),
      type: 'secret' as const,
      url1: encryptSecret(urls),
    };

    if (note?.id) {
      update.mutate(
        { ...note, ...payload },
        {
          onSuccess: () => {
            toast.success('Đã lưu');
            onSaved(note.id);
          },
          onError: () => toast.error('Lỗi lưu'),
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: (newNote) => {
          toast.success('Đã tạo secret note');
          onSaved(newNote.id);
        },
        onError: () => toast.error('Lỗi tạo'),
      });
    }
  }

  async function handleDelete() {
    if (!note?.id) return;
    if (!window.confirm('Delete secret note?')) return;
    remove.mutate(note.id, {
      onSuccess: () => {
        toast.success('Đã xoá');
        onDeleted?.();
      },
      onError: () => toast.error('Lỗi xoá'),
    });
  }

  function handleCopyUrl(url: string) {
    navigator.clipboard.writeText(url);
    toast.success('Đã sao chép');
  }

  const urlList = urlsText.split('\n').map((u) => u.trim()).filter(Boolean);
  const isPending = create.isPending || update.isPending;

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {note ? 'Chỉnh sửa' : 'Tạo mới'}
        </h3>
        <div className="flex gap-1.5">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Huỷ
            </Button>
          )}
          {note && (
            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Xoá
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Lưu
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tiêu đề
          </label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Nội dung
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nội dung bí mật..."
            className="min-h-[200px] w-full resize-none border border-input bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            URLs (mỗi URL 1 dòng, có thể prefix tên: <code className="text-foreground">tên::url</code>)
          </label>
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder={'Github::https://github.com\nhttps://example.com'}
            className="min-h-[80px] w-full resize-none border border-input bg-background p-3 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Preview URLs với click-to-copy */}
        {urlList.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Click để copy ({urlList.length})
            </label>
            <ul className="space-y-1">
              {urlList.map((entry, i) => {
                const [name, url] = entry.includes('::')
                  ? entry.split('::')
                  : ['', entry];
                return (
                  <li
                    key={i}
                    onClick={() => handleCopyUrl(url)}
                    className="flex cursor-pointer items-center gap-2 border border-border bg-card px-3 py-1.5 transition-colors hover:border-primary"
                  >
                    <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      {name && (
                        <div className="truncate text-xs font-medium">{name}</div>
                      )}
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {url}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}