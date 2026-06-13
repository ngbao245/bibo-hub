
import { create } from 'zustand';

// ============================================================
// Crypto passphrase store
// ============================================================
//
// Lưu passphrase trong memory + sessionStorage để dùng xuyên suốt
// session (Setting tool, Crypto modal). Tab đóng → mất.
//
// CẢNH BÁO: passphrase này sống trong tab; bất kỳ XSS nào cũng
// đọc được. Đây là tradeoff để khỏi gõ lại mỗi lần encrypt/decrypt.
// ============================================================

const STORAGE_KEY = 'crypto_passphrase';

function readInitial(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

interface CryptoState {
  passphrase: string;
  setPassphrase: (p: string) => void;
  clear: () => void;
}

export const useCryptoStore = create<CryptoState>((set) => ({
  passphrase: readInitial(),
  setPassphrase: (p) => {
    try {
      if (p) sessionStorage.setItem(STORAGE_KEY, p);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ passphrase: p });
  },
  clear: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ passphrase: '' });
  },
}));