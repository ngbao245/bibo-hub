import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/reader/auth';
// import { initSupabaseConfig } from '@/lib/reader/supabase';
import ReaderSkeleton from '@/components/reader/ReaderSkeleton';

// Trigger config init khi reader route load (1 lần, dedup, cached)
// TODO: Fix initSupabaseConfig hoặc remove reader feature
// initSupabaseConfig();

// Lazy-load each reader page so the bulk of the reader bundle (foliate-js,
// pdfjs-dist) isn't loaded when the user only opens the hub.
const ReaderLogin = lazy(() => import('./Login'));
const ReaderLibrary = lazy(() => import('./Library'));
const ReaderRoute = lazy(() => import('./Reader'));

function ReaderLoader() {
  return (
    <div className="relative h-full bg-zinc-950">
      <ReaderSkeleton />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <ReaderLoader />;
  if (!user) return <Navigate to="/reader/login" replace />;
  return <>{children}</>;
}

/**
 * Mounted at `/reader/*` from the hub's main App. Owns its own subroutes
 * (login, library, reader) and its own auth state via Supabase.
 */
export default function ReaderApp() {
  return (
    <Suspense fallback={<ReaderLoader />}>
      <Routes>
        <Route path="login" element={<ReaderLogin />} />
        <Route
          index
          element={
            <Protected>
              <ReaderLibrary />
            </Protected>
          }
        />
        <Route
          path="read/:bookId"
          element={
            <Protected>
              <ReaderRoute />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/reader" replace />} />
      </Routes>
    </Suspense>
  );
}