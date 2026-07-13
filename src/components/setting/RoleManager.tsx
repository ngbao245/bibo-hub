// ============================================================
// RoleManager — CRUD role templates + assign allowed_tools per role
// ============================================================

import { useState } from 'react';
import { Plus, Save, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { TOOLS } from '@/lib/tools';
import { useRolesQuery, useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation, type Role } from '@/api/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';

const ALL_TOOL_IDS = TOOLS.map((t) => t.id);

export default function RoleManager() {
  const query = useRolesQuery();
  const createMut = useCreateRoleMutation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  async function handleCreate() {
    if (!newName.trim()) return;
    if (newName.trim().toLowerCase() === 'admin') {
      toast.error('"admin" là role đặc biệt, không cần tạo');
      return;
    }
    try {
      await createMut.mutateAsync({ name: newName.trim(), allowed_tools: [] });
      toast.success(`Tạo role "${newName.trim()}"`);
      setNewName('');
      setShowCreate(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tạo fail');
    }
  }

  if (query.isLoading) {
    return <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-20 w-full" />;
  }
  if (query.isError) {
    return <ErrorState message="Load roles fail" onRetry={() => query.refetch()} />;
  }

  const roles = query.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo role template với preset tools. Assign user vào role thay vì tick từng tool.
        </p>
      </div>

      {/* Role note: admin */}
      <div className="rounded border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-primary">admin</span> — role đặc biệt, bypass tất cả permission. Không cần config.
      </div>

      {/* Roles list */}
      {roles.length === 0 && !showCreate && (
        <EmptyState
          icon={Shield}
          title="Chưa có role nào"
          description="Tạo role đầu tiên (VD: editor, viewer, pdf-user)."
          action={
            <Button onClick={() => setShowCreate(true)} className="gap-1">
              <Plus className="h-4 w-4" />
              Tạo Role
            </Button>
          }
        />
      )}

      {roles.map((role) => (
        <RoleCard key={role.id} role={role} />
      ))}

      {/* Create form */}
      {showCreate && (
        <div className="rounded border border-border bg-muted/10 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Tạo role mới</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên role (VD: editor, viewer)"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? 'Đang tạo...' : 'Tạo'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Huỷ
            </Button>
          </div>
        </div>
      )}

      {roles.length > 0 && !showCreate && (
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Thêm role
        </Button>
      )}
    </div>
  );
}

function RoleCard({ role }: { role: Role }) {
  const updateMut = useUpdateRoleMutation();
  const deleteMut = useDeleteRoleMutation();
  const [expanded, setExpanded] = useState(false);
  const [tools, setTools] = useState<string[]>(role.allowed_tools);
  const [dirty, setDirty] = useState(false);

  function toggleTool(id: string) {
    setTools((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    setDirty(true);
  }

  function selectAll() {
    setTools([...ALL_TOOL_IDS]);
    setDirty(true);
  }

  function clearAll() {
    setTools([]);
    setDirty(true);
  }

  async function handleSave() {
    try {
      await updateMut.mutateAsync({ id: role.id, allowed_tools: tools });
      toast.success(`Đã lưu role "${role.name}"`);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save fail');
    }
  }

  async function handleDelete() {
    if (!confirm(`Xoá role "${role.name}"? User đang dùng role này sẽ mất permission.`)) return;
    try {
      await deleteMut.mutateAsync(role.id);
      toast.success(`Đã xoá role "${role.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xoá fail');
    }
  }

  return (
    <div className="rounded border border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-left"
        >
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{role.name}</span>
          <span className="text-xs text-muted-foreground">
            ({role.allowed_tools.length} tools)
          </span>
        </button>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={updateMut.isPending} className="gap-1">
              <Save className="h-3 w-3" />
              Lưu
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-destructive" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tool checkboxes */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={selectAll}>
              Chọn tất cả
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={clearAll}>
              Bỏ chọn tất cả
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ALL_TOOL_IDS.map((id) => (
              <label key={id} className="flex items-center gap-2 text-xs text-foreground">
                <Checkbox
                  checked={tools.includes(id)}
                  onCheckedChange={() => toggleTool(id)}
                />
                <span>{id}</span>
              </label>
            ))}
          </div>
          {dirty && <p className="text-xs text-warning">Có thay đổi chưa lưu</p>}
        </div>
      )}
    </div>
  );
}