import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, KeyRound, Loader2 } from 'lucide-react';

import { signInWithEmail, signUpWithEmail, useAuth } from '@/lib/reader/auth';
import { loadReaderCreds, persistKey, VaultError } from '@/lib/reader/vault';
import { useCryptoStore } from '@/stores/cryptoStore';

export default function ReaderLogin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const triedAutoRef = useRef(false);

  // ================================================================
  // Auto-login từ vault. Chạy 1 lần khi mount + chưa có session.
  // ================================================================
  useEffect(() => {
    if (loading || user || triedAutoRef.current) return;
    triedAutoRef.current = true;
    void runVault({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // Đã có session → vô luôn
  useEffect(() => {
    if (!loading && user) navigate('/reader', { replace: true });
  }, [loading, user, navigate]);

  async function runVault(opts: { silent?: boolean; passphrase?: string } = {}) {
    setVaultLoading(true);
    setVaultError(null);
    try {
      const creds = await loadReaderCreds(opts.passphrase);
      setEmail(creds.email);
      setPassword(creds.password);
      await signInWithEmail(creds.email, creds.password);
      toast.success('Auto-signed in via vault');
      // Lưu passphrase đúng để mọi lần sau auto luôn (cả localStorage + session)
      if (opts.passphrase) {
        persistKey(opts.passphrase);
        useCryptoStore.getState().setPassphrase(opts.passphrase);
      }
      navigate('/reader', { replace: true });
    } catch (err) {
      const msg =
        err instanceof VaultError
          ? `Vault: ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Unknown error';
      setVaultError(msg);
      if (!opts.silent) toast.error(msg);
      // eslint-disable-next-line no-console
      console.warn('[reader] vault sign-in failed:', err);
    } finally {
      setVaultLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        toast.success('Welcome back');
      } else {
        await signUpWithEmail(email, password);
        toast.success('Check your email to confirm account');
      }
      navigate('/reader', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Debug: Test config API
  async function testConfigAPI() {
    setDebugInfo('Testing...');
    try {
      const { API } = await import('@/lib/config');
      const { fetchJson } = await import('@/api/client');
      const { parseSettingList } = await import('@/lib/setting');

      const list = parseSettingList(await fetchJson<unknown>(API.CONFIGS));
      const readest = list.find(
        (s) =>
          s.group.trim().toLowerCase() === 'readest' &&
          s.type.trim().toLowerCase() === 'supabase',
      );

      if (!readest) {
        setDebugInfo(
          `❌ Không tìm thấy record Readest/Supabase.\nCó ${list.length} records: ${list.map((r) => `${r.group}/${r.type}`).join(', ')}`,
        );
      } else {
        setDebugInfo(
          `✅ Tìm thấy record!\nID: ${readest.id}\nGroup: ${readest.group}\nType: ${readest.type}\nConfig1 length: ${readest.config1?.length || 0}`,
        );
      }
    } catch (err) {
      setDebugInfo(`❌ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Reader</h1>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Hub
          </Link>
        </div>

        {vaultLoading && (
          <div className="flex items-center gap-2 border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang đăng nhập từ vault…
          </div>
        )}

        {vaultError && !vaultLoading && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 border border-amber-900/40 bg-amber-900/10 px-3 py-2 text-xs text-amber-300">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{vaultError}</span>
            </div>
            <PassphrasePrompt onTry={runVault} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => runVault()}
                className="flex-1 border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25"
              >
                Thử lại auto-login
              </button>
              <button
                type="button"
                onClick={testConfigAPI}
                className="border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                🔍 Test API
              </button>
            </div>
            {debugInfo && (
              <pre className="whitespace-pre-wrap border border-zinc-800 bg-zinc-900 px-2 py-2 text-[10px] text-zinc-400">
                {debugInfo}
              </pre>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={submitting || vaultLoading}
            className="w-full bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
          >
            {submitting ? '...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}

/** Cho phép user paste passphrase đúng để decrypt vault, lưu vào session. */
function PassphrasePrompt({
  onTry,
}: {
  onTry: (opts: { passphrase: string }) => Promise<void> | void;
}) {
  const [v, setV] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onTry({ passphrase: v.trim() });
      }}
      className="flex gap-1"
    >
      <input
        type="password"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Passphrase đã dùng lúc encrypt"
        className="flex-1 border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
      />
      <button
        type="submit"
        disabled={!v.trim()}
        className="border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
      >
        Test
      </button>
    </form>
  );
}