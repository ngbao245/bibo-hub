import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  Trash2,
  Loader2,
  Edit,
  Eye,
  ExternalLink,
  Type,
  Link2,
  Plus,
  ChevronDown,
  ChevronUp,
  Unlink,
  X,
  Layers,
  FileText,
  Tag,
  Clock,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';

import type { Note, NoteType } from '@/schemas/note';
import { useUpdateNote, useDeleteNote, useCreateNote } from '@/api/notes';
import RichEditor from '@/components/RichEditor';
import LinkedNotesPicker from '@/components/LinkedNotesPicker';

// ============================================================
// NoteEditor - View mode (default) + Edit mode
// ============================================================
//
// View mode:
// - Double-click title  → inline edit title (lưu ngay khi blur/Enter)
// - Double-click content → chuyển sang Edit mode
// - Toolbar: Sửa | Link | Xoá
// - Section "Related Notes" với + Child Note / Link
//
// Edit mode:
// - Form full (title/type/tags/source/timer/url1-5/example)
// - Rich text editor cho content
// - Section Related Notes với + Child Note / Link / Unlink
// - Save manual: Ctrl+S hoặc nút Lưu (KHÔNG auto-save để tránh spam API)
// - Esc: confirm nếu dirty rồi thoát về View
// - beforeunload: cảnh báo khi có thay đổi chưa lưu
// - isDirty derive từ so sánh state vs note prop (Ctrl+Z về gốc cũng tự "saved")
// - Word count 3-priority: selection > text giữa `` `` > all
// ============================================================

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'course', label: 'Course' },
  { value: 'code', label: 'Code' },
];

function getTypeLabel(type: NoteType): string {
  return NOTE_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface NoteEditorProps {
  note: Note;
  allNotes?: Note[];
  onDeleted?: () => void;
  onSelectNote?: (id: string) => void;
}

export default function NoteEditor({
  note,
  allNotes = [],
  onDeleted,
  onSelectNote,
}: NoteEditorProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Reset về view mode khi đổi note
  useEffect(() => {
    setMode('view');
  }, [note.id]);

  if (mode === 'view') {
    return (
      <NoteViewMode
        note={note}
        allNotes={allNotes}
        onEdit={() => setMode('edit')}
        onDeleted={onDeleted}
        onSelectNote={onSelectNote}
      />
    );
  }

  return (
    <NoteEditMode
      note={note}
      allNotes={allNotes}
      onView={() => setMode('view')}
      onDeleted={onDeleted}
      onSelectNote={onSelectNote}
    />
  );
}

// ============================================================
// VIEW MODE
// ============================================================
function NoteViewMode({
  note,
  allNotes,
  onEdit,
  onDeleted,
  onSelectNote,
}: {
  note: Note;
  allNotes: Note[];
  onEdit: () => void;
  onDeleted?: () => void;
  onSelectNote?: (id: string) => void;
}) {
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const createNote = useCreateNote();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset draft khi note đổi
  useEffect(() => {
    setTitleDraft(note.title);
    setEditingTitle(false);
  }, [note.id, note.title]);

  function handleDelete() {
    if (!window.confirm(`Xoá note "${note.title || 'Untitled'}"?`)) return;
    remove.mutate(note.id, {
      onSuccess: () => {
        toast.success('Đã xoá');
        onDeleted?.();
      },
    });
  }

  function saveTitle() {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next || next === note.title) {
      setTitleDraft(note.title);
      return;
    }
    update.mutate({ ...note, title: next });
  }

  function handleSaveLinkedNotes(ids: string[]) {
    update.mutate(
      { ...note, linkedNotes: ids },
      {
        onSuccess: () => toast.success('Đã cập nhật link'),
        onError: () => toast.error('Không cập nhật được'),
      },
    );
  }

  function handleQuickCreateChildFromToolbar() {
    const linkedIds = note.linkedNotes ?? [];
    const childCount = linkedIds
      .map((id) => allNotes.find((n) => n.id === id))
      .filter((n): n is Note => !!n && n.isChildNote).length;
    const defaultTitle = `New ${childCount + 1} - ${new Date().toLocaleDateString('vi-VN')}`;
    const title = window.prompt('Tên child note:', defaultTitle);
    if (!title) return;
    createNote.mutate(
      {
        title: title.trim() || defaultTitle,
        content: '',
        type: note.type,
        isChildNote: true,
        parentNoteId: note.id,
      },
      {
        onSuccess: (newChild) => {
          update.mutate({ ...note, linkedNotes: [...linkedIds, newChild.id] });
          toast.success('Đã tạo child note');
        },
        onError: () => toast.error('Không tạo được child note'),
      },
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          Xem
        </div>
        <div className="flex items-center gap-2">
          <RelatedPopover
            linkedIds={note.linkedNotes ?? []}
            allNotes={allNotes}
            onSelectNote={onSelectNote}
            onOpenPicker={() => setPickerOpen(true)}
            onCreateChild={handleQuickCreateChildFromToolbar}
            disabled={createNote.isPending}
          />
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
            <Edit className="h-3.5 w-3.5" />
            Sửa
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          {/* Title (double-click → inline edit) */}
          {editingTitle ? (
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveTitle();
                } else if (e.key === 'Escape') {
                  setTitleDraft(note.title);
                  setEditingTitle(false);
                }
              }}
              autoFocus
              className="mb-3 h-auto border-0 border-b border-border px-0 text-2xl font-bold focus-visible:ring-0"
            />
          ) : (
            <h1
              onDoubleClick={() => setEditingTitle(true)}
              className="mb-3 cursor-text text-2xl font-bold text-foreground hover:bg-popover/30"
              title="Double-click để sửa tên"
            >
              {note.title || 'Untitled'}
            </h1>
          )}

          {/* Meta badges */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
              {getTypeLabel(note.type)}
            </span>
            {note.tags && (
              <span className="inline-flex items-center gap-1 border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" />
                {note.tags}
              </span>
            )}
            {note.timerDuration && parseInt(note.timerDuration) > 0 && (
              <span className="inline-flex items-center gap-1 border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {note.timerDuration} min
              </span>
            )}
            {note.source && (
              <a
                href={note.source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 border border-border bg-card px-2 py-0.5 text-xs text-primary hover:border-primary"
              >
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            )}
            {note.createdAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(note.createdAt).toLocaleDateString('vi-VN')}
              </span>
            )}
          </div>

          {/* Rendered HTML content (double-click → edit mode) */}
          <div
            onDoubleClick={onEdit}
            className="prose-custom cursor-text"
            title="Double-click để sửa nội dung"
            dangerouslySetInnerHTML={{
              __html:
                note.content ||
                '<p class="text-muted-foreground">Chưa có nội dung. Double-click để bắt đầu.</p>',
            }}
          />

          {/* URLs */}
          {hasAnyUrl(note) && (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resources
              </h3>
              <div className="space-y-1">
                {([note.url1, note.url2, note.url3, note.url4, note.url5] as const)
                  .map((u, i) => ({ url: u, idx: i + 1 }))
                  .filter((x) => !!x.url)
                  .map(({ url, idx }) => (
                    <a
                      key={idx}
                      href={url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{url}</span>
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* Example */}
          {note.example && (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Example
              </h3>
              <div className="whitespace-pre-wrap text-sm text-foreground">
                {note.example}
              </div>
            </div>
          )}

          {/* Related Notes */}
          <RelatedNotesViewSection
            note={note}
            allNotes={allNotes}
            onSelectNote={onSelectNote}
            onOpenPicker={() => setPickerOpen(true)}
          />
        </div>
      </div>

      {/* Picker modal */}
      <LinkedNotesPicker
        open={pickerOpen}
        allNotes={allNotes}
        currentNoteId={note.id}
        initialSelected={note.linkedNotes ?? []}
        onClose={() => setPickerOpen(false)}
        onSave={handleSaveLinkedNotes}
      />
    </div>
  );
}

function hasAnyUrl(n: Note): boolean {
  return Boolean(n.url1 || n.url2 || n.url3 || n.url4 || n.url5);
}

function arrayEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Icon phân biệt child note vs linked note */
function RelatedKindIcon({
  isChild,
  className,
}: {
  isChild: boolean;
  className?: string;
}) {
  return isChild ? (
    <FileText className={className} />
  ) : (
    <Link2 className={className} />
  );
}

// ============================================================
// RelatedPopover - dropdown từ toolbar, list các related notes.
// Truy cập nhanh ngay cả khi đang scroll giữa note dài.
// ============================================================
function RelatedPopover({
  linkedIds,
  allNotes,
  onSelectNote,
  onOpenPicker,
  onCreateChild,
  disabled,
}: {
  linkedIds: string[];
  allNotes: Note[];
  onSelectNote?: (id: string) => void;
  onOpenPicker: () => void;
  onCreateChild: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click ngoài để đóng
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const linked = linkedIds
    .map((id) => allNotes.find((n) => n.id === id))
    .filter((n): n is Note => !!n);

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
        title="Xem note liên quan"
      >
        <Layers className="h-3.5 w-3.5" />
        Related
        {linked.length > 0 && (
          <span className="ml-0.5 border border-border bg-popover px-1 text-[10px] font-mono">
            {linked.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 border border-border bg-card shadow-2xl">
          {/* Header với 2 nút action */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Related Notes ({linked.length})
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  onCreateChild();
                }}
                disabled={disabled}
                className="h-6 gap-1 px-1.5 text-[10px]"
                title="Tạo child note mới"
              >
                <Plus className="h-3 w-3" />
                Child
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  onOpenPicker();
                }}
                className="h-6 gap-1 px-1.5 text-[10px]"
                title="Link tới note có sẵn"
              >
                <Link2 className="h-3 w-3" />
                Link
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {linked.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Chưa có note liên quan
              </div>
            ) : (
              <ul>
                {linked.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onSelectNote?.(n.id);
                      }}
                      className="flex w-full items-center gap-2 border-b border-border px-2 py-1.5 text-left transition-colors hover:bg-popover/50"
                    >
                      <RelatedKindIcon
                        isChild={n.isChildNote}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                        {n.title || 'Untitled'}
                      </span>
                      <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground">
                        {n.type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Related Notes section — VIEW MODE
// ============================================================
function RelatedNotesViewSection({
  note,
  allNotes,
  onSelectNote,
  onOpenPicker,
}: {
  note: Note;
  allNotes: Note[];
  onSelectNote?: (id: string) => void;
  onOpenPicker: () => void;
}) {
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const createNote = useCreateNote();
  // Trạng thái collapse share giữa các note (1 key chung, không lưu rác mỗi note 1 key)
  const [collapsed, setCollapsed] = useLocalStorage(
    'notes_relatedCollapsed',
    true,
  );

  const linkedIds = note.linkedNotes ?? [];
  const linkedNotes = linkedIds
    .map((id) => allNotes.find((n) => n.id === id))
    .filter((n): n is Note => !!n);

  function handleQuickCreateChild() {
    const childCount = linkedNotes.filter((n) => n.isChildNote).length;
    const defaultTitle = `New ${childCount + 1} - ${new Date().toLocaleDateString('vi-VN')}`;
    const title = window.prompt('Tên child note:', defaultTitle);
    if (!title) return;
    createNote.mutate(
      {
        title: title.trim() || defaultTitle,
        content: '',
        type: note.type,
        isChildNote: true,
        parentNoteId: note.id,
      },
      {
        onSuccess: (newChild) => {
          // Cập nhật parent.linkedNotes
          update.mutate(
            { ...note, linkedNotes: [...linkedIds, newChild.id] },
            {
              onError: () => toast.error('Không cập nhật được parent'),
            },
          );
          toast.success('Đã tạo child note');
        },
        onError: () => toast.error('Không tạo được child note'),
      },
    );
  }

  function handleUnlink(linkedId: string) {
    update.mutate(
      { ...note, linkedNotes: linkedIds.filter((id) => id !== linkedId) },
      {
        onSuccess: () => toast.success('Đã bỏ link'),
        onError: () => toast.error('Không bỏ link được'),
      },
    );
  }

  function handleDeleteChild(childId: string) {
    if (!window.confirm('Xoá child note này? Hành động không hoàn tác.')) return;
    remove.mutate(childId, {
      onSuccess: () => toast.success('Đã xoá child note'),
      onError: () => toast.error('Không xoá được'),
    });
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
          Related Notes ({linkedNotes.length})
        </button>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleQuickCreateChild}
            disabled={createNote.isPending}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Plus className="h-3 w-3" />
            Child Note
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenPicker}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Link2 className="h-3 w-3" />
            Link
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {linkedNotes.length === 0 ? (
            <div className="border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
              Chưa có note liên quan. Bấm + Child Note hoặc Link để thêm.
            </div>
          ) : (
            linkedNotes.map((ln) => (
              <RelatedNoteCard
                key={ln.id}
                linked={ln}
                onOpen={() => onSelectNote?.(ln.id)}
                onUnlink={
                  ln.isChildNote ? undefined : () => handleUnlink(ln.id)
                }
                onDelete={
                  ln.isChildNote ? () => handleDeleteChild(ln.id) : undefined
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function RelatedNoteCard({
  linked,
  onOpen,
  onUnlink,
  onDelete,
}: {
  linked: Note;
  onOpen: () => void;
  onUnlink?: () => void;
  onDelete?: () => void;
}) {
  // Strip HTML cho preview
  const preview = linked.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);

  return (
    <div className="group border border-border bg-card transition-colors hover:border-primary">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <RelatedKindIcon isChild={linked.isChildNote} className="h-3.5 w-3.5 shrink-0" />
        <button
          onClick={onOpen}
          className="min-w-0 flex-1 truncate text-left text-sm text-foreground hover:text-primary"
        >
          {linked.title || 'Untitled'}
        </button>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
          {linked.type}
        </span>
        {linked.isChildNote && (
          <span className="shrink-0 border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary">
            Child
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpen}
          className="h-6 px-2 text-xs"
        >
          Open
        </Button>
        {onUnlink && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onUnlink}
            className="h-6 w-6 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            title="Bỏ link (không xoá note)"
          >
            <Unlink className="h-3 w-3" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-6 w-6 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            title="Xoá child note"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {preview && (
        <div
          onDoubleClick={onOpen}
          className="cursor-pointer p-3 text-xs text-muted-foreground line-clamp-3 hover:bg-popover/30"
          title="Double-click để mở"
        >
          {preview}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EDIT MODE
// ============================================================
function NoteEditMode({
  note,
  allNotes,
  onView,
  onDeleted,
  onSelectNote,
}: {
  note: Note;
  allNotes: Note[];
  onView: () => void;
  onDeleted?: () => void;
  onSelectNote?: (id: string) => void;
}) {
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const createNote = useCreateNote();

  const [title, setTitle] = useState(note.title);
  const [type, setType] = useState<NoteType>(note.type);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags ?? '');
  const [source, setSource] = useState(note.source ?? '');
  const [example, setExample] = useState(note.example ?? '');
  const [url1, setUrl1] = useState(note.url1 ?? '');
  const [url2, setUrl2] = useState(note.url2 ?? '');
  const [url3, setUrl3] = useState(note.url3 ?? '');
  const [url4, setUrl4] = useState(note.url4 ?? '');
  const [url5, setUrl5] = useState(note.url5 ?? '');
  const [timerDuration, setTimerDuration] = useState(note.timerDuration ?? '0');
  const [linkedNotes, setLinkedNotes] = useState<string[]>(note.linkedNotes ?? []);
  const [wordCountEnabled, setWordCountEnabled] = useState(
    note.wordCountEnabled ?? false,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Tiptap editor instance (cho word count đọc selection)
  const [editor, setEditor] = useState<Editor | null>(null);

  // Reset state khi note đổi
  useEffect(() => {
    setTitle(note.title);
    setType(note.type);
    setContent(note.content);
    setTags(note.tags ?? '');
    setSource(note.source ?? '');
    setExample(note.example ?? '');
    setUrl1(note.url1 ?? '');
    setUrl2(note.url2 ?? '');
    setUrl3(note.url3 ?? '');
    setUrl4(note.url4 ?? '');
    setUrl5(note.url5 ?? '');
    setTimerDuration(note.timerDuration ?? '0');
    setLinkedNotes(note.linkedNotes ?? []);
    setWordCountEnabled(note.wordCountEnabled ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Derived isDirty: so sánh state hiện tại với note prop.
  // Sau khi save thành công, React Query refetch → note prop update →
  // useEffect reset state → so sánh khớp → isDirty = false.
  // Nếu user Ctrl+Z về trạng thái ban đầu cũng tự false.
  const isDirty = useMemo(() => {
    return (
      title !== note.title ||
      type !== note.type ||
      content !== note.content ||
      tags !== (note.tags ?? '') ||
      source !== (note.source ?? '') ||
      example !== (note.example ?? '') ||
      url1 !== (note.url1 ?? '') ||
      url2 !== (note.url2 ?? '') ||
      url3 !== (note.url3 ?? '') ||
      url4 !== (note.url4 ?? '') ||
      url5 !== (note.url5 ?? '') ||
      timerDuration !== (note.timerDuration ?? '0') ||
      wordCountEnabled !== (note.wordCountEnabled ?? false) ||
      !arrayEqual(linkedNotes, note.linkedNotes ?? [])
    );
  }, [
    note,
    title,
    type,
    content,
    tags,
    source,
    example,
    url1,
    url2,
    url3,
    url4,
    url5,
    timerDuration,
    linkedNotes,
    wordCountEnabled,
  ]);

  const doSave = useCallback(
    ({ silent = false } = {}) => {
      const updated: Note = {
        ...note,
        title,
        type,
        content,
        tags,
        source,
        example,
        url1,
        url2,
        url3,
        url4,
        url5,
        timerDuration,
        linkedNotes,
        wordCountEnabled,
      };
      update.mutate(updated, {
        onSuccess: () => {
          if (!silent) toast.success('Đã lưu');
        },
        onError: () => {
          if (!silent) toast.error('Không lưu được');
        },
      });
    },
    [
      note,
      title,
      type,
      content,
      tags,
      source,
      example,
      url1,
      url2,
      url3,
      url4,
      url5,
      timerDuration,
      linkedNotes,
      wordCountEnabled,
      update,
    ],
  );

  function handleDelete() {
    if (!window.confirm(`Xoá note "${note.title || 'Untitled'}"?`)) return;
    remove.mutate(note.id, {
      onSuccess: () => {
        toast.success('Đã xoá');
        onDeleted?.();
      },
    });
  }

  function handleQuickCreateChild() {
    const childCount = linkedNotes
      .map((id) => allNotes.find((n) => n.id === id))
      .filter((n): n is Note => !!n && n.isChildNote).length;
    const defaultTitle = `New ${childCount + 1} - ${new Date().toLocaleDateString('vi-VN')}`;
    const t = window.prompt('Tên child note:', defaultTitle);
    if (!t) return;
    createNote.mutate(
      {
        title: t.trim() || defaultTitle,
        content: '',
        type,
        isChildNote: true,
        parentNoteId: note.id,
      },
      {
        onSuccess: (newChild) => {
          const nextLinked = [...linkedNotes, newChild.id];
          setLinkedNotes(nextLinked);
          // Lưu parent ngay để liên kết khỏi mất nếu user đóng tab
          update.mutate({ ...note, linkedNotes: nextLinked });
          toast.success('Đã tạo child note');
        },
        onError: () => toast.error('Không tạo được'),
      },
    );
  }

  function handleSavePicker(ids: string[]) {
    setLinkedNotes(ids);
  }

  function handleUnlink(id: string) {
    setLinkedNotes((prev) => prev.filter((x) => x !== id));
  }

  function handleDeleteChild(childId: string) {
    if (!window.confirm('Xoá child note này? Hành động không hoàn tác.')) return;
    remove.mutate(childId, {
      onSuccess: () => {
        const nextLinked = linkedNotes.filter((x) => x !== childId);
        setLinkedNotes(nextLinked);
        // Sync parent ngay (id child đã không tồn tại, phải gỡ ra khỏi linkedNotes)
        update.mutate({ ...note, linkedNotes: nextLinked });
        toast.success('Đã xoá child note');
      },
      onError: () => toast.error('Không xoá được'),
    });
  }

  // ============================================================
  // Keyboard shortcuts: Ctrl+S = save, Esc = thoát về view mode
  //   - Nếu có thay đổi chưa lưu → confirm trước khi thoát
  // ============================================================
  function tryExitToView() {
    if (isDirty) {
      const ok = window.confirm(
        'Có thay đổi chưa lưu. Thoát mà không lưu?\n\nOK: Bỏ thay đổi và thoát.\nCancel: Ở lại.',
      );
      if (!ok) return;
    }
    onView();
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Bỏ qua khi modal Linked Picker đang mở (Dialog tự xử lý Esc)
      if (pickerOpen) return;

      // Ctrl+S / Cmd+S → save (luôn override behavior browser save page)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isDirty && !update.isPending) doSave();
        return;
      }

      // Esc → thoát edit mode. Nếu đang composition (gõ tiếng Việt) thì kệ.
      if (e.key === 'Escape' && !e.isComposing) {
        // Nếu user đang focus trong <select> đang mở native dropdown → để select tự đóng
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'SELECT') return;
        e.preventDefault();
        tryExitToView();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen, isDirty, update.isPending, doSave, onView]);

  // Cảnh báo khi reload/close tab nếu có thay đổi chưa lưu
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Một số browser cần set returnValue để hiện popup
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const saveStatus = update.isPending ? 'saving' : isDirty ? 'unsaved' : 'saved';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
        <SaveIndicator status={saveStatus} />
        <div className="flex items-center gap-2">
          <RelatedPopover
            linkedIds={linkedNotes}
            allNotes={allNotes}
            onSelectNote={onSelectNote}
            onOpenPicker={() => setPickerOpen(true)}
            onCreateChild={handleQuickCreateChild}
            disabled={createNote.isPending}
          />
          <Button variant="outline" size="sm" onClick={tryExitToView} className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Xem
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => doSave()}
            disabled={!isDirty || update.isPending}
            className="gap-1.5"
            title="Ctrl+S"
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

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề..."
            className="border-0 border-b border-border px-0 text-xl font-semibold focus-visible:ring-0"
          />

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <FieldLabel>Loại</FieldLabel>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NoteType)}
                className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {NOTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <FieldLabel>Tags</FieldLabel>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2..."
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Nguồn</FieldLabel>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Timer (phút)</FieldLabel>
              <select
                value={timerDuration}
                onChange={(e) => setTimerDuration(e.target.value)}
                className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="0">Không set</option>
                <option value="20">20 min (Task 1)</option>
                <option value="40">40 min (Task 2)</option>
                <option value="60">60 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <FieldLabel>Nội dung</FieldLabel>
            <RichEditor
              value={content}
              onChange={setContent}
              onEditorReady={setEditor}
              placeholder="Bắt đầu viết note..."
            />
          </div>

          {/* Example */}
          <div className="space-y-1">
            <FieldLabel>Example</FieldLabel>
            <textarea
              value={example}
              onChange={(e) => setExample(e.target.value)}
              rows={3}
              className="flex w-full border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* URLs */}
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              [url1, setUrl1, 'URL 1'],
              [url2, setUrl2, 'URL 2'],
              [url3, setUrl3, 'URL 3'],
              [url4, setUrl4, 'URL 4'],
              [url5, setUrl5, 'URL 5'],
            ] as const).map(([val, setter, label]) => (
              <div key={label} className="space-y-1">
                <FieldLabel>{label}</FieldLabel>
                <Input
                  type="url"
                  value={val}
                  onChange={(e) => setter(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            ))}
          </div>

          {/* Related Notes */}
          <RelatedNotesEditSection
            linkedNotes={linkedNotes}
            allNotes={allNotes}
            onOpenPicker={() => setPickerOpen(true)}
            onCreateChild={handleQuickCreateChild}
            onUnlink={handleUnlink}
            onDeleteChild={handleDeleteChild}
            onSelectNote={onSelectNote}
            disabled={createNote.isPending}
          />
        </div>
      </div>

      {/* Footer: word count với 3-priority */}
      <WordCountFooter
        editor={editor}
        content={content}
        enabled={wordCountEnabled}
        onToggle={() => setWordCountEnabled((v) => !v)}
      />

      <LinkedNotesPicker
        open={pickerOpen}
        allNotes={allNotes}
        currentNoteId={note.id}
        initialSelected={linkedNotes}
        onClose={() => setPickerOpen(false)}
        onSave={handleSavePicker}
      />
    </div>
  );
}

// ============================================================
// Related Notes section — EDIT MODE
// ============================================================
function RelatedNotesEditSection({
  linkedNotes,
  allNotes,
  onOpenPicker,
  onCreateChild,
  onUnlink,
  onDeleteChild,
  onSelectNote,
  disabled,
}: {
  linkedNotes: string[];
  allNotes: Note[];
  onOpenPicker: () => void;
  onCreateChild: () => void;
  onUnlink: (id: string) => void;
  onDeleteChild: (id: string) => void;
  onSelectNote?: (id: string) => void;
  disabled: boolean;
}) {
  const resolved = linkedNotes
    .map((id) => allNotes.find((n) => n.id === id))
    .filter((n): n is Note => !!n);

  const childNotes = resolved.filter((n) => n.isChildNote);
  const linkOnly = resolved.filter((n) => !n.isChildNote);

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <FieldLabel>
          Related Notes ({resolved.length})
        </FieldLabel>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCreateChild}
            disabled={disabled}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Plus className="h-3 w-3" />
            Child Note
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenPicker}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Link2 className="h-3 w-3" />
            Link Notes
          </Button>
        </div>
      </div>

      {resolved.length === 0 ? (
        <div className="border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
          Chưa có note liên quan. Bấm + Child Note hoặc Link Notes để thêm.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {childNotes.map((n) => (
            <RelatedChip
              key={n.id}
              note={n}
              kind="child"
              onOpen={() => onSelectNote?.(n.id)}
              onRemove={() => onDeleteChild(n.id)}
            />
          ))}
          {linkOnly.map((n) => (
            <RelatedChip
              key={n.id}
              note={n}
              kind="link"
              onOpen={() => onSelectNote?.(n.id)}
              onRemove={() => onUnlink(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RelatedChip({
  note,
  kind,
  onOpen,
  onRemove,
}: {
  note: Note;
  kind: 'child' | 'link';
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 border border-border bg-card px-3 py-2 transition-colors hover:border-primary">
      <RelatedKindIcon isChild={kind === 'child'} className="h-3.5 w-3.5 shrink-0" />
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:text-primary"
      >
        {note.title || 'Untitled'}
      </button>
      <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground">
        {note.type}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        title={kind === 'child' ? 'Xoá child note' : 'Bỏ link'}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ============================================================
// Word Count Footer — 3-priority logic giống app cũ
// ============================================================
//
// Priority:
//   1. Selected text trong editor → đếm
//   2. Text giữa cặp `` markers (vd ``đoạn này``) → đếm
//   3. Toàn bộ text trong editor → đếm
//
// Toggle on/off persist qua field `wordCountEnabled`.
// ============================================================
function WordCountFooter({
  editor,
  content,
  enabled,
  onToggle,
}: {
  editor: Editor | null;
  content: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  // Tick để re-render khi selection đổi (Tiptap fire 'selectionUpdate')
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      tickRef.current += 1;
      setTick(tickRef.current);
    };
    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('selectionUpdate', handler);
    };
  }, [editor]);

  const stats = useMemo(() => {
    return computeWordStats(editor, content);
    // tick là dependency để re-tính khi selection đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content, tick]);

  return (
    <div className="flex items-center justify-between border-t border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
      <button
        onClick={onToggle}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          enabled && 'text-primary',
        )}
        title={
          'Bật/tắt đếm từ. Thứ tự ưu tiên:\n' +
          '1. Đoạn đang chọn (selection)\n' +
          '2. Đoạn giữa cặp `` (vd ``đoạn này``)\n' +
          '3. Toàn bộ note'
        }
      >
        <Type className="h-3 w-3" />
        {enabled ? `Đếm từ (${stats.scope})` : 'Đếm từ'}
      </button>

      {enabled && (
        <div className="flex items-center gap-3 font-mono">
          <span>{stats.wordCount} từ</span>
          <span>{stats.charCount} ký tự</span>
        </div>
      )}
    </div>
  );
}

/**
 * Tính word/char count theo 3 priority:
 *  1. Selection trong editor (nếu có)
 *  2. Text giữa cặp `` markers
 *  3. Toàn bộ text
 */
function computeWordStats(
  editor: Editor | null,
  fallbackHtml: string,
): { wordCount: number; charCount: number; scope: 'selection' | 'markers' | 'all' } {
  let text = '';
  let scope: 'selection' | 'markers' | 'all' = 'all';

  if (editor && !editor.isDestroyed) {
    // Priority 1: selection
    const { from, to, empty } = editor.state.selection;
    if (!empty && to > from) {
      text = editor.state.doc.textBetween(from, to, ' ', ' ');
      scope = 'selection';
    } else {
      // Priority 2: text giữa ``...`` (lấy match đầu tiên)
      const fullText = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ', ' ');
      const match = fullText.match(/``([\s\S]*?)``/);
      if (match && match[1]) {
        text = match[1];
        scope = 'markers';
      } else {
        text = fullText;
        scope = 'all';
      }
    }
  } else {
    // Editor chưa ready — fallback strip HTML
    text = fallbackHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  }

  text = text.trim();
  const charCount = text.length;
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  return { wordCount: words.length, charCount, scope };
}

// ============================================================
// Shared sub-components
// ============================================================
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
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
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Edit className="h-3.5 w-3.5" />
      Đang sửa
    </span>
  );
}
