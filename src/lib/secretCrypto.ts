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
 * Verify password match. Logic v1:
 *   correct = atob(SECRET_PASSWORD_ENCODED).split('').reverse().join('')
 *
 * Hardcoded password để tương thích v1, đổi cách lưu hoặc dùng auth thật
 * trong tương lai. Đây không phải bảo mật mạnh, chỉ là khoá mềm.
 */
const SECRET_PASSWORD_ENCODED = 'MzAwMkBvYmlib2FC';

export function verifySecretPassword(input: string): boolean {
  const correct = atob(SECRET_PASSWORD_ENCODED).split('').reverse().join('');
  return input === correct;
}
