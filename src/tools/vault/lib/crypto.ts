// ============================================================
// Vault Crypto — Zero-knowledge client-side encryption
// ============================================================
//
// Architecture: dual-key
//   passphrase → PBKDF2 → wrapping_key → AES-KW(master_key)
//   recovery_key → AES-KW(master_key)
//   master_key → AES-256-GCM(entry data)
//
// Server only stores encrypted blobs + salt + verifier.
// Master key NEVER leaves client unencrypted.
// ============================================================

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 32;
const IV_BYTES = 12; // AES-GCM standard
const RECOVERY_KEY_BYTES = 32; // 256-bit

// TypeScript strict mode workaround: Uint8Array is not directly assignable to BufferSource
// in some TS versions due to SharedArrayBuffer union.
function toBuffer(arr: Uint8Array): ArrayBuffer {
  // Copy to a fresh ArrayBuffer to avoid SharedArrayBuffer type issue
  const buf = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buf).set(arr);
  return buf;
}

// ── Key Derivation ──

/**
 * Generate cryptographically random salt.
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * Derive a wrapping key from passphrase + salt using PBKDF2.
 * Returns a CryptoKey usable for AES-KW (wrap/unwrap).
 */
export async function deriveWrappingKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    true,
    ['wrapKey', 'unwrapKey'],
  );
}

/**
 * Compute passphrase verifier — SHA-256 hash of exported wrapping key bytes.
 * Used to verify passphrase correctness without storing the key on server.
 */
export async function computeVerifier(wrappingKey: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', wrappingKey);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return new Uint8Array(hash);
}

// ── Master Key ──

/**
 * Generate random AES-256-GCM master key.
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can wrap it
    ['encrypt', 'decrypt'],
  );
}

/**
 * Wrap (encrypt) master key using wrapping key (AES-KW).
 */
export async function wrapMasterKey(
  wrappingKey: CryptoKey,
  masterKey: CryptoKey,
): Promise<Uint8Array> {
  const wrapped = await crypto.subtle.wrapKey('raw', masterKey, wrappingKey, 'AES-KW');
  return new Uint8Array(wrapped);
}

/**
 * Unwrap (decrypt) master key using wrapping key (AES-KW).
 */
export async function unwrapMasterKey(
  wrappingKey: CryptoKey,
  wrappedKey: Uint8Array,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    toBuffer(wrappedKey),
    wrappingKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// ── Recovery Key ──

/**
 * Generate random recovery key (hex string for user to save).
 */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_KEY_BYTES));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Import recovery key hex string as CryptoKey for AES-KW.
 */
export async function importRecoveryKey(hex: string): Promise<CryptoKey> {
  const bytes = hexToBytes(hex);
  return crypto.subtle.importKey(
    'raw',
    toBuffer(bytes),
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

// ── AES-256-GCM Encrypt/Decrypt (for entries) ──

/**
 * Encrypt plaintext data using master key (AES-256-GCM).
 * Returns { ciphertext, iv } — both as Uint8Array.
 */
export async function encrypt(
  masterKey: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    masterKey,
    enc.encode(plaintext),
  );
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

/**
 * Decrypt ciphertext using master key (AES-256-GCM).
 * Returns plaintext string.
 */
export async function decrypt(
  masterKey: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array,
): Promise<string> {
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    masterKey,
    toBuffer(ciphertext),
  );
  return new TextDecoder().decode(plainBuffer);
}

// ── Helpers ──

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}