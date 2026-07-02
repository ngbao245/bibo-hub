
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  Trash2,
  Settings2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ShieldCheck,
  Folder,
  FolderOpen,
  Tag,
  ChevronRight,
} from 'lucide-react';

import {
  useSettings,
  useCreateSetting,
  useUpdateSetting,
  useDeleteSetting,
} from '@/api/setting';
import {
  CONFIG_KEYS,
  EMPTY_SETTING,
  type Setting,
  type SettingInput,
  type ConfigKey,
} from '@/lib/setting';
import {
  mergedGroups,
  mergedTypes,
  countInGroup,
  countInType,
  addGhostGroup,
  addGhostType,
  removeGhostGroup,
} from '@/lib/settingGroups';
import { SYSTEM_GROUP_NAME } from '@/api/hubFavorites';
import {
  encodeFieldSlots,
  decodeFieldSlots,
  encryptText,
  decryptText,
  isEncrypted,
  SLOT_BUDGET,
  type FieldEntry,
} from '@/lib/cryptoFields';
import { useCryptoStore } from '@/stores/cryptoStore';
import { useModalStore } from '@/stores/modalStore';
import { cn } from '@/lib/cn';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import {
  EmptyState as SharedEmptyState,
  ErrorState as SharedErrorState,
  LoadingState,
} from '@/components/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ToolCategoryManager from '@/components/ToolCategoryManager';
import ShortcutManager from '@/components/ShortcutManager';
import RagTokensManager from '@/components/rag/RagTokensManager';
import RagConfigManager from '@/components/rag/RagConfigManager';

// ============================================================
// Helpers — pack/unpack 10 slot config thành DraftField[]
// ============================================================

interface DraftField {
  rid: string;
  name: string;
  value: string;
  encrypt: boolean;
  isCiphertext: boolean;
}

function newRid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function readFields(setting: Setting): DraftField[] {
  const out: DraftField[] = [];
  for (const key of CONFIG_KEYS) {
    const raw = setting[key];
    if (!raw) continue;
    const entries = decodeFieldSlots(raw, key);
    for (const entry of entries) {
      out.push({
        rid: newRid(),
        name: entry.k,
        value: entry.v,
        encrypt: entry.e === 1,
        isCiphertext: entry.e === 1 && isEncrypted(entry.v),
      });
    }
  }
  return out;
}

/**
 * Pack fields vào config1..config10. Trả về `{ slots, overflow }`:
 *   - slots: object có config1..config10 (slot thừa là chuỗi rỗng).
 *   - overflow: số entry không pack được do vượt 10 slot.
 *
 * Caller cần check overflow trước khi gọi API.
 */
function packFields(fields: DraftField[]): {
  slots: Pick<SettingInput, ConfigKey>;
  overflow: number;
} {
  const entries: FieldEntry[] = fields.map((f) => ({
    k: f.name,
    e: f.encrypt ? 1 : 0,
    v: f.value,
  }));

  const packed = encodeFieldSlots(entries);
  const slots = {} as Record<ConfigKey, string>;
  for (const k of CONFIG_KEYS) slots[k] = '';

  const usable = packed.slice(0, CONFIG_KEYS.length);
  usable.forEach((s, idx) => {
    slots[CONFIG_KEYS[idx]] = s;
  });

  return {
    slots,
    overflow: Math.max(0, packed.length - CONFIG_KEYS.length),
  };
}

/** Số slot cần dùng nếu pack hiện tại — preview cho UI. */
function previewSlotsUsed(fields: DraftField[]): number {
  if (fields.length === 0) return 0;
  const entries: FieldEntry[] = fields.map((f) => ({
    k: f.name,
    e: f.encrypt ? 1 : 0,
    v: f.value,
  }));
  return encodeFieldSlots(entries).length;
}

// ============================================================
// Page entry — 2 cấp: Index (groups) → GroupView (types + records)
//              + special panel: Tool Categories
// ============================================================

export default function SettingPage() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  if (activeGroup === null) {
    return <GroupIndex onPick={setActiveGroup} />;
  }
  return <GroupView group={activeGroup} onBack={() => setActiveGroup(null)} />;
}

// ============================================================
// GroupIndex — list group dạng card kèm số record
// ============================================================

function GroupIndex({
  onPick,
}: {
  onPick: (group: string) => void;
}) {
  const listQuery = useSettings();
  const [tick, setTick] = useState(0); // re-read ghost từ localStorage

  const groups = useMemo(
    () => mergedGroups(listQuery.data ?? []).filter((g) => g !== SYSTEM_GROUP_NAME),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listQuery.data, tick],
  );

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  function handleAddGroup() {
    const name = newName.trim();
    if (!name) {
      toast.error('Tên group không được rỗng');
      return;
    }
    if (groups.includes(name)) {
      toast.error(`Group "${name}" đã tồn tại`);
      return;
    }
    addGhostGroup(name);
    setNewName('');
    setAdding(false);
    setTick((t) => t + 1);
    toast.success(`Đã tạo group "${name}"`);
  }

  async function handleRemoveGhost(group: string) {
    if (countInGroup(listQuery.data ?? [], group) > 0) {
      toast.error('Group còn record, không xoá ghost được');
      return;
    }
    if (!window.confirm(`Delete empty group "${group}"?`)) return;
    removeGhostGroup(group);
    setTick((t) => t + 1);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="border-b border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Settings2 className="h-4 w-4 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Setting</h1>
          <span className="ml-2 text-xs text-muted-foreground">
            {groups.length} group{groups.length === 1 ? '' : 's'}
          </span>

          <div className="ml-auto">
            {adding ? (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddGroup();
                    if (e.key === 'Escape') {
                      setAdding(false);
                      setNewName('');
                    }
                  }}
                  placeholder="group name"
                  className="h-7 w-40 text-xs"
                />
                <Button
                  size="sm"
                  onClick={handleAddGroup}
                  className="h-7 px-2 text-xs"
                >
                  Tạo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setNewName('');
                  }}
                  className="h-7 px-2 text-xs"
                >
                  Huỷ
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setAdding(true)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Plus className="h-3 w-3" />
                Group
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          {listQuery.isLoading ? (
            <LoadingState variant="skeleton" count={6} itemClassName="h-40" />
          ) : listQuery.isError ? (
            <SharedErrorState
              message={(listQuery.error as Error)?.message ?? 'Không tải được dữ liệu'}
              onRetry={() => listQuery.refetch()}
            />
          ) : groups.length === 0 ? (
            <SharedEmptyState
              icon={Folder}
              title="Chưa có group nào"
              description='Bấm "Group" ở toolbar để tạo group đầu tiên.'
            />
          ) : (
            <ul
              className="grid list-none gap-3"
              style={{
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(clamp(160px, 14vw, 220px), 1fr))',
              }}
            >
              {groups.map((g) => {
                const count = countInGroup(listQuery.data ?? [], g);
                return (
                  <li key={g}>
                    <GroupCard
                      name={g}
                      count={count}
                      onClick={() => onPick(g)}
                      onRemove={
                        count === 0 ? () => handleRemoveGhost(g) : undefined
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupCard({
  name,
  count,
  onClick,
  onRemove,
}: {
  name: string;
  count: number;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          'flex h-full w-full flex-col items-start gap-2 border border-border bg-card p-4 text-left transition-colors',
          'hover:border-primary hover:bg-card/80',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
      >
        <div className="flex w-full items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center border border-border bg-background text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
            <Folder className="h-4 w-4" />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {count}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {count === 0 ? 'Chưa có record' : `${count} record`}
          </p>
        </div>
      </button>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Xoá group rỗng"
          className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center text-muted-foreground hover:text-destructive group-hover:flex"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// GroupView — sidebar type filter + danh sách record
// ============================================================

function GroupView({ group, onBack }: { group: string; onBack: () => void }) {
  const listQuery = useSettings();
  const createMut = useCreateSetting();
  const updateMut = useUpdateSetting();
  const deleteMut = useDeleteSetting();

  const [tick, setTick] = useState(0);
  const [activeType, setActiveType] = useState<string | null>(null); // null = "Tất cả"
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Setting | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryDirty, setCategoryDirty] = useState(false);
  const [shortcutManagerOpen, setShortcutManagerOpen] = useState(false);
  const [shortcutDirty, setShortcutDirty] = useState(false);
  const [ragTokensOpen, setRagTokensOpen] = useState(false);
  const [ragTokensDirty, setRagTokensDirty] = useState(false);
  const [ragConfigOpen, setRagConfigOpen] = useState(false);
  const [ragConfigDirty, setRagConfigDirty] = useState(false);

  const inGroup = useMemo(
    () => (listQuery.data ?? []).filter((s) => s.group.trim() === group),
    [listQuery.data, group],
  );

  const types = useMemo(
    () => mergedTypes(listQuery.data ?? [], group),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listQuery.data, group, tick],
  );

  const filtered = useMemo(() => {
    let arr = inGroup;
    if (activeType !== null) {
      arr = arr.filter((s) => s.type.trim() === activeType);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (s) =>
          s.description.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q),
      );
    }
    return arr;
  }, [inGroup, activeType, query]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(setting: Setting) {
    // Record đặc biệt: Category → mở ToolCategoryManager thay vì dialog generic
    if (setting.group.trim() === 'Setting' && setting.type.trim() === 'Category') {
      setCategoryManagerOpen(true);
      return;
    }
    if (setting.group.trim() === 'Setting' && setting.type.trim() === 'Shortcut') {
      setShortcutManagerOpen(true);
      return;
    }
    // RAG records — 2 custom managers
    if (setting.group.trim() === 'RAG' && setting.type.trim() === 'SettingInfor') {
      setRagTokensOpen(true);
      return;
    }
    if (setting.group.trim() === 'RAG' && setting.type.trim() === 'Config') {
      setRagConfigOpen(true);
      return;
    }
    setEditing(setting);
    setDialogOpen(true);
  }

  function handleSubmit(value: SettingInput, editingId: string | null) {
    // Ép group về group hiện tại — record không được rời khỏi GroupView này.
    const fixed: SettingInput = { ...value, group };
    if (editingId) {
      updateMut.mutate({ ...fixed, id: editingId } as Setting, {
        onSuccess: () => {
          toast.success('Đã cập nhật');
          setDialogOpen(false);
        },
        onError: () => toast.error('Lỗi cập nhật'),
      });
    } else {
      createMut.mutate(fixed, {
        onSuccess: () => {
          toast.success('Đã thêm');
          setDialogOpen(false);
        },
        onError: () => toast.error('Lỗi thêm'),
      });
    }
  }

  async function handleDelete(c: Setting) {
    if (!window.confirm(`Delete record? ${c.description || c.id}`)) return;
    deleteMut.mutate(c.id, {
      onSuccess: () => toast.success('Đã xoá'),
      onError: () => toast.error('Lỗi xoá'),
    });
  }

  function handleAddType(name: string) {
    const t = name.trim();
    if (!t) return;
    if (types.includes(t)) {
      toast.error(`Type "${t}" đã tồn tại`);
      return;
    }
    addGhostType(group, t);
    setTick((x) => x + 1);
    setActiveType(t);
    toast.success(`Đã tạo type "${t}"`);
  }

  const isSubmitting = createMut.isPending || updateMut.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <FolderOpen className="h-4 w-4 text-primary" />
            <h1 className="flex min-w-0 items-center text-base font-semibold text-foreground">
              <button
                onClick={onBack}
                className="text-muted-foreground hover:text-foreground"
              >
                Setting
              </button>
              <ChevronRight className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{group}</span>
              {activeType !== null && (
                <>
                  <ChevronRight className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate text-primary">{activeType}</span>
                </>
              )}
            </h1>
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {filtered.length} / {inGroup.length}
            </span>
          </div>

          <Button onClick={openAdd} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Thêm record
          </Button>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-2">
          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm trong group..."
              className="h-7 w-56 pl-7 pr-7 text-xs"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <TypeSidebar
          types={types}
          counts={(t) => countInType(listQuery.data ?? [], group, t)}
          totalInGroup={inGroup.length}
          active={activeType}
          onPick={setActiveType}
          onAdd={handleAddType}
        />

        <div className="flex-1 overflow-y-auto p-4">
          {listQuery.isLoading ? (
            <LoadingState variant="skeleton" count={6} itemClassName="h-40" />
          ) : listQuery.isError ? (
            <SharedErrorState
              message={(listQuery.error as Error)?.message ?? 'Không tải được dữ liệu'}
              onRetry={() => listQuery.refetch()}
            />
          ) : filtered.length === 0 ? (
            <EmptyRecords
              query={query}
              type={activeType}
              onAdd={openAdd}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <SettingCard
                  key={c.id}
                  setting={c}
                  onEdit={() => openEdit(c)}
                  onDelete={() => handleDelete(c)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <SettingDialog
        open={dialogOpen}
        group={group}
        defaultType={activeType ?? ''}
        typeOptions={types}
        setting={editing}
        onClose={() => setDialogOpen(false)}
        onSubmit={(v) => handleSubmit(v, editing?.id ?? null)}
        isSubmitting={isSubmitting}
      />

      {categoryManagerOpen && (
        <Dialog
          open
          onOpenChange={async (o) => {
            if (!o) {
              if (categoryDirty) {
                if (!window.confirm('Discard changes? You have unsaved changes.')) return;
              }
              setCategoryManagerOpen(false);
            }
          }}
        >
          <DialogContent
            className="max-h-[90vh] max-w-3xl overflow-y-auto"
            aria-describedby={undefined}
          >
            <DialogHeader>
              <DialogTitle>Tool Categories</DialogTitle>
            </DialogHeader>
            <ToolCategoryManager
              onClose={() => setCategoryManagerOpen(false)}
              onDirtyChange={setCategoryDirty}
            />
          </DialogContent>
        </Dialog>
      )}

      {shortcutManagerOpen && (
        <Dialog
          open
          onOpenChange={async (o) => {
            if (!o) {
              if (shortcutDirty) {
                if (!window.confirm('Discard changes? You have unsaved changes.')) return;
              }
              setShortcutManagerOpen(false);
            }
          }}
        >
          <DialogContent
            className="max-h-[90vh] max-w-3xl overflow-y-auto"
            aria-describedby={undefined}
          >
            <DialogHeader>
              <DialogTitle>Shortcuts</DialogTitle>
            </DialogHeader>
            <ShortcutManager onDirtyChange={setShortcutDirty} />
          </DialogContent>
        </Dialog>
      )}

      {ragTokensOpen && (
        <Dialog
          open
          onOpenChange={async (o) => {
            if (!o) {
              if (ragTokensDirty) {
                if (!window.confirm('Discard changes? You have unsaved changes.')) return;
              }
              setRagTokensOpen(false);
            }
          }}
        >
          <DialogContent
            className="max-h-[90vh] max-w-2xl overflow-y-auto"
            aria-describedby={undefined}
          >
            <DialogHeader>
              <DialogTitle>RAG API Tokens</DialogTitle>
            </DialogHeader>
            <RagTokensManager onDirtyChange={setRagTokensDirty} />
          </DialogContent>
        </Dialog>
      )}

      {ragConfigOpen && (
        <Dialog
          open
          onOpenChange={async (o) => {
            if (!o) {
              if (ragConfigDirty) {
                if (!window.confirm('Discard changes? You have unsaved changes.')) return;
              }
              setRagConfigOpen(false);
            }
          }}
        >
          <DialogContent
            className="max-h-[90vh] max-w-2xl overflow-y-auto"
            aria-describedby={undefined}
          >
            <DialogHeader>
              <DialogTitle>RAG Configuration</DialogTitle>
            </DialogHeader>
            <RagConfigManager onDirtyChange={setRagConfigDirty} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================
// Type sidebar
// ============================================================
function TypeSidebar({
  types,
  counts,
  totalInGroup,
  active,
  onPick,
  onAdd,
}: {
  types: string[];
  counts: (t: string) => number;
  totalInGroup: number;
  active: string | null;
  onPick: (t: string | null) => void;
  onAdd: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  function commit() {
    if (!name.trim()) {
      setAdding(false);
      return;
    }
    onAdd(name);
    setName('');
    setAdding(false);
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Types
        </span>
        <button
          onClick={() => setAdding(true)}
          className="text-muted-foreground hover:text-foreground"
          title="Thêm type"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="list-none p-1">
        <li>
          <TypeRow
            label="Tất cả"
            count={totalInGroup}
            active={active === null}
            onClick={() => onPick(null)}
          />
        </li>
        {types.map((t) => (
          <li key={t}>
            <TypeRow
              label={t}
              count={counts(t)}
              active={active === t}
              onClick={() => onPick(t)}
            />
          </li>
        ))}
        {adding && (
          <li className="px-1 py-1">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setName('');
                }
              }}
              placeholder="type name"
              className="h-7 text-xs"
            />
          </li>
        )}
      </ul>
    </aside>
  );
}

function TypeRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-foreground hover:bg-popover',
      )}
    >
      <Tag className="h-3 w-3 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {count}
      </span>
    </button>
  );
}

// ============================================================
// SettingCard — render 1 record
// ============================================================
function SettingCard({
  setting,
  onEdit,
  onDelete,
}: {
  setting: Setting;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fields = useMemo(() => readFields(setting), [setting]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      className="group relative flex cursor-pointer flex-col gap-3 border border-border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Xoá record"
        aria-label="Xoá record"
        className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center border border-transparent text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive group-hover:flex"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-background text-sm font-semibold text-muted-foreground">
          {(setting.type.trim().charAt(0) || '#').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {setting.type || (
              <span className="text-muted-foreground">(no type)</span>
            )}
          </h3>
          {setting.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {setting.description}
            </p>
          )}
        </div>
      </div>

      {fields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {fields.map((f) => (
            <span
              key={f.rid}
              className="inline-flex items-center gap-1 border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground"
              title={f.encrypt ? '(encrypted)' : f.value}
            >
              {f.encrypt && <Lock className="h-2.5 w-2.5 text-warning" />}
              {f.name || '(unnamed)'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Dialog (add/edit)
// ============================================================
function SettingDialog({
  open,
  group,
  defaultType,
  typeOptions,
  setting,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  /** Group cố định — record luôn thuộc group này, không cho đổi trong dialog */
  group: string;
  defaultType: string;
  typeOptions: string[];
  setting: Setting | null;
  onClose: () => void;
  onSubmit: (v: SettingInput) => void;
  isSubmitting?: boolean;
}) {
  const passphrase = useCryptoStore((s) => s.passphrase);
  const setPassphrase = useCryptoStore((s) => s.setPassphrase);
  const openModal = useModalStore((s) => s.open);

  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [fields, setFields] = useState<DraftField[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (setting) {
      setDescription(setting.description);
      setType(setting.type);
      setFields(readFields(setting));
    } else {
      setDescription('');
      setType(defaultType);
      setFields([]);
    }
  }, [open, setting, defaultType]);

  function addField() {
    setFields((prev) => [
      ...prev,
      {
        rid: newRid(),
        name: '',
        value: '',
        encrypt: false,
        isCiphertext: false,
      },
    ]);
  }

  function updateField(rid: string, patch: Partial<DraftField>) {
    setFields((prev) =>
      prev.map((f) => (f.rid === rid ? { ...f, ...patch } : f)),
    );
  }

  function removeField(rid: string) {
    setFields((prev) => prev.filter((f) => f.rid !== rid));
  }

  async function decryptInPlace(rid: string) {
    const target = fields.find((f) => f.rid === rid);
    if (!target) return;
    if (!passphrase) {
      toast.error('Cần passphrase để giải mã');
      return;
    }
    try {
      const plain = await decryptText(target.value, passphrase);
      updateField(rid, { value: plain, isCiphertext: false });
      toast.success('Đã giải mã');
    } catch (e) {
      toast.error('Giải mã thất bại', {
        description: String((e as Error).message ?? e),
      });
    }
  }

  async function handleSubmit() {
    if (!group.trim()) {
      toast.error('Group rỗng — không thể lưu record');
      return;
    }
    for (const f of fields) {
      if (!f.name.trim()) {
        toast.error('Có field thiếu tên');
        return;
      }
    }
    const needEncrypt = fields.some((f) => f.encrypt && !f.isCiphertext);
    if (needEncrypt && !passphrase) {
      toast.error('Cần passphrase để mã hoá field. Mở tool Crypto để nhập.');
      return;
    }

    setBusy(true);
    try {
      const processed: DraftField[] = [];
      for (const f of fields) {
        if (f.encrypt && !f.isCiphertext && f.value) {
          const ct = await encryptText(f.value, passphrase);
          processed.push({ ...f, value: ct, isCiphertext: true });
        } else if (!f.encrypt && f.isCiphertext) {
          toast.error(
            `Field "${f.name}" đã tắt encrypt nhưng value vẫn là ciphertext. Bấm nút Giải mã trước.`,
          );
          setBusy(false);
          return;
        } else {
          processed.push(f);
        }
      }

      const { slots, overflow } = packFields(processed);
      if (overflow > 0) {
        toast.error(
          `Vượt giới hạn schema: cần thêm ${overflow} slot. Hãy bớt field hoặc rút ngắn value.`,
        );
        setBusy(false);
        return;
      }

      const payload: SettingInput = {
        ...EMPTY_SETTING,
        name: '',
        description: description.trim(),
        group: group.trim(),
        type: type.trim(),
        ...slots,
      };
      onSubmit(payload);
    } catch (e) {
      toast.error('Lỗi mã hoá', {
        description: String((e as Error).message ?? e),
      });
    } finally {
      setBusy(false);
    }
  }

  const hasSensitive = fields.some((f) => f.encrypt);
  const passphraseMissing = hasSensitive && !passphrase.trim();
  const slotsUsed = useMemo(() => previewSlotsUsed(fields), [fields]);
  const slotsOver = slotsUsed > CONFIG_KEYS.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {setting ? 'Sửa record' : 'Thêm record'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <Field label="Group">
              <div className="flex h-9 items-center gap-1.5 border border-border bg-background px-3 text-sm text-muted-foreground">
                <Folder className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">{group}</span>
              </div>
            </Field>
            <Field label="Type">
              <ComboInput
                value={type}
                onChange={setType}
                options={typeOptions}
                placeholder="VD: production"
              />
            </Field>
          </div>

          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn"
            />
          </Field>

          {hasSensitive && (
            <PassphraseRow
              value={passphrase}
              onChange={setPassphrase}
              onOpenCrypto={() => openModal('crypto')}
              error={passphraseMissing}
            />
          )}

          <div className="border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Custom fields
                <span className="ml-2 font-mono normal-case text-[10px]">
                  {fields.length} field{fields.length === 1 ? '' : 's'}
                </span>
              </h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addField}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Plus className="h-3 w-3" />
                Thêm field
              </Button>
            </div>

            {slotsOver && (
              <p className="mb-2 border border-destructive/50 bg-destructive/10 p-2 text-[11px] text-destructive">
                Tổng dung lượng vượt {CONFIG_KEYS.length} slot ({SLOT_BUDGET} ký
                tự/slot). Bớt field hoặc rút ngắn value để có thể lưu.
              </p>
            )}

            {fields.length === 0 && (
              <SharedEmptyState
                compact
                title="Chưa có field nào"
                description='Bấm "Thêm field" để bắt đầu.'
              />
            )}

            <div className="space-y-2">
              {fields.map((f) => (
                <FieldRow
                  key={f.rid}
                  field={f}
                  onChange={(patch) => updateField(f.rid, patch)}
                  onRemove={() => removeField(f.rid)}
                  onDecrypt={() => decryptInPlace(f.rid)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting || busy}
          >
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              busy ||
              !group.trim() ||
              slotsOver ||
              passphraseMissing
            }
          >
            {busy
              ? 'Đang mã hoá...'
              : isSubmitting
                ? 'Đang lưu...'
                : setting
                  ? 'Cập nhật'
                  : 'Thêm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// ComboInput — input free-text + datalist từ options
// ============================================================
function ComboInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const listId = useMemo(() => 'combo-' + Math.random().toString(36).slice(2, 8), []);
  return (
    <>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

// ============================================================
// Passphrase row inline trong dialog
// ============================================================
function PassphraseRow({
  value,
  onChange,
  onOpenCrypto,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onOpenCrypto: () => void;
  error?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      className={cn(
        'space-y-1 border bg-card p-2 transition-colors',
        error ? 'border-destructive/60' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          Passphrase (cho field encrypt)
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            title={show ? 'Ẩn' : 'Hiện'}
          >
            {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={onOpenCrypto}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Mở Crypto
          </button>
        </div>
      </div>
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Giữ trong session, mất khi đóng tab"
        autoComplete="off"
        className={cn(
          'font-mono text-xs',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
      />
      {error && (
        <p className="text-[11px] text-destructive">
          Cần nhập passphrase vì có field bật mã hoá.
        </p>
      )}
    </div>
  );
}

// ============================================================
// FieldRow — 1 row field trong dialog
// ============================================================
//
// Logic nút Lock đa năng (gộp Eye + Decrypt + Toggle):
//   - plain, e=0       → icon Unlock xám, click bật e=1
//   - plain, e=1       → icon Lock vàng, click tắt e=0
//   - ciphertext, e=1  → icon Lock vàng pulse, click decrypt in-place
//                        (sau decrypt: plain e=1, click lần nữa = tắt e=0)
// ============================================================
function FieldRow({
  field,
  onChange,
  onRemove,
  onDecrypt,
}: {
  field: DraftField;
  onChange: (patch: Partial<DraftField>) => void;
  onRemove: () => void;
  onDecrypt: () => void;
}) {
  const isCipher = field.isCiphertext;

  function handleLockClick() {
    if (isCipher) {
      // ciphertext → decrypt để xem giá trị
      onDecrypt();
      return;
    }
    // plaintext → toggle cờ encrypt
    onChange({ encrypt: !field.encrypt });
  }

  let lockTitle: string;
  let lockClass: string;
  let LockIcon = Unlock;
  if (isCipher) {
    lockTitle = 'Bấm để giải mã';
    lockClass =
      'border-warning/60 bg-warning/10 text-warning hover:bg-warning/20 animate-pulse';
    LockIcon = Lock;
  } else if (field.encrypt) {
    lockTitle = 'Tắt mã hoá';
    lockClass =
      'border-warning/60 bg-warning/10 text-warning hover:bg-warning/20';
    LockIcon = Lock;
  } else {
    lockTitle = 'Bật mã hoá';
    lockClass =
      'border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground';
    LockIcon = Unlock;
  }

  return (
    <div className="grid gap-2 border border-border bg-background p-2 sm:grid-cols-[1fr_2fr_auto]">
      <Input
        value={field.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="field name"
        className="h-8 text-xs"
      />

      <Input
        value={field.value}
        onChange={(e) =>
          onChange({ value: e.target.value, isCiphertext: false })
        }
        placeholder={isCipher ? '(ciphertext — bấm khoá để xem)' : 'value'}
        type={isCipher ? 'password' : 'text'}
        readOnly={isCipher}
        className={cn(
          'h-8 font-mono text-xs',
          isCipher && 'text-warning',
        )}
      />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleLockClick}
          title={lockTitle}
          aria-pressed={field.encrypt}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center border transition-colors',
            lockClass,
          )}
        >
          <LockIcon className="h-3 w-3" />
        </button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="h-8 w-8 px-0 text-destructive hover:text-destructive"
          title="Xoá field"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Common
// ============================================================
function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function EmptyRecords({
  query,
  type,
  onAdd,
}: {
  query: string;
  type: string | null;
  onAdd: () => void;
}) {
  let msg: string;
  if (query) msg = `Không có record nào khớp "${query}"`;
  else if (type !== null)
    msg = type
      ? `Chưa có record nào trong type "${type}"`
      : 'Chưa có record nào không gán type';
  else msg = 'Chưa có record nào trong group này';

  return (
    <SharedEmptyState
      icon={Search}
      title={msg}
      action={
        !query && (
          <Button onClick={onAdd} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Thêm record đầu tiên
          </Button>
        )
      }
    />
  );
}