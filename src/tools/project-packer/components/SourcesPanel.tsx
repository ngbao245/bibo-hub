// ============================================================
// Sources Panel ΓÇö embedded as tab in Project Packer
// ============================================================

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Menu } from 'lucide-react';

import { useSources, useCreateSource } from '@/tools/project-packer/api';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

import SourceList from './SourceList';
import SourceEditor from './SourceEditor';

export default function SourcesPanel() {
  const sourcesQuery = useSources();
  const createSource = useCreateSource();

  const sources = sourcesQuery.data ?? [];

  const [selectedId, setSelectedId] = useLocalStorage<string | null>(
    'sources_selectedId',
    null,
  );
  const [listOpenMobile, setListOpenMobile] = useState(false);

  // Deep-link: /project-packer?noteId=X (from RAG)
  const [searchParams, setSearchParams] = useSearchParams();
  const noteIdParam = searchParams.get('noteId');
  useEffect(() => {
    if (!noteIdParam) return;
    if (!sourcesQuery.data) return;
    const exists = sources.some((s) => s.id === noteIdParam);
    if (exists) setSelectedId(noteIdParam);
    const next = new URLSearchParams(searchParams);
    next.delete('noteId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdParam, sourcesQuery.data]);

  // Auto-select source mß╗¢i nhß║Ñt
  useEffect(() => {
    if (!sourcesQuery.data) return;
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
  }, [sourcesQuery.data, sources, selectedId, setSelectedId]);

  const selectedNote = sources.find((s) => s.id === selectedId) ?? null;

  function handleNew() {
    createSource.mutate(
      { title: 'Source mß╗¢i', content: '', source: '' },
      {
        onSuccess: (newNote) => {
          setSelectedId(newNote.id);
          toast.success('─É├ú tß║ío source mß╗¢i');
        },
        onError: () => toast.error('Kh├┤ng tß║ío ─æ╞░ß╗úc source'),
      },
    );
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setListOpenMobile(false);
  }

  async function handleDeleteAll() {
    if (sources.length === 0) return;
    const confirmMsg = `X├ôA Hß║╛T ${sources.length} SOURCE?\n\nKh├┤ng thß╗â ho├án t├íc!\n\nOK ─æß╗â x├íc nhß║¡n.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const { fetchJson } = await import('@/api/client');
      const { API } = await import('@/lib/config');

      let deleted = 0;
      for (const source of sources) {
        try {
          await fetchJson(`${API.NOTES}/${source.id}`, { method: 'DELETE' });
          deleted++;
        } catch { /* continue */ }
      }

      toast.success(`─É├ú x├│a ${deleted}/${sources.length} sources`);
      setSelectedId(null);
      sourcesQuery.refetch();
    } catch {
      toast.error('Kh├┤ng x├│a ─æ╞░ß╗úc');
    }
  }

  return (
    <div className="flex h-[70vh] border border-border">
      {/* Source list */}
      <aside
        className={cn(
          'flex w-[260px] shrink-0 flex-col border-r border-border bg-card',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[1000] max-md:transition-transform',
          listOpenMobile ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        <SourceList
          sources={sources}
          isLoading={sourcesQuery.isLoading}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
          onDeleteAll={handleDeleteAll}
        />
      </aside>

      {listOpenMobile && (
        <div
          className="fixed inset-0 z-[999] bg-black/50 md:hidden"
          onClick={() => setListOpenMobile(false)}
        />
      )}

      {/* Editor */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Mobile hamburger */}
        <header className="hidden items-center gap-2 border-b border-border bg-card px-3 py-2 max-md:flex">
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
        </header>

        {selectedNote ? (
          <SourceEditor
            key={selectedNote.id}
            note={selectedNote}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                Chß╗ìn source hoß║╖c tß║ío mß╗¢i
              </p>
              <Button onClick={handleNew} size="sm">+ Tß║ío source</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}