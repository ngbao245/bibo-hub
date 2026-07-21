import { useState } from 'react';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

import { useVaultStore } from '../store';
import { useUpsertVaultMeta } from '../api';
import type { VaultMetaRow } from '../types';
import {
  importRecoveryKey,
  unwrapMasterKey,
  deriveWrappingKey,
  computeVerifier,
  wrapMasterKey,
  bytesToBase64,
  base64ToBytes,
} from '../lib/crypto';

interface Props {
  meta: VaultMetaRow;
  onBack: () => void;
}

export default function RecoveryScreen({ meta, onBack }: Props) {
  const [step, setStep] = useState<'recovery' | 'newpass'>('recovery');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);

  const { setUnlocked } = useVaultStore();
  const upsertMeta = useUpsertVaultMeta();

  async function handleRecover() {
    setError('');
    setLoading(true);
    try {
      const recCryptoKey = await importRecoveryKey(recoveryInput.trim());
      const wrappedByRecovery = base64ToBytes(meta.encrypted_master_key_recovery);
      const mk = await unwrapMasterKey(recCryptoKey, wrappedByRecovery);
      setMasterKey(mk);
      setStep('newpass');
    } catch {
      setError('Invalid recovery key');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassphrase() {
    if (!masterKey || newPass.length < 8 || newPass !== confirmPass) return;
    setLoading(true);
    try {
      const salt = base64ToBytes(meta.salt);
      const wrappingKey = await deriveWrappingKey(newPass, salt);
      const verifier = await computeVerifier(wrappingKey);
      const wrappedByPassphrase = await wrapMasterKey(wrappingKey, masterKey);

      await upsertMeta.mutateAsync({
        salt: meta.salt,
        passphrase_verifier: bytesToBase64(verifier),
        encrypted_master_key_passphrase: bytesToBase64(wrappedByPassphrase),
        encrypted_master_key_recovery: meta.encrypted_master_key_recovery,
      });

      setUnlocked(masterKey);
      toast.success('Passphrase updated, vault unlocked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'newpass') {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <KeyRound className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Set New Passphrase</h2>
        <p className="text-center text-sm text-muted-foreground">
          Recovery successful. Now set a new passphrase.
        </p>

        <div className="w-full space-y-3">
          <Input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="New passphrase (min 8 chars)..."
          />
          <Input
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Confirm..."
          />
          {confirmPass && newPass !== confirmPass && (
            <p className="text-xs text-destructive">Does not match</p>
          )}
          <Button
            className="w-full"
            disabled={newPass.length < 8 || newPass !== confirmPass || loading}
            onClick={handleSetNewPassphrase}
          >
            {loading ? 'Saving...' : 'Save & Unlock'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
        <KeyRound className="h-7 w-7 text-warning" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Recover Vault</h2>
      <p className="text-center text-sm text-muted-foreground">
        Enter your recovery key to regain access.
      </p>

      <div className="w-full space-y-3">
        <textarea
          value={recoveryInput}
          onChange={(e) => { setRecoveryInput(e.target.value); setError(''); }}
          placeholder="Paste recovery key..."
          className="min-h-[80px] w-full resize-none border border-input bg-background p-3 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            className="flex-1"
            disabled={!recoveryInput.trim() || loading}
            onClick={handleRecover}
          >
            {loading ? 'Verifying...' : 'Recover'}
          </Button>
        </div>
      </div>
    </div>
  );
}