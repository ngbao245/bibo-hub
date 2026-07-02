---
status: active
last_verified: 2026-07-02
verified_against: src/lib/reader/supabase.ts, src/lib/reader/vault.ts, src/routes/reader/Login.tsx
---

# Reader Session Persistence

Doc mô tả cách Reader giữ session Supabase qua page refresh — feature đã ship.

## Vấn đề gốc

User phải login lại mỗi lần refresh trang `/reader` trong production.

### Root cause: Session Loss Due to Client Re-initialization

```
1. Page load → Supabase client tạo với placeholder (url='http://invalid')
2. useAuth() → getSession() → return null (client placeholder không có URL)
3. Redirect → /reader/login
4. Login component → load config từ vault → reinitializeSupabase()
5. New client created → old session not transferred
6. User phải login lại
```

### Why session not persisted

Khi `reinitializeSupabase()` tạo client mới:
- Supabase SDK session storage key format: `sb-{project-ref}-auth-token`
- Client cũ (placeholder): `sb-invalid-auth-token` → không có session
- Client mới (real URL): `sb-abc123-auth-token` → session key mới, chưa có data
- Session không được migrate → user phải re-authenticate

## Giải pháp: Config Cache + Eager Init

### Architecture

```
Page Load (main.tsx / supabase.ts)
│
├─ 1. Check localStorage for cached config
│     Key: 'reader_supabase_config_v1'
│     Value: { url, anonKey, cachedAt }
│
├─ 2a. Cache HIT (exists + not expired):
│      → Initialize client with real URL/key immediately
│      → useAuth() → getSession() → session restored
│      → User stays logged in
│
└─ 2b. Cache MISS (not found or expired):
       → Initialize client with placeholder
       → useAuth() → getSession() → null
       → Redirect to /reader/login
       → Vault flow loads config → cache it → sign in
```

### Key components

#### 1. Cache helper functions (`vault.ts`)

```ts
interface CachedConfig {
  url: string;
  anonKey: string;
  cachedAt: number;
}

const CACHE_KEY = 'reader_supabase_config_v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getCachedConfig(): ReaderConfig | null;
export function cacheConfig(config: ReaderConfig): void;
export function clearCachedConfig(): void;
```

#### 2. Eager initialization (`supabase.ts`)

```ts
// Check cache BEFORE creating client
const cachedConfig = getCachedConfig();
const url = envUrl || cachedConfig?.url || 'http://invalid';
const anonKey = envAnonKey || cachedConfig?.anonKey || 'invalid';

let client = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
});
```

Cache hit → client initialized với real URL → session restore work.  
Cache miss → placeholder → fallback vault flow.

#### 3. Session migration on re-init (`supabase.ts`)

```ts
export async function reinitializeSupabase(newUrl, newKey) {
  // Preserve existing session before replacing client
  const { data } = await client.auth.getSession();
  const oldSession = data.session;

  client = createClient(newUrl, newKey, {...});

  if (oldSession) {
    await client.auth.setSession({
      access_token: oldSession.access_token,
      refresh_token: oldSession.refresh_token,
    });
  }
}
```

Critical cho re-init case: khi config thay đổi giữa sessions, session được migrate sang client mới.

#### 4. Cache on success (`Login.tsx`)

```ts
async function runVault(opts) {
  const config = await loadReaderConfig(opts.passphrase);
  await reinitializeSupabase(config.url, config.anonKey);
  cacheConfig(config); // Cache config cho next visit
  const creds = await loadReaderCreds(opts.passphrase);
  await signInWithEmail(creds.email, creds.password);
}
```

#### 5. Clear on logout (`auth.tsx`)

```ts
export async function signOut() {
  await supabase.auth.signOut();
  clearCachedConfig(); // Force fresh config fetch on next login
}
```

## Benefits

- **Login once, stay logged in** — chỉ login khi cache expired hoặc bị clear
- **Fast subsequent loads** — không fetch vault mỗi lần refresh
- **Instant session restore** — client init đúng URL ngay từ đầu
- **Reduced API calls** — vault fetch 1 lần/7 ngày thay vì mỗi page load

## Trade-offs

### Security
- URL và anon key stored plaintext trong localStorage
- Mitigation: đây là public anon key, không phải secret. URL cũng public.
- Acceptable: standard pattern cho client-side Supabase apps

### Stale config
- Nếu Supabase URL/key đổi, cached config stale
- Mitigation:
  - TTL 7 ngày → auto refresh
  - Clear cache on logout
  - Manual clear: `localStorage.removeItem('reader_supabase_config_v1')`

### Multi-tab consistency
- Logout tab A, tab B vẫn có cache
- Mitigation: Supabase SDK sync auth state qua `storage` event → tab B auth listener detect sign out → clear session. Cache vẫn tồn tại nhưng không harmful (chỉ URL/key public).

## Testing checklist

### First login (cold start)
- [ ] Console: `[reader-supabase] No cache or env vars — will load config from vault`
- [ ] Console: `[reader-supabase] Reinitializing client with new config`
- [ ] Console: `Auto-signed in via vault`
- [ ] localStorage: `reader_supabase_config_v1` created
- [ ] localStorage: `sb-xxx-auth-token` created
- [ ] Navigate to `/reader` successfully

### Refresh page (warm start)
- [ ] Console: `[reader-supabase] Using cached config for instant session restore`
- [ ] No console message về re-initializing
- [ ] No network request to MockAPI `/Config`
- [ ] User stays logged in, direct to `/reader`
- [ ] Session auto-refresh nếu token near expiry

### Logout
- [ ] `reader_supabase_config_v1` cleared khỏi localStorage
- [ ] `sb-xxx-auth-token` cleared khỏi localStorage
- [ ] Redirect to `/reader/login`
- [ ] Next login triggers fresh vault fetch

### Cache expiry (sau 7 ngày)
- [ ] Cache treated as miss
- [ ] Fallback vault flow
- [ ] New cache created với fresh timestamp

## Monitoring

Console log intentional dùng `console.info` (theo `system.md` — `console.log` bị ban, `console.info` cho production trace hợp lệ với eslint-disable):

**Warm start**:
```
[reader-supabase] Using cached config for instant session restore
```

**Cold start**:
```
[reader-supabase] No cache or env vars — will load config from vault at runtime
[reader-supabase] Reinitializing client with new config
Auto-signed in via vault
```

**Cache expired hoặc cleared**:
```
[reader-supabase] No cache or env vars — will load config from vault at runtime
```

## Rollback plan

Nếu có issues, revert về client re-init pattern cũ:

1. Remove `getCachedConfig()` call khỏi `supabase.ts`
2. Remove `cacheConfig()` call khỏi `Login.tsx`
3. Giữ session migration trong `reinitializeSupabase()` (improvement)

User sẽ phải login lại mỗi refresh, nhưng ít nhất session migration giúp re-init case.

## Future improvements

### Service Worker cache
- Store config trong Service Worker cache thay vì localStorage
- Persistent across browser restarts
- Better security isolation

### IndexedDB storage
- Encrypt config trước khi store
- More storage space cho future use cases

### Config refresh strategy
- Background refresh khi gần expired (day 6)
- User không thấy vault flow bao giờ sau first login