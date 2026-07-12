// ============================================================
// AuthGuard — wrap route để gate app entry
// ============================================================
//
// Boot flow:
//   1. Gọi authClient.auth.getSession() lấy session persist localStorage
//   2. Subscribe onAuthStateChange để bắt SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED
//   3. Fetch profile qua useProfileQuery
//   4. Nếu chưa auth → redirect /login (giữ URL cũ trong ?next=)
//   5. Nếu auth + profile OK → render children
// ============================================================

import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import { useAuthStore, type Profile } from '@/stores/authStore';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared';
import { Lock } from 'lucide-react';

/**
 * LocalStorage keys chứa data per-user cần xoá khi user đổi/logout.
 * Books snapshot shared cross-user nhưng vẫn clear cho consistency
 * (tránh flash sách của session cũ 1 nhịp khi user mới login).
 */
const PER_USER_LOCALSTORAGE_KEYS = ['reader_books_snapshot'];

function clearPerUserCache() {
  for (const k of PER_USER_LOCALSTORAGE_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      // quota / SecurityError — skip
    }
  }
}

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await authClient
    .from('profiles')
    .select('id, role, allowed_tools, created_at, username, avatar_url')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to load profile');
  }
  if (!data) {
    throw new Error('Profile row không tồn tại cho user này');
  }

  return data as Profile;
}

export default function AuthGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const initializing = useAuthStore((s) => s.initializing);
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  // Track user id gần nhất để detect user switch (logout A → login B).
  // Không dùng session.user.id trong closure vì onAuthStateChange chỉ set
  // 1 lần, ref giữ giá trị mới nhất giữa các event.
  const lastUserIdRef = useRef<string | null>(null);

  // Boot: load session từ localStorage (Supabase SDK)
  useEffect(() => {
    let mounted = true;

    authClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      lastUserIdRef.current = data.session?.user.id ?? null;
      setInitializing(false);
    });

    const { data: sub } = authClient.auth.onAuthStateChange((event, newSession) => {
      const prevUserId = lastUserIdRef.current;
      const nextUserId = newSession?.user.id ?? null;
      setSession(newSession);

      // SIGNED_OUT hoặc user đổi (A → B) → clear per-user cache để tránh
      // leak progress/highlights/stats của user cũ sang user mới. TanStack
      // Query có staleTime cao, không tự clear khi profile null.
      const userChanged = prevUserId !== nextUserId;
      if (event === 'SIGNED_OUT' || (userChanged && prevUserId !== null)) {
        setProfile(null);
        qc.clear();
        clearPerUserCache();
      } else if (!newSession) {
        // Fallback: newSession null nhưng không phải SIGNED_OUT event
        // (VD token expire) — vẫn phải reset profile.
        setProfile(null);
      }

      lastUserIdRef.current = nextUserId;
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc, setSession, setProfile, setInitializing]);

  // Fetch profile sau khi có session
  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: () => fetchProfile(session!.user.id),
    enabled: Boolean(session?.user.id),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (profileQuery.data) setProfile(profileQuery.data);
  }, [profileQuery.data, setProfile]);

  // Đang load initial session
  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState label="Đang khôi phục phiên..." />
      </div>
    );
  }

  // Chưa có session → redirect login
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Có session, đang fetch profile
  if (profileQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState label="Đang tải profile..." />
      </div>
    );
  }

  // Profile fetch fail
  if (profileQuery.isError) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <ErrorState
          message={
            profileQuery.error instanceof Error
              ? profileQuery.error.message
              : 'Không load được profile'
          }
          onRetry={() => profileQuery.refetch()}
        />
      </div>
    );
  }

  // Profile empty (data corruption: session OK nhưng không có row profiles)
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <EmptyState
          icon={Lock}
          title="Tài khoản chưa được cấp quyền"
          description="Liên hệ admin để kích hoạt tài khoản."
          action={
            <button
              className="text-sm text-primary underline"
              onClick={() => authClient.auth.signOut()}
            >
              Đăng xuất
            </button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}