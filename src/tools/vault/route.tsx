// ============================================================
// Vault Route — /vault
// ============================================================
//
// Gate logic:
//   1. Fetch vault_meta (check if vault exists)
//   2. No vault → SetupScreen
//   3. Has vault but not unlocked → UnlockScreen
//   4. Unlocked → VaultMain (entries list + detail)
//
// CRITICAL: No entry data API calls happen until step 4.
// ============================================================

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared';
import { useVaultMeta } from './api';
import { useVaultStore } from './store';
import SetupScreen from './components/SetupScreen';
import UnlockScreen from './components/UnlockScreen';
import VaultMain from './components/VaultMain';

export default function VaultRoute() {
  const metaQuery = useVaultMeta();
  const { unlocked, hasVault, setHasVault } = useVaultStore();

  // Auto-lock vault when leaving /vault (component unmount)
  useEffect(() => {
    return () => {
      useVaultStore.getState().lock();
    };
  }, []);

  // Sync hasVault state from query
  useEffect(() => {
    if (metaQuery.data !== undefined) {
      setHasVault(metaQuery.data !== null);
    }
  }, [metaQuery.data, setHasVault]);

  // Loading meta check
  if (metaQuery.isLoading || hasVault === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState label="Checking vault..." />
      </div>
    );
  }

  // No vault → Setup
  if (!hasVault) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <VaultHeader />
        <SetupScreen />
      </div>
    );
  }

  // Has vault but not unlocked → Unlock
  if (!unlocked) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <VaultHeader />
        <UnlockScreen meta={metaQuery.data!} />
      </div>
    );
  }

  // Unlocked → Main
  return (
    <div className="flex h-screen flex-col bg-background">
      <VaultHeader />
      <div className="flex-1 overflow-hidden">
        <VaultMain />
      </div>
    </div>
  );
}

function VaultHeader() {
  return (
    <header className="flex items-center gap-2 border-b border-border px-4 py-2">
      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <h1 className="text-sm font-semibold">Vault</h1>
    </header>
  );
}