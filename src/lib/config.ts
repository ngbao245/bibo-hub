// API config — kế thừa logic decode từ v1 config.js.
// Cách encode: reverse string + base64 encode + UTF-8 (Vietnamese-safe).
// Dùng Encoder modal (Alt+E) để generate giá trị mới.

const ENCODED_API_BASE = 'b2kuaXBha2NvbS43MmM1MWJlZmNlYTFhOTg4ZTcwMWM3OTYvLzpzcHR0aA==';

function decode(encoded: string): string {
  try {
    // Reverse + base64
    const reversed = atob(encoded).split('').reverse().join('');
    // Convert binary string → UTF-8 (cho phép ký tự Việt)
    const bytes = new Uint8Array(reversed.length);
    for (let i = 0; i < reversed.length; i++) {
      bytes[i] = reversed.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    // Fallback cho format cũ
    return atob(encoded).split('').reverse().join('');
  }
}

const BASE = decode(ENCODED_API_BASE);

export const API = {
  BASE,
  NOTES: `${BASE}/notes`,
  TASKS: `${BASE}/tasks`,
  TAGS: `${BASE}/tags`,
} as const;
