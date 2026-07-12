# Service Provider Architecture Refactor

## Tổng quan

Refactor hệ thống `/config` từ tool-centric sang provider-centric với credential pooling, fail-over và quota management.

## Kiến trúc mới

```
Service Provider (Gemini, iLovePDF, Google Drive...)
  └─ Service Profile (Default Pool, Experimental Pool...)
      └─ Service Credential (API Key 1, API Key 2...)
          └─ Tool Service Binding (RAG Search, Email Generator...)
              └─ Tool-specific Overrides (model, temperature...)
```

### Lợi ích

1. **Tái sử dụng credentials**: Một Gemini API key pool dùng cho nhiều tool (RAG, Email Gen, Translation...)
2. **Fail-over tự động**: Khi một credential hết quota, tự động thử credential khác
3. **Quota management**: Track usage, cooldown, exhausted status
4. **Separation of concerns**: Provider config, tool config, credentials và assets tách biệt
5. **Flexible bindings**: Tool có thể bind nhiều provider (primary + fallback)

## Database Schema

### Tables

#### `service_providers`
Đại diện cho loại external service
- `id`, `code`, `name`, `category`, `description`, `status`

#### `service_profiles`
Một provider có thể có nhiều profile/pool
- `id`, `provider_id`, `name`, `settings`, `status`

#### `service_credentials`
Mỗi API key, OAuth account là một record
- `id`, `profile_id`, `name`, `identifier`
- `secret_encrypted`, `status`, `priority`, `weight`
- `quota_limit`, `quota_used`, `quota_reset_at`
- `last_used_at`, `last_success_at`, `last_error_at`
- `cooldown_until`

#### `tool_service_bindings`
Nối tool với service profile
- `id`, `tool_code`, `capability`, `profile_id`
- `is_primary`, `priority`, `enabled`, `overrides`

#### `tool_settings`
Config thuộc riêng tool
- `id`, `tool_code`, `settings`

## Migration Steps

### 1. Chạy SQL migrations

```bash
# Tạo tables mới
psql -f scripts/service-provider-migration.sql

# Migrate data từ app_settings sang bảng mới
psql -f scripts/migrate-legacy-config.sql
```

### 2. Update code để sử dụng Service Executor

#### Before (Old)
```typescript
// Trực tiếp lấy key từ config và gọi API
const tokens = await loadRagTokens();
const key = tokens.geminiApiKeys[0];
const response = await fetch(`https://api.gemini.com?key=${key}`, ...);
```

#### After (New)
```typescript
// Sử dụng Service Executor
import { serviceExecutor } from '@/lib/service-provider';

const result = await serviceExecutor.execute(
  {
    tool_code: 'rag-search',
    capability: 'ai.embed',
    payload: { text: query },
  },
  async (credential, overrides) => {
    // Handler nhận credential đã được chọn từ pool
    const apiKey = credential.secret_encrypted;
    const response = await fetch(`https://api.gemini.com?key=${apiKey}`, ...);
    return response.json();
  }
);

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.message);
}
```

### 3. Refactor từng tool

#### RAG Search
- ✅ Load Gemini keys từ `gemini_credit_pool` profile
- ✅ Embed và chat qua service executor
- ✅ Handle fail-over tự động

#### Email Generator (Agency Studio)
- ✅ Bind tới `gemini_credit_pool` profile
- ✅ Override model = `gemini-1.5-pro`
- ✅ Override temperature = 0.8

#### PDF Compress
- ✅ Load iLovePDF keys từ profile
- ✅ Compression level từ binding overrides
- ✅ Fail-over sang CloudConvert nếu cần

#### Google Drive Backup
- ✅ OAuth credentials từ profile
- ✅ Folder ID từ profile settings

#### P2P Transfer
- ✅ Firebase credentials từ profile
- ✅ Metered TURN credentials từ profile

## Credential Selection Strategies

Service Executor hỗ trợ các strategy:

### `round_robin`
Xoay vòng qua các credentials (default)

### `least_used`
Chọn credential ít được dùng nhất (dựa vào `quota_used`)

### `priority`
Chọn credential có priority cao nhất

### `weighted`
Random theo trọng số (weight)

### `available_first`
Chọn credential khả dụng đầu tiên

## Fail-over Flow

1. Load bindings cho tool + capability
2. Sort bindings theo priority (primary → fallback)
3. Với mỗi binding:
   - Load credentials từ profile
   - Tạo credential pool
   - Chọn credential theo strategy
   - Execute handler
   - Nếu success → return
   - Nếu fail → try credential tiếp theo trong pool
   - Nếu pool exhausted → try binding tiếp theo
4. Nếu tất cả fail → return error

## Error Handling

Service Executor tự động phân loại errors:

- **RATE_LIMIT** → Set cooldown 5 phút, retry credential khác
- **QUOTA_EXCEEDED** → Mark exhausted, retry credential khác
- **INVALID_KEY** → Mark invalid, KHÔNG retry (skip ngay)
- **TIMEOUT** → Retry credential khác
- **NETWORK_ERROR** → Retry credential khác

## Monitoring & Health Check

### View active credentials
```sql
SELECT * FROM v_active_credentials;
```

### View tool bindings
```sql
SELECT * FROM v_tool_bindings;
```

### Check credential status programmatically
```typescript
import { checkPoolStatus } from '@/lib/service-provider/examples';

const status = await checkPoolStatus();
console.log(status);
```

## UI Management

Mở Setting → Service Providers tab:
- View tất cả providers
- Quản lý profiles
- Add/edit/delete credentials
- View quota usage
- Enable/disable credentials

## Security Notes

⚠️ **TODO**: Implement encryption cho `secret_encrypted` field

Hiện tại secrets được lưu plain text. Production cần:
1. Encrypt secrets trước khi lưu database
2. Decrypt khi load credentials
3. Sử dụng KMS hoặc Vault cho key management

## Backward Compatibility

Cấu trúc cũ trong `app_settings` vẫn tồn tại song song:
- `gemini_credit_pool`
- `compress_config`
- `drive_backup_config`
- `p2p_config`

Migration script không xóa data cũ. Sau khi verify hệ thống mới hoạt động ổn, có thể xóa các keys cũ.

## Testing

### Unit tests
```bash
npm test src/lib/service-provider
```

### Integration tests
```typescript
// Test credential selection
// Test fail-over logic
// Test quota management
// Test error handling
```

## Rollback Plan

Nếu cần rollback:
1. Revert code changes về commit trước refactor
2. Không cần rollback database (tables mới độc lập)
3. App_settings keys cũ vẫn còn → system hoạt động như trước

## Next Steps

- [ ] Implement secret encryption
- [ ] Add RLS policies cho multi-tenant
- [ ] Build admin dashboard cho monitoring
- [ ] Add webhook notifications khi credential fail
- [ ] Implement auto quota reset
- [ ] Add CloudConvert provider
- [ ] Add OCR provider
- [ ] Add Email provider
