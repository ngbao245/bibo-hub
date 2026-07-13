// ============================================================
// Service Registry — Type definitions
// ============================================================

export type ProviderCategory = 'ai' | 'pdf' | 'conversion' | 'storage' | 'realtime' | 'networking';

export type ProviderStatus = 'active' | 'disabled';

export type CredentialStatus = 'active' | 'disabled' | 'exhausted' | 'cooldown' | 'invalid' | 'error';

export type SelectionStrategy = 'round_robin' | 'least_used' | 'priority' | 'available_first';

export interface ServiceProvider {
  id: string;
  code: string;
  name: string;
  category: ProviderCategory;
  description: string | null;
  status: ProviderStatus;
  created_at: string;
  updated_at: string;
}

export interface ProfileSettings {
  keySelectionStrategy?: SelectionStrategy;
  defaultTimeout?: number;
  cooldownDuration?: number;
  defaultModel?: string;
  [key: string]: unknown;
}

export interface ServiceProfile {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  status: ProviderStatus;
  settings_json: ProfileSettings;
  created_at: string;
  updated_at: string;
}

export interface ServiceCredential {
  id: string;
  profile_id: string;
  name: string | null;
  identifier: string;
  secret_data_json: Record<string, unknown> | null;
  status: CredentialStatus;
  priority: number;
  weight: number;
  quota_limit: number | null;
  quota_used: number | null;
  quota_reset_at: string | null;
  last_used_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface BindingOverrides {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  compressionLevel?: string;
  operation?: string;
  [key: string]: unknown;
}

export interface ToolServiceBinding {
  id: string;
  tool_code: string;
  capability: string;
  profile_id: string | null;
  is_primary: boolean;
  priority: number;
  enabled: boolean;
  overrides_json: BindingOverrides;
  created_at: string;
  updated_at: string;
}

export interface ToolSettings {
  id: string;
  tool_code: string;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// --- Input types for mutations ---

export interface CreateProfileInput {
  provider_id: string;
  name: string;
  description?: string;
  status?: ProviderStatus;
  settings_json?: ProfileSettings;
}

export interface UpdateProfileInput {
  id: string;
  name?: string;
  description?: string | null;
  status?: ProviderStatus;
  settings_json?: ProfileSettings;
}

export interface CreateCredentialInput {
  profile_id: string;
  name?: string;
  identifier: string;
  secret_data_json?: Record<string, unknown>;
  status?: CredentialStatus;
  priority?: number;
  weight?: number;
  quota_limit?: number | null;
}

export interface UpdateCredentialInput {
  id: string;
  name?: string | null;
  identifier?: string;
  secret_data_json?: Record<string, unknown> | null;
  status?: CredentialStatus;
  priority?: number;
  weight?: number;
  quota_limit?: number | null;
  quota_used?: number | null;
  quota_reset_at?: string | null;
  cooldown_until?: string | null;
  last_used_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
}

export interface CreateBindingInput {
  tool_code: string;
  capability: string;
  profile_id: string;
  is_primary?: boolean;
  priority?: number;
  enabled?: boolean;
  overrides_json?: BindingOverrides;
}

export interface UpdateBindingInput {
  id: string;
  tool_code?: string;
  capability?: string;
  profile_id?: string | null;
  is_primary?: boolean;
  priority?: number;
  enabled?: boolean;
  overrides_json?: BindingOverrides;
}

export interface UpdateToolSettingsInput {
  tool_code: string;
  settings_json: Record<string, unknown>;
}

// --- Executor types ---

export interface ExecuteRequest {
  toolCode: string;
  capability: string;
  payload?: unknown;
}

export interface ExecuteResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  credentialUsed?: string;
  providerUsed?: string;
  failoverAttempts?: number;
}

export interface CredentialWithSecret {
  id: string;
  identifier: string;
  secret_data_json: Record<string, unknown>;
  priority: number;
  weight: number;
}