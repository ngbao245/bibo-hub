import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { TOOLS } from '@/lib/tools';
import { useUpdatePermissionMutation, type AdminUserRow } from '@/api/authApi';
import { useRolesQuery } from '@/api/roles';
import type { UserRole } from '@/stores/authStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const ALL_TOOL_IDS = TOOLS.map((t) => t.id);

export default function EditPermissionDialog({
  user,
  open,
  onClose,
}: {
  user: AdminUserRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdatePermissionMutation();
  const rolesQuery = useRolesQuery();
  const [role, setRole] = useState<UserRole>('user');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [customOverride, setCustomOverride] = useState(false);

  const roles = rolesQuery.data ?? [];

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setAllowed(user.allowed_tools);
      // Try to match user's current tools to a role
      const matchingRole = roles.find(
        (r) => r.name === user.role || arraysEqual(r.allowed_tools, user.allowed_tools),
      );
      setSelectedRoleId(matchingRole?.id ?? null);
      setCustomOverride(!matchingRole && user.role !== 'admin');
    }
  }, [user, roles]);

  function handleRoleSelect(roleId: string) {
    const r = roles.find((x) => x.id === roleId);
    if (!r) return;
    setSelectedRoleId(roleId);
    setRole(r.name as UserRole);
    setAllowed(r.allowed_tools);
    setCustomOverride(false);
  }

  function toggleTool(id: string) {
    setAllowed((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
    setCustomOverride(true);
  }

  async function handleSave() {
    if (!user) return;
    try {
      await update.mutateAsync({
        userId: user.id,
        role,
        allowed_tools: allowed,
      });
      toast.success('Đã cập nhật quyền');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update fail');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉnh quyền user</DialogTitle>
        </DialogHeader>

        {user && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              User: <code className="text-foreground">{user.username ?? user.id.slice(0, 8)}</code>
            </div>

            {/* Role selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Role</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setRole('admin'); setSelectedRoleId(null); setAllowed(['*']); setCustomOverride(false); }}
                  className={
                    role === 'admin'
                      ? 'border border-primary bg-primary/15 px-3 py-1.5 text-xs text-primary rounded'
                      : 'border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded'
                  }
                >
                  admin
                </button>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleRoleSelect(r.id)}
                    className={
                      selectedRoleId === r.id && role !== 'admin' && !customOverride
                        ? 'border border-primary bg-primary/15 px-3 py-1.5 text-xs text-primary rounded'
                        : 'border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded'
                    }
                  >
                    {r.name} ({r.allowed_tools.length})
                  </button>
                ))}
              </div>
              {role === 'admin' && (
                <p className="text-[11px] text-muted-foreground">Admin bypass tất cả permission.</p>
              )}
            </div>

            {/* Tools — auto from role or custom override */}
            {role !== 'admin' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">
                    Tools ({allowed.length})
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setCustomOverride(!customOverride)}
                    title={customOverride ? 'Dùng preset role' : 'Chỉnh riêng cho user này'}
                  >
                    <Pencil className={`h-3.5 w-3.5 ${customOverride ? 'text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                </div>
                {!customOverride && selectedRoleId && (
                  <p className="text-[11px] text-muted-foreground">
                    Tools kế thừa từ role. Click bút chì để chỉnh riêng.
                  </p>
                )}
                <div className="max-h-48 overflow-y-auto border border-border rounded p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_TOOL_IDS.map((id) => (
                      <label
                        key={id}
                        className="flex items-center gap-2 text-xs text-foreground"
                      >
                        <Checkbox
                          checked={allowed.includes(id)}
                          onCheckedChange={() => toggleTool(id)}
                          disabled={!customOverride && !!selectedRoleId}
                        />
                        <span>{id}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted1 = [...a].sort();
  const sorted2 = [...b].sort();
  return sorted1.every((v, i) => v === sorted2[i]);
}