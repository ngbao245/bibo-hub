# Service Provider System

## Overview

Hệ thống quản lý service providers, credential pooling, và fail-over tự động cho Tool Hub.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Service Executor                         │
│  - Orchestrate execution với fail-over                      │
│  - Credential selection strategies                           │
│  - Error handling & retry logic                             │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Tool Service Bindings                       │
│  - Map tool → service profile                               │
│  - Primary + fallback providers                             │
│  - Tool-specific overrides                                  │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Profiles                          │
│  - Group credentials vào pools                              │
│  - Profile-level settings                                   │
│  - Selection strategy                                       │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Credential Pool                            │
│  - Chọn credential theo strategy                            │
│  - Track usage, quota, health                               │
│  - Auto cooldown/exhausted management                       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Service Executor
`service-executor.ts`

Main orchestrator để execute service requests với fail-over.

```typescript
import { serviceExecutor } from '@/lib/service-provider';

const result = await serviceExecutor.execute(
  {
    tool_code: 'rag-search',
    capability: 'ai.embed',
    payload: { text: query },
    options: {
      strategy: 'round_robin',
      retry: true,
      maxRetries: 3,
    },
  },
  async (credential, overrides) => {
    // Handler implementation
    const apiKey = credential.secret_encrypted;
    // Call external API...
    return data;
  }
);
```

### 2. Credential Pool
`credential-pool.ts`

Quản lý một pool credentials với selection strategies:

- `round_robin`: Xoay vòng
- `least_used`: Ít quota used nhất
- `priority`: Priority cao nhất
- `weighted`: Random theo weight
- `available_first`: Available đầu tiên

```typescript
const pool = new CredentialPool(credentials);
const cred = pool.selectCredential('round_robin');
```

### 3. Types
`types.ts`

Định nghĩa types cho toàn bộ system.

### 4. Crypto
`crypto.ts`

Encrypt/decrypt credentials (TODO: implement proper encryption).

## Database Tables

### `service_providers`
Loại service (Gemini, iLovePDF, Google Drive...)

### `service_profiles`
Profile/pool trong một provider

### `service_credentials`
Credentials cụ thể với quota tracking

### `tool_service_bindings`
Map tool → profile với overrides

### `tool_settings`
Tool-only settings (không thuộc provider)

## Usage Examples

### Example 1: RAG Search với Gemini

```typescript
const result = await serviceExecutor.execute<{ embedding: number[] }>(
  {
    tool_code: 'rag-search',
    capability: 'ai.embed',
    payload: { text: query },
  },
  async (credential, overrides) => {
    const apiKey = credential.secret_encrypted;
    const model = overrides.model ?? 'text-embedding-004';
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      { method: 'POST', ... }
    );
    
    const data = await response.json();
    return { embedding: data.embedding.values };
  }
);
```

### Example 2: PDF Compress với Fail-over

```typescript
// Binding config:
// Primary: iLovePDF
// Fallback: CloudConvert

const result = await serviceExecutor.execute(
  {
    tool_code: 'pdf-compress',
    capability: 'pdf.compress',
    payload: { file: blob },
  },
  async (credential, overrides) => {
    // Executor tự động chọn provider (iLovePDF hoặc CloudConvert)
    // Handler implement logic cho cả 2 providers
    
    if (overrides.provider_code === 'ilovepdf') {
      // Use iLovePDF API
    } else if (overrides.provider_code === 'cloudconvert') {
      // Use CloudConvert API
    }
  }
);
```

## Error Handling

Service Executor tự động classify errors:

| Error Type | Status | Action |
|------------|--------|--------|
| RATE_LIMIT | cooldown | Set cooldown 5min, retry next credential |
| QUOTA_EXCEEDED | exhausted | Mark exhausted, retry next credential |
| INVALID_KEY | invalid | Mark invalid, skip (no retry) |
| TIMEOUT | - | Retry next credential |
| NETWORK_ERROR | - | Retry next credential |

## Credential Status Flow

```
active
  ├─→ cooldown (rate limit) ──[auto reset]──→ active
  ├─→ exhausted (quota full) ──[quota reset]──→ active
  ├─→ invalid (bad key) ──[manual fix]──→ active
  └─→ disabled (manual) ──[manual enable]──→ active
```

## Quota Management

Mỗi credential track:
- `quota_limit`: Max quota
- `quota_used`: Current usage
- `quota_reset_at`: Khi nào reset về 0

Auto-increment `quota_used` mỗi khi success.
Auto-reset về 0 khi `quota_reset_at` qua.

## Migration from Legacy

### Old Way (tool-centric)
```typescript
// Each tool stores its own API keys
const ragTokens = await loadRagTokens();
const compressConfig = await loadCompressConfig();
const driveConfig = await loadDriveConfig();
```

### New Way (provider-centric)
```typescript
// Shared credential pool
// Tools bind to profiles
// Executor handles everything

const result = await serviceExecutor.execute({ ... }, handler);
```

## Security

⚠️ **TODO**: Implement proper encryption

Current: Base64 encode (NOT SECURE)
Production: Use Web Crypto API hoặc cloud KMS

```typescript
// TODO
const encrypted = await encryptSecret(apiKey); // AES-256
const decrypted = await decryptSecret(encrypted);
```

## API Hooks

React Query hooks để manage providers/profiles/credentials:

```typescript
// Providers
const { data: providers } = useProviders();

// Profiles
const { data: profiles } = useProfiles(providerId);
const createProfile = useCreateProfile();
const updateProfile = useUpdateProfile();
const deleteProfile = useDeleteProfile();

// Credentials
const { data: credentials } = useCredentials(profileId);
const createCredential = useCreateCredential();
const updateCredential = useUpdateCredential();
const deleteCredential = useDeleteCredential();

// Bindings
const { data: bindings } = useBindings(toolCode);
const createBinding = useCreateBinding();
const updateBinding = useUpdateBinding();
const deleteBinding = useDeleteBinding();

// Tool Settings
const { data: settings } = useToolSettings(toolCode);
const updateSettings = useUpdateToolSettings();
```

## UI Components

### ServiceProviderTab
`src/components/setting/ServiceProviderTab.tsx`

Main management UI:
- View providers, profiles, credentials
- Monitor quota usage
- Enable/disable credentials
- View health status

### AddCredentialDialog
`src/components/setting/AddCredentialDialog.tsx`

Dialog để thêm credential mới với validation.

## Testing

```bash
# Unit tests
npm test src/lib/service-provider

# Integration tests
npm test src/lib/service-provider/integration
```

## Monitoring

```typescript
// Check pool status
import { checkPoolStatus } from '@/lib/service-provider/examples';
const status = await checkPoolStatus();

// Query views
SELECT * FROM v_active_credentials;
SELECT * FROM v_tool_bindings;
```

## Next Steps

- [ ] Implement proper secret encryption
- [ ] Add RLS policies for multi-tenant
- [ ] Build monitoring dashboard
- [ ] Add webhook notifications
- [ ] Implement auto quota reset job
- [ ] Add more providers (CloudConvert, OCR, Email)
- [ ] Add circuit breaker pattern
- [ ] Add request rate limiting per credential
- [ ] Add audit logging
