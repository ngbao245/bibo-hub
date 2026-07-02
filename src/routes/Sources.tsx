import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Menu, ArrowLeft } from 'lucide-react';

import { useNotes, useCreateNote } from '@/api/notes';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

import SourceList from '@/components/sources/SourceList';
import SourceEditor from '@/components/sources/SourceEditor';

// ============================================================
// Sources Page - layout 2 cột (list + editor)
// ============================================================

export default function Sources() {
  const notesQuery = useNotes();
  const createNote = useCreateNote();

  const sources = useMemo(
    () => (notesQuery.data ?? []).filter((n) => n.type === 'source'),
    [notesQuery.data],
  );

  const [selectedId, setSelectedId] = useLocalStorage<string | null>(
    'sources_selectedId',
    null,
  );
  const [listOpenMobile, setListOpenMobile] = useState(false);

  // Deep-link từ RAG: /sources?noteId=X → setSelectedId(X). Ưu tiên hơn
  // auto-select source mới nhất. Strip param sau khi consume.
  const [searchParams, setSearchParams] = useSearchParams();
  const noteIdParam = searchParams.get('noteId');
  useEffect(() => {
    if (!noteIdParam) return;
    if (!notesQuery.data) return;
    const exists = sources.some((s) => s.id === noteIdParam);
    if (exists) setSelectedId(noteIdParam);
    const next = new URLSearchParams(searchParams);
    next.delete('noteId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdParam, notesQuery.data]);

  // Auto-select source mới nhất khi vào trang
  useEffect(() => {
    if (!notesQuery.data) return;
    if (selectedId) {
      const exists = sources.some((s) => s.id === selectedId);
      if (!exists) setSelectedId(null);
      return;
    }
    if (sources.length > 0) {
      const sorted = [...sources].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      setSelectedId(sorted[0].id);
    }
  }, [notesQuery.data, sources, selectedId, setSelectedId]);

  const selectedNote = sources.find((s) => s.id === selectedId) ?? null;

  function handleNew() {
    createNote.mutate(
      { title: 'Source mới', type: 'source', content: '', source: '' },
      {
        onSuccess: (newNote) => {
          setSelectedId(newNote.id);
          toast.success('Đã tạo source mới');
        },
        onError: () => toast.error('Không tạo được source'),
      },
    );
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setListOpenMobile(false);
  }

  return (
    <div className="flex h-full">
      {/* Source list panel */}
      <aside
        className={cn(
          'flex w-[280px] shrink-0 flex-col border-r border-border bg-card',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[1000] max-md:transition-transform',
          listOpenMobile ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        <SourceList
          sources={sources}
          isLoading={notesQuery.isLoading}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </aside>

      {listOpenMobile && (
        <div
          className="fixed inset-0 z-[999] bg-black/50 md:hidden"
          onClick={() => setListOpenMobile(false)}
        />
      )}

      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="hidden items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 max-md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setListOpenMobile((v) => !v)}
            className="h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h2 className="truncate text-sm font-medium">
            {selectedNote?.title || 'Sources'}
          </h2>
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </header>

        {/* Desktop top corner */}
        <div className="absolute right-4 top-3 z-10 max-md:hidden">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Hub
            </Link>
          </Button>
        </div>

        {selectedNote ? (
          <SourceEditor
            key={selectedNote.id}
            note={selectedNote}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="mb-4 text-muted-foreground">
                Chọn một source hoặc tạo source mới
              </p>
              <Button onClick={handleNew} className="gap-1.5">
                <span>+</span>
                Tạo source mới
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}