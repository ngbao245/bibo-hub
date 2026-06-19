# Reader Vault Setup Guide

## Các vấn đề đã fix

### 1. Mixed Content / Failed to fetch từ `http://invalid`
**Nguyên nhân:** Supabase client cần URL và anon key, nhưng trong production không có file `.env` → client khởi tạo với placeholder `http://invalid`

**Giải pháp:** Load config động từ Setting tool (MockAPI `/Config`)

### 2. PDF.js Worker Version Mismatch
**Lỗi:** `The API version "4.8.69" does not match the Worker version "4.10.38"`

**Nguyên nhân:** 
- `react-pdf@9.2.1` yêu cầu `pdfjs-dist@4.8.69`
- `package.json` dùng `^4.8.69` → npm install version mới nhất `4.10.38`
- Worker và API library version khác nhau → crash

**Giải pháp:** Lock exact version trong `package.json`:
```json
"pdfjs-dist": "4.8.69"  // Không dùng ^ (caret)
```

### 3. PDF.js Worker Bare Specifier (Production)
**Lỗi:** `Loading Worker from https://yoursite.com/pdf.worker.mjs` → 404

**Nguyên nhân:** react-pdf internal code set default `workerSrc = 'pdf.worker.mjs'` (bare specifier) trước khi app setup chạy (race condition với lazy loading)

**Giải pháp:** 
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
  {
    "k": "emailLogin",
    "e": 1,
    "v": "v1:B+wPCh..."
  },
  {
    "k": "password",
    "e": 1,
    "v": "v1:DvGjDC..."
  },
  {
    "k": "supabaseURL",
    "e": 1,
    "v": "v1:azWX6p..."
  },
  {
    "k": "supabaseAnonymousKey",
    "e": 1,
    "v": "v1:rSoGET..."
  },
  {
    "k": "supabaseBucket",
    "e": 1,
    "v": "v1:0HWpHs..."
  }
]
```

### Field names (case-sensitive):
- `emailLogin` hoặc `email` - Email Supabase account
- `password` - Password Supabase account
- `supabaseURL` - Supabase project URL (https://xxx.supabase.co)
- `supabaseAnonymousKey` - Supabase anon public key
- `supabaseBucket` (optional) - Storage bucket name, mặc định: "books"

## Cách encrypt fields

Dùng **Crypto tool** trong app:
1. Vào Crypto tool
2. Nhập passphrase (lưu lại để sau dùng)
3. Nhập value cần encrypt (email, password, URL, key...)
4. Copy giá trị đã encrypt (bắt đầu `v1:...`)
5. Paste vào field `v` trong config1

## Flow hoạt động

1. User vào `/reader/login`
2. Component tự động gọi `loadReaderConfig()` và `loadReaderCreds()`
3. Fetch record từ MockAPI `/Config` với `group="Readest"` và `type="Supabase"`
4. Decrypt fields bằng passphrase (thử theo thứ tự: user input → APP_SECRET → localStorage → session)
5. Re-initialize Supabase client với URL và anon key thực
6. Sign in với email/password
7. Navigate vào `/reader` (library)

## Passphrase priority

Hệ thống thử decrypt theo thứ tự:
1. **User input** - Nhập thủ công qua PassphrasePrompt khi auto-login fail
2. **APP_SECRET** - Passphrase mặc định của project (trong `src/lib/appSecret.ts`)
3. **localStorage** - Lưu từ lần login thành công trước (persist across sessions)
4. **Session** - Từ Crypto modal (chỉ tồn tại trong tab hiện tại)

## Troubleshooting

### Lỗi "Vault: No Setting record"
→ Chưa tạo record trong Setting tool, hoặc group/type không đúng

### Lỗi "Vault thiếu field supabaseURL"
→ Field name sai, phải là `supabaseURL` (chữ URL viết hoa)

### Lỗi "Decrypt failed with N passphrase(s)"
→ Không có passphrase nào decrypt được:
- Click nút "Test" và nhập passphrase đã dùng lúc encrypt
- Hoặc update APP_SECRET trong code match với passphrase encrypt

### Vẫn thấy `http://invalid` trong error
→ Config chưa load kịp trước khi gọi API:
- Check Console logs xem có `[reader-supabase] ✅ Reinitializing client` không
- Nếu không thấy → vault load fail, xem error phía trên

## Dev vs Production

**Development (có .env.local):**
- Supabase client dùng `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` từ env
- Không cần vault (nhưng vẫn hoạt động nếu có)

**Production (không có .env):**
- Client khởi tạo với placeholder `http://invalid`
- **BẮT BUỘC** load config từ vault trước khi dùng
- Login component tự động làm việc này

## Kiểm tra

Console logs khi login thành công:
```
[reader-supabase] ✅ Reinitializing client with dynamic config
[reader] vault sign-in: success
✅ Auto-signed in via vault
```

Network tab:
- ✅ Request đi tới `https://xxx.supabase.co/auth/v1/token`
- ❌ Không còn request tới `http://invalid`
