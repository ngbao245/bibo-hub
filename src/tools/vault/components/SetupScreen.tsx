import { useState } from 'react';
import { Lock, Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

import { useVaultStore } from '../store';
import { useUpsertVaultMeta } from '../api';
import {
  generateSalt,
  deriveWrappingKey,
  computeVerifier,
  generateMasterKey,
  wrapMasterKey,
  generateRecoveryKey,
  importRecoveryKey,
  bytesToBase64,
} from '../lib/crypto';

export default function SetupScreen() {
  const [step, setStep] = useState<'form' | 'recovery'>('form');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const upsertMeta = useUpsertVaultMeta();
  const { setUnlocked, setHasVault } = useVaultStore();

  const valid = passphrase.length >= 8 && passphrase === confirm;

  async function handleCreate() {
    if (!valid) return;
    setLoading(true);

    try {
      // 1. Generate crypto material
      const salt = generateSalt();
      const wrappingKey = await deriveWrappingKey(passphrase, salt);
      const verifier = await computeVerifier(wrappingKey);
      const masterKey = await generateMasterKey();
      const wrappedByPassphrase = await wrapMasterKey(wrappingKey, masterKey);

      // 2. Recovery key
      const recKey = generateRecoveryKey();
      const recCryptoKey = await importRecoveryKey(recKey);
      const wrappedByRecovery = await wrapMasterKey(recCryptoKey, masterKey);

      // 3. Save to server
      await upsertMeta.mutateAsync({
        salt: bytesToBase64(salt),
        passphrase_verifier: bytesToBase64(verifier),
        encrypted_master_key_passphrase: bytesToBase64(wrappedByPassphrase),
        encrypted_master_key_recovery: bytesToBase64(wrappedByRecovery),
      });

      // 4. Show recovery key to user
      setRecoveryKey(recKey);
      setStep('recovery');

      // 5. Unlock vault in memory
      setUnlocked(masterKey);
      setHasVault(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  }

  function handleCopyRecovery() {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    toast.success('Recovery key copied');
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === 'recovery') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
          <Lock className="h-7 w-7 text-warning" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Recovery Key</h2>
        <p className="text-center text-sm text-muted-foreground">
          Save this key somewhere safe. If you forget your passphrase, this is the ONLY way to recover your vault.
        </p>

        <div className="relative w-full">
          <code className="block w-full break-all rounded border border-border bg-muted p-3 font-mono text-xs">
            {recoveryKey}
          </code>
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1 h-7 w-7"
            onClick={handleCopyRecovery}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-muted-foreground">I have saved my recovery key</span>
        </label>

        <Button disabled={!confirmed} onClick={() => setStep('form')} className="w-full">
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Create Vault</h2>
      <p className="text-center text-sm text-muted-foreground">
        Set a passphrase to encrypt your secrets. This passphrase never leaves your browser.
      </p>

      <div className="w-full space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Passphrase (min 8 chars)</label>
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter passphrase..."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirm passphrase</label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm passphrase..."
          />
          {confirm.length > 0 && passphrase !== confirm && (
            <p className="mt-1 text-xs text-destructive">Passphrase does not match</p>
          )}
        </div>

        <Button
          className="w-full"
          disabled={!valid || loading}
          onClick={handleCreate}
        >
          {loading ? 'Creating...' : 'Create Vault'}
        </Button>
      </div>
    </div>
  );
}