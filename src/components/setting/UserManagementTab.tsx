import { useState } from 'react';
import { Plus, Trash2, Users, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import {
  useUsersQuery,
  useDeleteUserMutation,
  type AdminUserRow,
} from '@/api/authApi';
import { useAuthStore } from '@/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ErrorState, EmptyState } from '@/components/shared';

import CreateUserDialog from './CreateUserDialog';
import EditPermissionDialog from './EditPermissionDialog';

export default function UserManagementTab() {
  const currentUserId = useAuthStore((s) => s.session?.user.id);
  const usersQuery = useUsersQuery();
  const deleteMut = useDeleteUserMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);

  async function handleDelete(user: AdminUserRow) {
    if (user.id === currentUserId) {
      toast.error('Không thể xoá chính mình');
      return;
    }
    if (!confirm(`Xoá user ${user.id}? Không hoàn tác.`)) return;
    try {
      await deleteMut.mutateAsync(user.id);
      toast.success('Đã xoá user');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete fail');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">User Management</h3>
          <p className="text-xs text-muted-foreground">
            Quản lý app user + permission per-tool. Admin only.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Tạo user
        </Button>
      </div>

      {usersQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {usersQuery.isError && (
        <ErrorState
          message={
            usersQuery.error instanceof Error
              ? usersQuery.error.message
              : 'Load users fail'
          }
          onRetry={() => usersQuery.refetch()}
        />
      )}

      {usersQuery.data && usersQuery.data.length === 0 && (
        <EmptyState
          icon={Users}
          title="Chưa có user nào ngoài admin"
          description="Tạo user đầu tiên để chia sẻ app."
          action={
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Tạo user đầu tiên
            </Button>
          }
        />
      )}

      {usersQuery.data && usersQuery.data.length > 0 && (
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Role</th>
                <th className="px-3 py-2 text-left font-medium">Username</th>
                <th className="px-3 py-2 text-left font-medium">Allowed tools</th>
                <th className="px-3 py-2 text-left font-medium">Last login</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {user.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 bg-primary/15 px-2 py-0.5 text-xs text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        admin
                      </span>
                    ) : (
                      <span className="bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {user.username ?? `${user.id.slice(0, 8)}...`}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-[10px] text-primary">(bạn)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {user.role === 'admin'
                      ? 'Tất cả'
                      : user.allowed_tools.length === 0
                        ? '—'
                        : `${user.allowed_tools.length} tools`}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString()
                      : 'Chưa login'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditUser(user)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user)}
                        disabled={user.id === currentUserId || deleteMut.isPending}
                        title={
                          user.id === currentUserId ? 'Không xoá được chính mình' : 'Xoá'
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditPermissionDialog
        user={editUser}
        open={editUser !== null}
        onClose={() => setEditUser(null)}
      />
    </div>
  );
}