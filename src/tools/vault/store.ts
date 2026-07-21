// ============================================================
// Vault Store — Zustand
// ============================================================
//
// Stores transient state: unlock status + master key (in memory).
// Master key is a CryptoKey object — NEVER serialized/persisted.
// Lost on tab close/refresh → user must re-unlock.
// ============================================================

import { create } from 'zustand';

interface VaultState {
  /** Whether vault is unlocked this session. */
  unlocked: boolean;
  /** CryptoKey for AES-256-GCM — only in memory. */
  masterKey: CryptoKey | null;
  /** Whether vault_meta exists (user has set up vault). */
  hasVault: boolean | null; // null = not yet checked

  setUnlocked: (masterKey: CryptoKey) => void;
  lock: () => void;
  setHasVault: (has: boolean) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  unlocked: false,
  masterKey: null,
  hasVault: null,

  setUnlocked: (masterKey) => set({ unlocked: true, masterKey }),

  lock: () => set({ unlocked: false, masterKey: null }),

  setHasVault: (has) => set({ hasVault: has }),
}));