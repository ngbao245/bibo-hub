// ============================================================
// Secret notes obfuscation helpers
// ============================================================
//
// Cùng thuật toán v1: UTF-8 → bytes → reverse → base64.
// KHÔNG phải mã hoá thật (không có key), chỉ obfuscation.
// User nào access MockAPI cũng có thể decode được.
//
// Gate access: chỉ admin (`profile.role === 'admin'`) mở được modal.
// ============================================================

import { isAdmin } from '@/stores/authStore';

export function encryptSecret(text: string): string {
  if (!text) return '';
  try {
    const utf8Bytes = new TextEncoder().encode(text);
    let binaryString = '';
    utf8Bytes.forEach((byte) => {
      binaryString += String.fromCharCode(byte);
    });
    return btoa(binaryString.split('').reverse().join(''));
  } catch {
    return text;
  }
}

export function decryptSecret(encoded: string): string {
  if (!encoded) return '';
  try {
    const reversed = atob(encoded).split('').reverse().join('');
    const bytes = new Uint8Array(reversed.length);
    for (let i = 0; i < reversed.length; i++) {
      bytes[i] = reversed.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    try {
      return atob(encoded).split('').reverse().join('');
    } catch {
      return encoded;
    }
  }
}

/**
 * Verify quyền mở Secret Notes.
 *
 * Phase 1 gate đơn giản: chỉ admin mở được (thay cho APP_SECRET check cũ).
 * Password input trong modal chỉ là confirmation UX, không phải secret thật —
 * ai đã login role='admin' mới có quyền click Unlock button.
 */
export function verifySecretPassword(_input: string): boolean {
  return isAdmin();
}