import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { TOOLS } from '@/lib/tools';
import { useUpdatePermissionMutation, type AdminUserRow } from '@/api/authApi';
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
  const [role, setRole] = useState<UserRole>('user');
  const [allowed, setAllowed] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setAllowed(user.allowed_tools);
    }
  }, [user]);

  function toggleTool(id: string) {
    setAllowed((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
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
              User ID: <code>{user.id}</code>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Role</label>
              <div className="flex gap-2">
                {(['user', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={
                      role === r
                        ? 'border border-primary bg-primary/15 px-3 py-1 text-xs text-primary'
                        : 'border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted'
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                Tool được dùng {role === 'admin' && '(admin bypass, luôn được dùng tất cả)'}
              </label>
              <div className="max-h-64 overflow-y-auto border border-border p-2">
                <div className="grid grid-cols-2 gap-2">
                  {ALL_TOOL_IDS.map((id) => (
                    <label
                      key={id}
                      className="flex items-center gap-2 text-xs text-foreground"
                    >
                      <Checkbox
                        checked={allowed.includes(id)}
                        onCheckedChange={() => toggleTool(id)}
                        disabled={role === 'admin'}
                      />
                      <span>{id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
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