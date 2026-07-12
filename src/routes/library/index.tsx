import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ReaderSkeleton from '@/components/library/ReaderSkeleton';

// Lazy-load reader pages để phần lớn bundle (pdfjs-dist) không load khi user
// chỉ mở hub.
const ReaderLibrary = lazy(() => import('./Library'));
const ReaderRoute = lazy(() => import('./Reader'));

function ReaderLoader() {
  return (
    <div className="relative h-full bg-zinc-950">
      <ReaderSkeleton />
    </div>
  );
}

/**
 * Mount tại `/library/*` từ App chính. AuthGuard + ToolGuard bên ngoài đã
 * đảm bảo user login + có tool 'library'. Không cần Protected riêng.
 */
export default function ReaderApp() {
  return (
    <Suspense fallback={<ReaderLoader />}>
      <Routes>
        <Route index element={<ReaderLibrary />} />
        <Route path="read/:bookId" element={<ReaderRoute />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>
    </Suspense>
  );
}