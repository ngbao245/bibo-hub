
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useBootstrapShortcutOverrides } from './hooks/useBootstrapShortcutOverrides';
import { useBootstrapRag } from './hooks/useBootstrapRag';
import { useLandingShortcut } from './hooks/useLandingShortcut';

// ============================================================
// Lazy routes - mỗi page load chunk riêng khi navigate tới.
// Giảm initial bundle từ ~300KB xuống ~100KB.
// ============================================================
const Landing = lazy(() => import('./routes/Landing'));
const Hub = lazy(() => import('./routes/HubPro'));
const Notes = lazy(() => import('./routes/Notes'));
const Tasks = lazy(() => import('./routes/Tasks'));
const Sources = lazy(() => import('./routes/Sources'));
const Movies = lazy(() => import('./routes/Movies'));
const Expense = lazy(() => import('./routes/Expense'));
const Keycap = lazy(() => import('./routes/Keycap'));
const ProjectPacker = lazy(() => import('./routes/ProjectPacker'));
const P2PTransfer = lazy(() => import('./routes/P2PTransfer'));
const Setting = lazy(() => import('./routes/Setting'));
const CodeCompare = lazy(() => import('./routes/CodeCompare'));
const MarkdownPreview = lazy(() => import('./routes/MarkdownPreview'));
const ReaderApp = lazy(() => import('./routes/reader'));
const JsonStudio = lazy(() => import('./routes/JsonStudio'));
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
import Crypto from './modals/Crypto';
import Audio from './modals/Audio';
import RagAssistantModal from './components/rag/RagAssistantModal';

// Audio player toàn cục (provider + floating window mount 1 lần)
import { AudioProvider } from './lib/audio/audio-context';
import AudioFloatingHost from './components/audio/AudioFloatingHost';

// Fallback loading UI cho Suspense
function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-5 w-5 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30" />
    </div>
  );
}

/** Legacy /json-viewer → /json-studio redirect, giữ query string cho bookmark cũ. */
function LegacyJsonViewerRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/json-studio${search}${hash}`} replace />;
}

export default function App() {
  useGlobalShortcuts();
  useBootstrapShortcutOverrides();
  useBootstrapRag();
  useLandingShortcut(); // Alt+H → /portfolio (mở landing từ hub cho owner)

  return (
    <AudioProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/portfolio" element={<Landing />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/expense" element={<Expense />} />
          <Route path="/keycap" element={<Keycap />} />
          <Route path="/project-packer" element={<ProjectPacker />} />
          <Route path="/p2p" element={<P2PTransfer />} />
          <Route path="/setting" element={<Setting />} />
          <Route path="/code-compare" element={<CodeCompare />} />
          <Route path="/markdown" element={<MarkdownPreview />} />
          <Route path="/json-studio" element={<JsonStudio />} />
          {/* Legacy redirect: /json-viewer → /json-studio, giữ query nếu có. */}
          <Route path="/json-viewer" element={<LegacyJsonViewerRedirect />} />
          <Route path="/reader/*" element={<ReaderApp />} />
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
      <Crypto />
      <Audio />
      <RagAssistantModal />

      {/* Player host (YT iframe ẩn) + floating UI — mount global, không unmount khi đóng modal */}
      <AudioFloatingHost />
    </AudioProvider>
  );
}