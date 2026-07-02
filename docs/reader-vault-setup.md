---
status: active
last_verified: 2026-07-02
verified_against: src/lib/reader/vault.ts, src/lib/reader/supabase.ts, src/routes/reader/Login.tsx, src/lib/appSecret.ts
---

# Reader Vault Setup Guide

Setup guide cho user tự cấu hình Supabase credentials của Reader qua Setting tool. Bổ sung cho `docs/reader-session-persist.md` (mô tả cache flow).

## Các vấn đề đã fix

### 1. Mixed Content / Failed to fetch từ `http://invalid`

**Nguyên nhân**: Supabase client cần URL và anon key, nhưng trong production không có file `.env` → client khởi tạo với placeholder `http://invalid`.

**Giải pháp**: Load config động từ Setting tool (MockAPI `/Config`).

### 2. PDF.js Worker Version Mismatch

**Lỗi**: `The API version "4.8.69" does not match the Worker version "4.10.38"`

**Nguyên nhân**:
- `react-pdf@9.2.1` yêu cầu `pdfjs-dist@4.8.69`
- `package.json` dùng `^4.8.69` → npm install version mới nhất `4.10.38`
- Worker và API library version khác nhau → crash

**Giải pháp**: Lock exact version trong `package.json`:

```json
"pdfjs-dist": "4.8.69"
```

Không dùng `^` (caret).

### 3. PDF.js Worker Bare Specifier (Production)

**Lỗi**: `Loading Worker from https://yoursite.com/pdf.worker.mjs` → 404

**Nguyên nhân**: react-pdf internal code set default `workerSrc = 'pdf.worker.mjs'` (bare specifier) trước khi app setup chạy (race condition với lazy loading).

**Giải pháp**:
- Setup worker trong `main.tsx` (entry point) TRƯỚC khi render React
- Dùng `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` để Vite resolve đúng path
- Thêm defensive check trong PdfReader component

## Cấu trúc Vault trong Setting Tool

Vào **Setting tool** → tạo 1 record với:
- **group**: `Readest`
- **type**: `Supabase`
- **config1**: JSON array chứa 5 fields (đã encrypt):

```json
[
  { "k": "emailLogin", "e": 1, "v": "v1:B+wPCh..." },
  { "k": "password", "e": 1, "v": "v1:DvGjDC..." },
  { "k": "supabaseURL", "e": 1, "v": "v1:azWX6p..." },
  { "k": "supabaseAnonymousKey", "e": 1, "v": "v1:rSoGET..." },
  { "k": "supabaseBucket", "e": 1, "v": "v1:0HWpHs..." }
]
```

### Field names (case-sensitive)

- `emailLogin` hoặc `email` — Email Supabase account
- `password` — Password Supabase account
- `supabaseURL` — Supabase project URL (https://xxx.supabase.co)
- `supabaseAnonymousKey` — Supabase anon public key
- `supabaseBucket` (optional) — Storage bucket name, mặc định: `books`

## Cách encrypt fields

Dùng **Crypto tool** trong app:
1. Vào Crypto tool
2. Nhập passphrase (lưu lại để sau dùng)
3. Nhập value cần encrypt (email, password, URL, key...)
4. Copy giá trị đã encrypt (bắt đầu `v1:...`)
5. Paste vào field `v` trong config1

## Flow hoạt động

### First Login (Cold Start — No Cache)

1. User vào `/reader/login`
2. `useAuth()` check session → không có (client vẫn dùng placeholder)
3. Component tự động gọi `loadReaderConfig()` và `loadReaderCreds()`
4. Fetch record từ MockAPI `/Config` với `group="Readest"` và `type="Supabase"`
5. Decrypt fields bằng passphrase (thử theo thứ tự: user input → APP_SECRET → localStorage → session)
6. Re-initialize Supabase client với URL và anon key thực
7. Cache config vào localStorage (TTL: 7 ngày)
8. Sign in với email/password
9. Navigate vào `/reader` (library)

### Subsequent Visits (Warm Start — With Cache)

1. Browser load → `supabase.ts` check `localStorage` for cached config
2. Cache hit → khởi tạo client với URL/key thực ngay lập tức
3. `useAuth()` gọi `getSession()` → Session restored từ localStorage
4. User đã logged in → navigate thẳng vào `/reader`
5. Không cần fetch vault, không cần re-initialize, không cần re-login

### Cache Invalidation

- **Manual logout**: Clear cache khi user sign out
- **Auto expiry**: Cache tự expired sau 7 ngày
- **Config change**: Nếu Supabase URL/key thay đổi, clear cache thủ công:
  ```js
  localStorage.removeItem('reader_supabase_config_v1');
  ```

## Passphrase priority

Hệ thống thử decrypt theo thứ tự:

1. **User input** — Nhập thủ công qua PassphrasePrompt khi auto-login fail
2. **APP_SECRET** — Passphrase mặc định của project (trong `src/lib/appSecret.ts`)
3. **localStorage** — Lưu từ lần login thành công trước (persist across sessions)
4. **Session** — Từ Crypto modal (chỉ tồn tại trong tab hiện tại)

## Troubleshooting

### Lỗi "Vault: No Setting record"
Chưa tạo record trong Setting tool, hoặc group/type không đúng.

### Lỗi "Vault thiếu field supabaseURL"
Field name sai, phải là `supabaseURL` (chữ URL viết hoa).

### Lỗi "Decrypt failed with N passphrase(s)"
Không có passphrase nào decrypt được:
- Click nút "Test" và nhập passphrase đã dùng lúc encrypt
- Hoặc update APP_SECRET trong code match với passphrase encrypt

### Vẫn thấy `http://invalid` trong error
Config chưa load kịp trước khi gọi API:
- Check Console logs xem có `[reader-supabase] Reinitializing client` không
- Nếu không thấy → vault load fail, xem error phía trên

### Refresh trang vẫn phải login lại
Đã fix. Session persist hoạt động tự nhiên (chi tiết ở `docs/reader-session-persist.md`):
- Lần đầu login → config được cache trong localStorage (TTL: 7 ngày)
- Refresh trang → client khởi tạo với cached config → session restore tự động
- Chỉ cần login lại khi cache expired, logout thủ công, hoặc token Supabase expired

## Dev vs Production

**Development (có `.env.local`)**:
- Supabase client dùng `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` từ env
- Session persist hoạt động bình thường
- Không cần vault (nhưng vẫn hoạt động nếu có)

**Production (không có `.env`)**:
- First visit: Client khởi tạo với placeholder `http://invalid`
- Login component load config từ vault → cache vào localStorage
- Subsequent visits: Client khởi tạo với cached config → session restore tự động
- User chỉ cần login 1 lần, không cần login lại mỗi lần refresh

## Kiểm tra

### First login (cold start)

Console logs (đã đổi từ `console.log` sang `console.info` theo `system.md`):

```
[reader-supabase] No cache or env vars — will load config from vault at runtime
[reader-supabase] Reinitializing client with new config
Auto-signed in via vault
```

localStorage sau login:

```js
// Config cache
localStorage.getItem('reader_supabase_config_v1')
// → {"url":"https://xxx.supabase.co","anonKey":"eyJ...","cachedAt":1234567890}

// Supabase session
localStorage.getItem('sb-xxx-auth-token')
// → {"access_token":"...","refresh_token":"...","expires_at":...}
```

### Subsequent visits (warm start)

Console logs:

```
[reader-supabase] Using cached config for instant session restore
```

Không còn message "Reinitializing". Session tự động restore.

Network tab:
- Không có request tới MockAPI `/Config`
- Request đi tới `https://xxx.supabase.co/auth/v1/token` (refresh token nếu cần)
- Không còn request tới `http://invalid`

## Related

- `docs/reader-session-persist.md` — Chi tiết Config Cache + Eager Init architecture
- `docs/reader.md` — Reader tool overview
- `src/lib/reader/vault.ts` — decrypt logic
- `src/lib/appSecret.ts` — APP_SECRET default passphrase