import { useState } from 'react';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useVaultStore } from '../store';
import type { VaultMetaRow } from '../types';
import {
  deriveWrappingKey,
  computeVerifier,
  unwrapMasterKey,
  bytesToBase64,
  base64ToBytes,
} from '../lib/crypto';
import RecoveryScreen from './RecoveryScreen';

interface Props {
  meta: VaultMetaRow;
}

export default function UnlockScreen({ meta }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const { setUnlocked } = useVaultStore();

  async function handleUnlock() {
    if (!passphrase) return;
    setError('');
    setLoading(true);

    try {
      const salt = base64ToBytes(meta.salt);
      const wrappingKey = await deriveWrappingKey(passphrase, salt);

      // Verify passphrase
      const verifier = await computeVerifier(wrappingKey);
      const verifierB64 = bytesToBase64(verifier);

      if (verifierB64 !== meta.passphrase_verifier) {
        setError('Wrong passphrase');
        setLoading(false);
        return;
      }

      // Decrypt master key
      const wrappedMasterKey = base64ToBytes(meta.encrypted_master_key_passphrase);
      const masterKey = await unwrapMasterKey(wrappingKey, wrappedMasterKey);

      // Unlock
      setUnlocked(masterKey);
    } catch {
      setError('Unlock failed — wrong passphrase or corrupted data');
    } finally {
      setLoading(false);
    }
  }

  if (showRecovery) {
    return <RecoveryScreen meta={meta} onBack={() => setShowRecovery(false)} />;
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Unlock Vault</h2>
      <p className="text-center text-sm text-muted-foreground">
        Enter your passphrase to access your secrets.
      </p>

      <div className="w-full space-y-3">
        <Input
          type="password"
          value={passphrase}
          onChange={(e) => { setPassphrase(e.target.value); setError(''); }}
          placeholder="Passphrase..."
          onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
        />

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <Button
          className="w-full"
          disabled={!passphrase || loading}
          onClick={handleUnlock}
        >
          {loading ? 'Unlocking...' : 'Unlock'}
        </Button>

        <button
          type="button"
          onClick={() => setShowRecovery(true)}
          className="w-full text-center text-xs text-muted-foreground hover:text-primary"
        >
          Forgot passphrase?
        </button>
      </div>
    </div>
  );
}