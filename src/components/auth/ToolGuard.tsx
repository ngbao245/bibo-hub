// ============================================================
// ToolGuard — check user có được phép dùng tool này không
// ============================================================
//
// Wrap route content. Nếu tool không có trong profile.allowed_tools →
// hiện empty state "Không có quyền", không render children.
// Admin luôn pass.
// ============================================================

import { type ReactNode } from 'react';
import { Lock } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';
import { EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function ToolGuard({
  toolId,
  children,
}: {
  toolId: string;
  children: ReactNode;
}) {
  const profile = useAuthStore((s) => s.profile);

  if (!profile) return null; // AuthGuard đã handle

  const isAdmin = profile.role === 'admin';
  const hasWildcard = profile.allowed_tools.includes('*');
  const allowed = isAdmin || hasWildcard || profile.allowed_tools.includes(toolId);

  if (!allowed) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Lock}
          title="Bạn không có quyền dùng tool này"
          description="Liên hệ admin để được cấp quyền."
          action={
            <Button asChild variant="outline">
              <Link to="/">Về Hub</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}