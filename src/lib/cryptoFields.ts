
// ============================================================
// Crypto helpers — AES-GCM 256 + PBKDF2 (Web Crypto API)
// ============================================================
//
// Format payload (string): `v1:<base64>` trong đó base64 chứa
// salt(16B) || iv(12B) || ciphertext (gồm GCM tag 16B cuối).
// Self-contained — chỉ cần passphrase để decrypt.
//
// Key derivation: PBKDF2-SHA256, 100k iterations.
// AES-GCM IV 12 bytes (random per message).
// ============================================================

const VERSION = 'v1';
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

// ============================================================
// Base64 helpers (browser-safe)
// ============================================================

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

// ============================================================
// Key derivation
// ============================================================

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

// ============================================================
// Encrypt / Decrypt
// ============================================================

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

/** Phát hiện string đã mã hoá format v1 hay chưa */
export function isEncrypted(payload: string): boolean {
  return typeof payload === 'string' && payload.startsWith(`${VERSION}:`);
}

// ============================================================
// Field slot encoding (cho Setting tool)
// ============================================================
//
// Schema mockapi `/Config` chỉ có config1..config10 toàn string.
// Mỗi slot có thể chứa NHIỀU FieldEntry — encode dạng JSON array:
//   [{ "k": "...", "e": 0|1, "v": "..." }, ...]
//
// Budget mỗi slot ~4KB để tránh string quá dài (mockapi không công
// bố limit chính thức, 4KB là ngưỡng an toàn). Pack greedy next-fit:
// thêm entry vào slot hiện tại; vượt budget thì mở slot mới.
//
// Tương thích ngược:
//   - Slot là object đơn `{k,e,v}` (format cũ) → coi là array 1 phần tử.
//   - Slot là plain string (legacy) → fallback `{k:fallbackKey, e:0, v:slot}`.
// ============================================================

export interface FieldEntry {
  /** Label do user đặt */
  k: string;
  /** Cờ mã hoá: 1 = v đang là ciphertext */
  e: 0 | 1;
  /** Giá trị (plain hoặc v1:base64) */
  v: string;
}

/** Budget tối đa mỗi slot (ký tự). 4KB an toàn cho mockapi. */
export const SLOT_BUDGET = 4096;

function normalizeEntry(raw: unknown): FieldEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.k !== 'string' || typeof o.v !== 'string') return null;
  if (o.e !== 0 && o.e !== 1) return null;
  return { k: o.k, e: o.e, v: o.v };
}

/**
 * Pack nhiều FieldEntry vào ÍT slot nhất có thể, tôn trọng budget.
 * Trả về string[] đã JSON.stringify; caller tự gán vào config1..N.
 */
export function encodeFieldSlots(entries: FieldEntry[]): string[] {
  if (entries.length === 0) return [];

  const slots: FieldEntry[][] = [];
  let current: FieldEntry[] = [];

  for (const e of entries) {
    const norm: FieldEntry = { k: e.k, e: e.e ? 1 : 0, v: e.v };
    const next = [...current, norm];
    const size = JSON.stringify(next).length;
    if (size > SLOT_BUDGET && current.length > 0) {
      slots.push(current);
      current = [norm];
    } else {
      current = next;
    }
  }
  if (current.length > 0) slots.push(current);

  return slots.map((arr) => JSON.stringify(arr));
}

/**
 * Decode 1 slot → danh sách FieldEntry (có thể nhiều).
 * Hỗ trợ:
 *   - Array of entries (format mới)
 *   - Single entry object (format cũ)
 *   - Plain string (legacy)
 */
export function decodeFieldSlots(slot: string, fallbackKey: string): FieldEntry[] {
  if (!slot) return [];
  try {
    const parsed = JSON.parse(slot);
    if (Array.isArray(parsed)) {
      const out: FieldEntry[] = [];
      for (const item of parsed) {
        const n = normalizeEntry(item);
        if (n) out.push(n);
      }
      return out;
    }
    const single = normalizeEntry(parsed);
    if (single) return [single];
  } catch {
    // plain
  }
  return [{ k: fallbackKey, e: 0, v: slot }];
}