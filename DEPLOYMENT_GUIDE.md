# Hướng dẫn Deploy lên Production (Proxy Setup)

## Kiến trúc deployment

```
vudecor.vn (main site)
  └─ /hubibo/* → proxy → note-silk-gamma.vercel.app
```

- **Project vudecor**: Proxy rewrites từ `/hubibo/*` sang `note-silk-gamma.vercel.app`
- **Project Hub (note-silk-gamma.vercel.app)**: Deploy độc lập với `base: '/'`
- Khi user vào `vudecor.vn/hubibo`, request được proxy sang domain gốc

## Vấn đề đã fix

### 1. Supabase config không load
- **Vấn đề**: `initSupabaseConfig()` bị comment → client dùng `http://noop` placeholder
- **Fix**: 
  - Uncommented `initSupabaseConfig()` 
  - Thêm `ReaderConfigLoader` wrapper để đảm bảo config load trước khi render routes
  - Thêm detailed logging để debug
  - Thêm "Test API" button trong Login page để verify config

### 2. Base path configuration
- **Không cần thay đổi**: Project Hub deploy ở root `/` của domain riêng
- Proxy từ vudecor.vn handle path rewriting tự động

## Bước deploy

### Bước 1: Clear cache cũ
```bash
# Xóa node_modules và reinstall (optional nhưng an toàn)
rm -rf node_modules package-lock.json
npm install

# Xóa dist cũ
rm -rf dist
```

### Bước 2: Build production
```bash
npm run build
```

Build sẽ tạo folder `dist/` với:
- `dist/index.html` (entry point)
- `dist/assets/` (JS/CSS chunks với base path `/hubibo/`)

### Bước 3: Verify build locally
```bash
npm run preview
```

Mở browser và test:
- `http://localhost:4173/` (root - vì deploy ở root domain)
- `http://localhost:4173/reader` (reader route)

**Lưu ý**: Local test sẽ không có `/hubibo` prefix vì proxy chỉ có trên production.

### Bước 4: Deploy lên Vercel (note-silk-gamma.vercel.app)
```bash
# Nếu chưa cài Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Hoặc push lên GitHub → Vercel tự động deploy.

### Bước 5: Test trên production

**Option 1: Test trực tiếp trên domain gốc (recommend)**
```
https://note-silk-gamma.vercel.app/reader/login
```

**Option 2: Test qua proxy vudecor.vn**
```
https://www.vudecor.vn/hubibo/reader/login
```

Kiểm tra Console logs (F12):
```
[reader-config] Initializing Supabase config...
[reader-supabase] Fetching config from API...
[reader-supabase] Available passphrases: 1
[reader-supabase] Fetching from: https://6a27e5be...mockapi.io/Config
[reader-supabase] Fetched X config records
[reader-supabase] ✅ Found Readest/Supabase record
[reader-supabase] ✅ Config fetched successfully: { url: 'https://...' }
[reader-supabase] ✅ Client re-initialized with real config
[reader-config] ✅ Config loaded successfully
```

### Bước 6: Nếu gặp lỗi, dùng "Test API" button

1. Vào Login page: `https://note-silk-gamma.vercel.app/reader/login`
2. Nếu thấy vault error, click nút **"🔍 Test API"**
3. Xem debug info hiện ra:
   - ✅ Tìm thấy record → decrypt issue → nhập passphrase
   - ❌ Không tìm thấy → cần tạo config record trong Setting tool
   - ❌ Lỗi fetch → API endpoint bị sai hoặc CORS issue
### Bước 7: Clear localStorage cache nếu cần
Nếu vẫn thấy lỗi `http://noop` sau khi fix, chạy trong Console:
```javascript
localStorage.removeItem('reader_sb_config');
localStorage.removeItem('reader_vault_passphrase');
location.reload();
```

## Troubleshooting

### Lỗi "Failed to fetch" từ mockapi.io
- **Nguyên nhân**: CORS hoặc API endpoint không trả về data
- **Giải pháp**: 
  1. Kiểm tra trong Console: Network tab → XHR
  2. Verify API có record `group="Readest"` và `type="Supabase"`
  3. Run script test trong Console (xem dưới)

### Script test API trong Console:
```javascript
const ENCODED = 'b2kuaXBha2NvbS5mZDE5NGE5NDMzODdlMWU0ZWI1ZTcyYTYvLzpzcHR0aA==';
const url = atob(ENCODED).split('').reverse().join('') + '/Config';

fetch(url)
  .then(r => r.json())
  .then(data => {
    console.log('All configs:', data);
    const readest = data.find(d => 
      d.group?.toLowerCase() === 'readest' && 
      d.type?.toLowerCase() === 'supabase'
    );
    console.log(readest ? '✅ Found Readest config' : '❌ Not found', readest);
  })
  .catch(err => console.error('❌ Fetch failed:', err));
```

### Assets 404 Not Found
- **Nguyên nhân**: Build bị lỗi hoặc deploy chưa xong
- **Giải pháp**: 
  - Test trực tiếp trên `note-silk-gamma.vercel.app` trước
  - Verify trong Vercel dashboard: Deployments → Latest → View
  - Check HTML source: `<script src="/assets/index-xxx.js">` (không có `/hubibo` prefix)

### Reader login vẫn bị "Failed to fetch"
- **Nguyên nhân**: Config chưa load hoặc localStorage cache cũ
- **Giải pháp**:
  1. Clear cache: `localStorage.removeItem('reader_sb_config')`
  2. Check Console logs xem config có fetch được không
  3. Verify data trong mockapi.io có đúng format và encrypted
