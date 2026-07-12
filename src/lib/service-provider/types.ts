// ============================================================
// Service Provider Types
// ============================================================

export type ProviderCategory =
    | 'ai'
    | 'pdf'
    | 'storage'
    | 'realtime'
    | 'networking'
    | 'conversion'
    | 'ocr'
    | 'email';

export type ProviderStatus = 'active' | 'deprecated' | 'disabled';

export interface ServiceProvider {
    id: string;
    code: string;
    name: string;
    category: ProviderCategory;
    description?: string;
    status: ProviderStatus;
    created_at: string;
    updated_at: string;
}

// ============================================================
// Service Profile
// ============================================================

export type ProfileStatus = 'active' | 'disabled' | 'archived';

export interface ServiceProfile {
    id: string;
    provider_id: string;
    name: string;
    description?: string;
    status: ProfileStatus;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// ============================================================
// Service Credential
// ============================================================

export type CredentialStatus =
    | 'active'
    | 'disabled'
    | 'exhausted'
    | 'cooldown'
    | 'invalid'
    | 'error';

export interface ServiceCredential {
    id: string;
    profile_id: string;
    name?: string;
    identifier?: string;
    public_data: Record<string, unknown>;
    secret_encrypted?: string;
    status: CredentialStatus;
    priority: number;
    weight: number;
    quota_limit?: number;
    quota_used: number;
    quota_reset_at?: string;
    last_used_at?: string;
    last_success_at?: string;
    last_error_at?: string;
    last_error_code?: string;
    last_error_message?: string;
    cooldown_until?: string;
    created_at: string;
    updated_at: string;
}

// ============================================================
// Tool Service Binding
// ============================================================

export interface ToolServiceBinding {
    id: string;
    tool_code: string;
    capability: string;
    profile_id: string;
    is_primary: boolean;
    priority: number;
    enabled: boolean;
    overrides: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// ============================================================
// Tool Settings
// ============================================================

export interface ToolSettings {
    id: string;
    tool_code: string;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// ============================================================
// Credential Selection Strategy
// ============================================================

export type SelectionStrategy =
    | 'round_robin'
    | 'least_used'
    | 'priority'
    | 'available_first'
    | 'weighted';

// ============================================================
// Service Execution Context
// ============================================================

export interface ExecutionContext {
    tool_code: string;
    capability: string;
    payload?: unknown;
    options?: ExecutionOptions;
}

export interface ExecutionOptions {
    /** Override selection strategy */
    strategy?: SelectionStrategy;
    /** Retry on failure */
    retry?: boolean;
    /** Max retry attempts */
    maxRetries?: number;
    /** Timeout in ms */
    timeout?: number;
    /** Custom overrides */
    overrides?: Record<string, unknown>;
}

export interface ExecutionResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: ExecutionError;
    metadata: ExecutionMetadata;
}

export interface ExecutionError {
    code: string;
    message: string;
    provider?: string;
    credential?: string;
    retryable: boolean;
}

export interface ExecutionMetadata {
    provider_code: string;
    profile_name: string;
    credential_id: string;
    attempts: number;
    duration_ms: number;
    timestamp: string;
}

// ============================================================
// Provider-specific Types
// ============================================================

// Gemini
export interface GeminiOverrides {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
}

// iLovePDF
export type CompressionLevel = 'low' | 'recommended' | 'extreme';

export interface ILovePDFOverrides {
    operation?: string;
    compressionLevel?: CompressionLevel;
    maxFileSize?: number;
}

// Google Drive
export interface GoogleDriveOverrides {
    folderId?: string;
    mimeType?: string;
    keepRevisions?: number;
}
