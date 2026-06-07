import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useShortcut } from './hooks/useShortcut';
import { useModalStore } from './stores/modalStore';

// ============================================================
// Lazy routes - mỗi page load chunk riêng khi navigate tới.
// Giảm initial bundle từ ~300KB xuống ~100KB.
// ============================================================
const Hub = lazy(() => import('./routes/HubPro'));
const Notes = lazy(() => import('./routes/Notes'));
const Tasks = lazy(() => import('./routes/Tasks'));
const Sources = lazy(() => import('./routes/Sources'));
const Movies = lazy(() => import('./routes/Movies'));
const Expense = lazy(() => import('./routes/Expense'));
const Keycap = lazy(() => import('./routes/Keycap'));
const ProjectPacker = lazy(() => import('./routes/ProjectPacker'));

// Modals - vẫn eager load vì chúng mount ở App level + cần shortcut lúc nào cũng sẵn.
import Calculator from './modals/Calculator';
import Translate from './modals/Translate';
import Encoder from './modals/Encoder';
import Backup from './modals/Backup';
import Secret from './modals/Secret';
import Savings from './modals/Savings';
import SpxTracking from './modals/Spx';
import DailyReminder from './modals/DailyReminder';
import Shortcuts from './modals/Shortcuts';
import CacheInspector from './modals/CacheInspector';

// Fallback loading UI cho Suspense
function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function App() {
  useGlobalShortcuts();

  const close = useModalStore((s) => s.close);
  useShortcut({
    key: 'escape',
    label: 'Close Modal',
    group: 'Controls',
    handler: close,
  });

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/expense" element={<Expense />} />
          <Route path="/keycap" element={<Keycap />} />
          <Route path="/project-packer" element={<ProjectPacker />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Modal toàn cục */}
      <Calculator />
      <Translate />
      <Encoder />
      <Backup />
      <Secret />
      <Savings />
      <SpxTracking />
      <DailyReminder />
      <Shortcuts />
      <CacheInspector />
    </>
  );
}
