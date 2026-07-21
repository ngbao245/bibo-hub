
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useBootstrapShortcutOverrides } from './hooks/useBootstrapShortcutOverrides';
import { useBootstrapRag } from './hooks/useBootstrapRag';
import { useLandingShortcut } from './tools/portfolio/hooks/useLandingShortcut';
import { useThemeHydration } from './api/themeApi';
import { useThemeStore } from './stores/themeStore';
import AuthGuard from './components/auth/AuthGuard';
import ToolGuard from './components/auth/ToolGuard';

// ============================================================
// Lazy routes - mỗi page load chunk riêng khi navigate tới.
// Giảm initial bundle từ ~300KB xuống ~100KB.
// ============================================================
const Landing = lazy(() => import('./tools/portfolio/route'));
const Hub = lazy(() => import('./routes/HubPro'));
const Login = lazy(() => import('./routes/Login'));
const Notes = lazy(() => import('./routes/Notes'));
const Tasks = lazy(() => import('./routes/Tasks'));
const Bookmarks = lazy(() => import('./tools/bookmarks/route'));
const Expense = lazy(() => import('./tools/expense/route'));
const ProjectPacker = lazy(() => import('./tools/project-packer/route'));
const P2PTransfer = lazy(() => import('./tools/p2p-transfer/route'));
const Setting = lazy(() => import('./routes/Setting'));
const Account = lazy(() => import('./routes/Account'));
const CodeCompare = lazy(() => import('./tools/code-compare/route'));
const MarkdownPreview = lazy(() => import('./tools/markdown-preview/route'));
const LibraryApp = lazy(() => import('./tools/library/route'));
const JsonStudio = lazy(() => import('./tools/json-studio/route'));
const AgencyStudio = lazy(() => import('./routes/AgencyStudio'));
const AgencyUnsubscribe = lazy(() => import('./routes/AgencyStudio/Unsubscribe'));
const Vault = lazy(() => import('./tools/vault/route'));
const DesignSystem = lazy(() => import('./routes/DesignSystem'));
// Modals - vẫn eager load vì chúng mount ở App level + cần shortcut lúc nào cũng sẵn.
import Calculator from './tools/calculator/modal';
import Translate from './tools/translate/modal';
import Encoder from './tools/encoder/modal';
import SpxTracking from './tools/spx/modal';
import Shortcuts from './tools/shortcuts/modal';
import Crypto from './tools/crypto/modal';
import Audio from './tools/audio/modal';
import RagAssistantModal from './components/rag/RagAssistantModal';

// Audio player toàn cục (provider + floating window mount 1 lần)
import { AudioProvider } from './tools/audio/lib/audio-context';
import AudioFloatingHost from './tools/audio/components/AudioFloatingHost';

// Fallback loading UI cho Suspense
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-5 w-5 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30" />
    </div>
  );
}

/** Legacy /json-viewer → /json-studio redirect, giữ query string cho bookmark cũ. */
function LegacyJsonViewerRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/json-studio${search}${hash}`} replace />;
}

/** Apply theme data attributes to <html> element so portals also inherit. */
function useApplyThemeAttributes() {
  const theme = useThemeStore((s) => s.theme);
  const is3d = useThemeStore((s) => s.is3d);
  const isRounded = useThemeStore((s) => s.isRounded);

  useEffect(() => {
    const el = document.documentElement;

    if (theme === 'dark') {
      el.removeAttribute('data-theme');
    } else {
      el.setAttribute('data-theme', theme);
    }

    if (is3d) {
      el.setAttribute('data-3d', '');
    } else {
      el.removeAttribute('data-3d');
    }

    if (isRounded) {
      el.setAttribute('data-rounded', '');
    } else {
      el.removeAttribute('data-rounded');
    }
  }, [theme, is3d, isRounded]);
}

export default function App() {
  useGlobalShortcuts();
  useBootstrapShortcutOverrides();
  useBootstrapRag();
  useLandingShortcut(); // Alt+H → /portfolio (mở landing từ hub cho owner)
  useThemeHydration();
  useApplyThemeAttributes();

  return (
    <AudioProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes — không cần auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/portfolio" element={<Landing />} />
          <Route path="/agency-studio/unsubscribe" element={<AgencyUnsubscribe />} />

          {/* Protected routes — wrap AuthGuard */}
          <Route
            path="*"
            element={
              <AuthGuard>
                <Routes>
                  <Route path="/" element={<Hub />} />
                  <Route path="/notes" element={<Notes />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/sources" element={<Navigate to="/project-packer" replace />} />
                  <Route path="/bookmarks" element={<Bookmarks />} />
                  <Route path="/movies" element={<Navigate to="/bookmarks" replace />} />
                  <Route path="/expense" element={<Expense />} />
                  <Route path="/project-packer" element={<ProjectPacker />} />
                  <Route
                    path="/p2p"
                    element={
                      <ToolGuard toolId="p2p-transfer">
                        <P2PTransfer />
                      </ToolGuard>
                    }
                  />
                  <Route path="/config" element={<Setting />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/code-compare" element={<CodeCompare />} />
                  <Route path="/markdown" element={<MarkdownPreview />} />
                  <Route path="/json-studio" element={<JsonStudio />} />
                  <Route path="/json-viewer" element={<LegacyJsonViewerRedirect />} />
                  <Route path="/agency-studio/*" element={<AgencyStudio />} />
                  <Route path="/vault" element={<Vault />} />
                  <Route path="/design-system" element={<DesignSystem />} />
                  {/* Legacy redirect: /setting → /config */}
                  <Route path="/setting" element={<Navigate to="/config" replace />} />
                  <Route
                    path="/library/*"
                    element={
                      <ToolGuard toolId="library">
                        <LibraryApp />
                      </ToolGuard>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>

      {/* Modal toàn cục */}
      <Calculator />
      <Translate />
      <Encoder />
      <SpxTracking />
      <Shortcuts />
      <Crypto />
      <Audio />
      <RagAssistantModal />

      {/* Player host (YT iframe ẩn) + floating UI — mount global, không unmount khi đóng modal */}
      <AudioFloatingHost />
    </AudioProvider>
  );
}