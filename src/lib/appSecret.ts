
// ============================================================
// App secret — single source of truth
// ============================================================
//
// 1 passphrase duy nhất dùng cho:
//   - Decrypt P2P config trong Setting tool (group "P2P")
//   - Gate password mở Secret Notes (modal Secret)
//
// Encode bằng btoa(reverse(plain)) — chỉ là OBFUSCATION, KHÔNG
// phải mã hoá thật. Bundle public ai cũng decode được. Bảo mật
// thật phải dựa vào restriction ở Firebase / Metered / Vercel
// function (xem audit doc).
//
// Đổi giá trị (rotate):
//   Trong DevTools console:
//     btoa("PASSPHRASE_MOI".split('').reverse().join(''))
//   → paste vào APP_SECRET_ENCODED bên dưới.
// ============================================================

/**
 * Plain: "Bibabibo@2003"
 */
const APP_SECRET_ENCODED = 'MzAwMkBvYmliYWJpQg==';

/** Decode obfuscated `btoa(reverse(plain))` về plain. */
function decodeObfuscated(encoded: string): string {
  if (!encoded) return '';
  try {
    return atob(encoded).split('').reverse().join('');
  } catch {
    return '';
  }
}

/** Single app secret — dùng chung mọi chỗ cần passphrase mặc định. */
export const APP_SECRET = decodeObfuscated(APP_SECRET_ENCODED);