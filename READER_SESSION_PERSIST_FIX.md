# Reader Session Persistence Fix

## Vấn đề

User phải login lại mỗi lần refresh trang `/reader` trong production.

## Root Cause

**Session Loss Due to Client Re-initialization:**

```
1. Page load → Supabase client tạo với placeholder (url='http://invalid')
2. useAuth() → getSession() → return null (client placeholder không có URL)
3. Redirect → /reader/login
4. Login component → load config từ vault → reinitializeSupabase()
5. ❌ New client created → old session not transferred
6. User phải login lại
```

**Why Session Not Persisted:**

Khi `reinitializeSupabase()` tạo client mới:
- Supabase SDK session storage key format: `sb-{project-ref}-auth-token`
- Client cũ (placeholder): `sb-invalid-auth-token` → không có session
- Client mới (real URL): `sb-abc123-auth-token` → session key mới, chưa có data
- Session không được migrate → user phải re-authenticate

## Giải pháp: Config Cache + Eager Init (Option 3)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Page Load (main.tsx / supabase.ts)                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Check localStorage for cached config                     │
│    Key: 'reader_supabase_config_v1'                         │
│    Value: { url, anonKey, cachedAt }                        │
│                                                              │
│ 2a. Cache HIT (exists + not expired):                       │
│     → Initialize client with real URL/key immediately       │
│     → useAuth() → getSession() → ✅ session restored        │
│     → User stays logged in!                                 │
│                                                              │
│ 2b. Cache MISS (not found or expired):                      │
│     → Initialize client with placeholder                    │
│     → useAuth() → getSession() → null                       │
│     → Redirect to /reader/login                             │
│     → Vault flow loads config → cache it → sign in         │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Cache Helper Functions (`vault.ts`)

```typescript
interface CachedConfig {
  url: string;
  anonKey: string;
  cachedAt: number;
}

const CACHE_KEY = 'reader_supabase_config_v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Get cached config (return null if expired)
export function getCachedConfig(): ReaderConfig | null;

// Save config after successful vault load
export function cacheConfig(config: ReaderConfig): void;

// Clear on logout or config change
export function clearCachedConfig(): void;
```

#### 2. Eager Initialization (`supabase.ts`)

```typescript
// Check cache BEFORE creating client
const cachedConfig = getCachedConfig();
const url = envUrl || cachedConfig?.url || 'http://invalid';
const anonKey = envAnonKey || cachedConfig?.anonKey || 'invalid';

// Create client with real config if cache hit
let client = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
});
```

**Result:**
- Cache hit → client initialized with real URL → session restore works
- Cache miss → placeholder → fallback to vault flow

#### 3. Session Migration on Re-init (`supabase.ts`)

```typescript
export async function reinitializeSupabase(newUrl, newKey) {
  // Preserve existing session before replacing client
  const { data } = await client.auth.getSession();
  const oldSession = data.session;

  // Create new client
  client = createClient(newUrl, newKey, {...});

  // Restore session to new client
  if (oldSession) {
    await client.auth.setSession({
      access_token: oldSession.access_token,
      refresh_token: oldSession.refresh_token,
    });
  }
}
```

**Critical for re-init case:** Khi config thay đổi giữa sessions, session được migrate sang client mới.

#### 4. Cache on Success (`Login.tsx`)

```typescript
async function runVault(opts) {
  const config = await loadReaderConfig(opts.passphrase);
  await reinitializeSupabase(config.url, config.anonKey);
  
  // Cache config for next visit
  cacheConfig(config);
  
  const creds = await loadReaderCreds(opts.passphrase);
  await signInWithEmail(creds.email, creds.password);
  // ...
}
```

#### 5. Clear on Logout (`auth.tsx`)

```typescript
export async function signOut() {
  await supabase.auth.signOut();
  clearCachedConfig(); // Force fresh config fetch on next login
}
```

## Benefits

### ✅ User Experience
- **Login once, stay logged in**: Chỉ cần login 1 lần (hoặc khi cache expired)
- **Fast subsequent loads**: Không cần fetch vault mỗi lần refresh
- **Natural session behavior**: Giống như app có env vars

### ✅ Performance
- **Reduced API calls**: Vault fetch 1 lần per 7 days thay vì mỗi page load
- **Instant session restore**: Client initialized đúng URL ngay từ đầu

### ✅ Reliability
- **Graceful degradation**: Cache miss → fallback to vault flow
- **Auto expiry**: Config refresh sau 7 ngày
- **Invalidation on logout**: Đảm bảo fresh state khi re-login

## Trade-offs

### ⚠️ Security
- **Unencrypted cache**: URL và anon key stored plaintext trong localStorage
- **Mitigation**: Chỉ là public anon key, không phải secret. URL cũng public.
- **Acceptable**: Standard pattern cho client-side Supabase apps

### ⚠️ Stale Config
- **Problem**: Nếu Supabase URL/key thay đổi, cached config stale
- **Mitigation**: 
  - TTL 7 ngày → auto refresh
  - Clear cache on logout
  - Manual clear: `localStorage.removeItem('reader_supabase_config_v1')`

### ⚠️ Multi-tab Consistency
- **Problem**: Logout trên tab A, tab B vẫn có cache
- **Mitigation**: Supabase SDK sync auth state qua `storage` event
  - Tab B auth listener → detect sign out → clear session
  - Cache vẫn tồn tại nhưng không harmful (chỉ là URL/key)

## Testing Checklist

### First Login (Cold Start)
- [ ] Console: `No cache or env vars — will load config from vault`
- [ ] Console: `🔄 Reinitializing client with new config`
- [ ] Console: `✅ Auto-signed in via vault`
- [ ] localStorage: `reader_supabase_config_v1` created
- [ ] localStorage: `sb-xxx-auth-token` created
- [ ] Navigate to `/reader` successfully

### Refresh Page (Warm Start)
- [ ] Console: `✅ Using cached config for instant session restore`
- [ ] No console message about re-initializing
- [ ] No network request to MockAPI `/Config`
- [ ] User stays logged in, direct to `/reader`
- [ ] Session auto-refresh if token near expiry

### Logout
- [ ] `reader_supabase_config_v1` cleared from localStorage
- [ ] `sb-xxx-auth-token` cleared from localStorage
- [ ] Redirect to `/reader/login`
- [ ] Next login triggers fresh vault fetch

### Cache Expiry (After 7 Days)
- [ ] Cache treated as miss
- [ ] Fallback to vault flow
- [ ] New cache created with fresh timestamp

## Monitoring

### Production Console Logs

**Successful warm start:**
```
[reader-supabase] ✅ Using cached config for instant session restore
```

**Successful cold start:**
```
[reader-supabase] No cache or env vars — will load config from vault at runtime
[reader-supabase] 🔄 Reinitializing client with new config
✅ Auto-signed in via vault
```

**Cache expired or cleared:**
```
[reader-supabase] No cache or env vars — will load config from vault at runtime
// → triggers full vault flow
```

## Rollback Plan

Nếu có issues, revert về client re-init pattern cũ:

1. Remove `getCachedConfig()` call từ `supabase.ts`
2. Remove `cacheConfig()` call từ `Login.tsx`
3. Keep session migration trong `reinitializeSupabase()` (improvement)

User sẽ phải login lại mỗi refresh, nhưng ít nhất session migration giúp re-init case.

## Future Improvements

### Option: Service Worker Cache
- Store config trong Service Worker cache thay vì localStorage
- Persistent across browser restarts
- Better security isolation

### Option: IndexedDB Storage
- Encrypt config trước khi store
- More storage space cho future use cases

### Option: Config Refresh Strategy
- Background refresh khi gần expired (day 6)
- User không thấy vault flow bao giờ sau first login
