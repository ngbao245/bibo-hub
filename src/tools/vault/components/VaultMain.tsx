import { useState, useMemo } from 'react';
import { Lock, Plus, Search, FileText, User, CreditCard, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState, EmptyState, ErrorState } from '@/components/shared';
import { cn } from '@/lib/cn';

import { useVaultEntries } from '../api';
import { useVaultStore } from '../store';
import type { VaultEntry, VaultTemplate, VaultEntryRow } from '../types';
import { decrypt, base64ToBytes } from '../lib/crypto';
import { TEMPLATES } from '../lib/templates';
import EntryForm from './EntryForm';

const TEMPLATE_ICONS: Record<VaultTemplate, typeof FileText> = {
  secret_note: FileText,
  account: User,
  card: CreditCard,
  custom: Settings2,
};

export default function VaultMain() {
  const entriesQuery = useVaultEntries();
  const masterKey = useVaultStore((s) => s.masterKey);
  const lockVault = useVaultStore((s) => s.lock);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState<VaultTemplate | null>(null);
  const [search, setSearch] = useState('');
  const [decryptedEntries, setDecryptedEntries] = useState<VaultEntry[]>([]);
  const [decrypting, setDecrypting] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);

  // Decrypt titles when entries load
  useMemo(() => {
    if (!entriesQuery.data || !masterKey) {
      setDecryptedEntries([]);
      return;
    }
    let cancelled = false;
    setDecrypting(true);

    async function decryptAll(rows: VaultEntryRow[], key: CryptoKey) {
      const results: VaultEntry[] = [];
      for (const row of rows) {
        try {
          const title = await decrypt(key, base64ToBytes(row.encrypted_title), base64ToBytes(row.iv_title));
          results.push({
            id: row.id,
            templateType: row.template_type,
            title,
            fields: [], // fields decrypted on-demand when selected
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        } catch {
          results.push({
            id: row.id,
            templateType: row.template_type,
            title: '[Decrypt failed]',
            fields: [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        }
      }
      if (!cancelled) {
        setDecryptedEntries(results);
        setDecrypting(false);
      }
    }

    decryptAll(entriesQuery.data, masterKey);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesQuery.data, masterKey]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return decryptedEntries;
    const q = search.toLowerCase();
    return decryptedEntries.filter((e) => e.title.toLowerCase().includes(q));
  }, [decryptedEntries, search]);

  const selectedEntry = decryptedEntries.find((e) => e.id === selectedId) ?? null;

  function handleSelectEntry(id: string) {
    setNewTemplate(null);
    setSelectedId(id);
  }

  function handleNewEntry(type: VaultTemplate) {
    setSelectedId(null);
    setNewTemplate(type);
  }

  function handleSaved() {
    setSelectedId(null);
    setNewTemplate(null);
  }

  if (entriesQuery.isLoading || decrypting) {
    return (
      <div className="flex h-full">
        <div className="w-72 border-r border-border p-3">
          <LoadingState variant="skeleton" count={6} layout="list" itemClassName="h-10" />
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  if (entriesQuery.isError) {
    return <ErrorState message="Failed to load vault entries" onRetry={() => entriesQuery.refetch()} />;
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-72 flex-col border-r border-border">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => setShowNewMenu((v) => !v)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {showNewMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] border border-border bg-popover p-1 shadow-md">
                {TEMPLATES.map((t) => {
                  const Icon = TEMPLATE_ICONS[t.type];
                  return (
                    <button
                      key={t.type}
                      onClick={() => { handleNewEntry(t.type); setShowNewMenu(false); }}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <EmptyState compact icon={Lock} title="No entries" />
          ) : (
            <ul>
              {filteredEntries.map((entry) => {
                const Icon = TEMPLATE_ICONS[entry.templateType];
                return (
                  <li key={entry.id}>
                    <button
                      onClick={() => handleSelectEntry(entry.id)}
                      className={cn(
                        'flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors',
                        selectedId === entry.id ? 'bg-popover' : 'hover:bg-popover/50',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{entry.title || 'Untitled'}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {new Date(entry.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Lock button */}
        <div className="border-t border-border p-2">
          <Button variant="outline" size="sm" onClick={lockVault} className="w-full gap-1.5 text-xs">
            <Lock className="h-3.5 w-3.5" /> Lock Vault
          </Button>
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-hidden">
        {newTemplate ? (
          <EntryForm
            key={`new-${newTemplate}`}
            entry={null}
            templateType={newTemplate}
            onSaved={handleSaved}
            onCancel={() => setNewTemplate(null)}
          />
        ) : selectedEntry ? (
          <EntryDetailLoader entry={selectedEntry} onSaved={handleSaved} onCancel={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select an entry or create a new one
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Loads full decrypted fields for a selected entry before rendering EntryForm.
 */
function EntryDetailLoader({ entry, onSaved, onCancel }: { entry: VaultEntry; onSaved: () => void; onCancel: () => void }) {
  const masterKey = useVaultStore((s) => s.masterKey);
  const entriesQuery = useVaultEntries();
  const [loaded, setLoaded] = useState<VaultEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useMemo(() => {
    if (!masterKey || !entriesQuery.data) return;
    const row = entriesQuery.data.find((r) => r.id === entry.id);
    if (!row) return;

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const fieldsJson = await decrypt(masterKey!, base64ToBytes(row!.encrypted_data), base64ToBytes(row!.iv_data));
        const fields = JSON.parse(fieldsJson);
        if (!cancelled) {
          setLoaded({ ...entry, fields });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoaded({ ...entry, fields: [{ key: 'error', value: 'Decrypt failed', sensitive: false }] });
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, masterKey, entriesQuery.data]);

  if (loading || !loaded) {
    return (
      <div className="p-4">
        <LoadingState variant="skeleton" count={4} layout="list" itemClassName="h-10" />
      </div>
    );
  }

  return <EntryForm key={loaded.id} entry={loaded} onSaved={onSaved} onCancel={onCancel} />;
}