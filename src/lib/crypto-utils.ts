// ============================================================
// crypto-utils — AES-GCM 256 + PBKDF2 standalone helpers
// ============================================================
//
// Dùng riêng cho Crypto modal (utility tool user tự nhập passphrase).
// KHÔNG dùng cho auth/config data (đã bỏ client-side encryption ở đó).
//
// Format payload: `v1:<base64>` với salt(16) + iv(12) + ciphertext.
// ============================================================

const VERSION = 'v1';
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptText(plain: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error('Passphrase rỗng');

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plain),
  );
  const ct = new Uint8Array(ctBuf);

  const combined = new Uint8Array(salt.length + iv.length + ct.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(ct, salt.length + iv.length);

  return `${VERSION}:${bytesToBase64(combined)}`;
}

export async function decryptText(payload: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error('Passphrase rỗng');

  const prefix = `${VERSION}:`;
  if (!payload.startsWith(prefix)) {
    throw new Error('Payload không đúng format (thiếu prefix v1:)');
  }

  const bytes = base64ToBytes(payload.slice(prefix.length));
  if (bytes.length < SALT_BYTES + IV_BYTES + 1) {
    throw new Error('Payload quá ngắn');
  }

  const salt = bytes.slice(0, SALT_BYTES);
  const iv = bytes.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ct = bytes.slice(SALT_BYTES + IV_BYTES);

  const key = await deriveKey(passphrase, salt);
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct,
  );
  return new TextDecoder().decode(ptBuf);
}

export function isEncrypted(payload: string): boolean {
  return typeof payload === 'string' && payload.startsWith(`${VERSION}:`);
}