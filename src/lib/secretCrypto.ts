
// ============================================================
// Secret notes encryption helpers
// ============================================================
//
// Cùng thuật toán v1: UTF-8 → bytes → reverse → base64.
// KHÔNG phải mã hoá thật (không có key), chỉ obfuscation.
// User nào access MockAPI cũng có thể decode được.
// Để bảo mật thật, nên migrate sang AES-GCM với key từ password.
// Giữ thuật toán cũ để tương thích data v1.
// ============================================================

import { APP_SECRET } from './appSecret';

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
    // Fallback cho data plain text cũ
    try {
      return atob(encoded).split('').reverse().join('');
    } catch {
      return encoded;
    }
  }
}

/**
 * Verify password mở Secret Notes. Password lấy từ APP_SECRET
 * (lib/appSecret.ts) — đây không phải bảo mật mạnh, chỉ là khoá
 * mềm tương thích v1.
 */
export function verifySecretPassword(input: string): boolean {
  return input === APP_SECRET;
}