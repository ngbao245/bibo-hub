// ============================================================
// Service Executor
// ============================================================
// Orchestrator chính để execute service request với fail-over

import { CredentialPool } from './credential-pool';
import { supabase } from '@/lib/library/supabase';
import type {
    ExecutionContext,
    ExecutionResult,
    ExecutionError,
    ServiceCredential,
    ToolServiceBinding,
    ServiceProfile,
    ServiceProvider,
} from './types';

export class ServiceExecutor {
    /**
     * Execute service request với auto fail-over
     */
    async execute<T = unknown>(
        context: ExecutionContext,
        handler: (credential: ServiceCredential, overrides: Record<string, unknown>) => Promise<T>,
    ): Promise<ExecutionResult<T>> {
        const startTime = Date.now();
        const { tool_code, capability, options = {} } = context;

        try {
            // 1. Load bindings cho tool + capability
            const bindings = await this.loadBindings(tool_code, capability);

            if (bindings.length === 0) {
                return this.createErrorResult(
                    {
                        code: 'NO_BINDING',
                        message: `No service binding configured for ${tool_code}.${capability}`,
                        retryable: false,
                    },
                    { provider_code: '', profile_name: '', credential_id: '', attempts: 0, duration_ms: Date.now() - startTime, timestamp: new Date().toISOString() },
                );
            }

            // 2. Sort bindings theo priority (primary trước, fallback sau)
            bindings.sort((a, b) => a.priority - b.priority);

            // 3. Thử từng binding cho đến khi thành công
            let lastError: ExecutionError | undefined;

            for (const binding of bindings) {
                const result = await this.tryBinding<T>(binding, handler, context, startTime);

                if (result.success) {
                    return result;
                }

                lastError = result.error;

                // Nếu error không retryable, dừng ngay
                if (!result.error?.retryable) {
                    break;
                }
            }

            // 4. Tất cả bindings đều fail
            return this.createErrorResult(
                lastError ?? {
                    code: 'ALL_BINDINGS_FAILED',
                    message: 'All service providers failed',
                    retryable: false,
                },
                { provider_code: '', profile_name: '', credential_id: '', attempts: bindings.length, duration_ms: Date.now() - startTime, timestamp: new Date().toISOString() },
            );
        } catch (error) {
            return this.createErrorResult(
                {
                    code: 'EXECUTOR_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    retryable: false,
                },
                { provider_code: '', profile_name: '', credential_id: '', attempts: 0, duration_ms: Date.now() - startTime, timestamp: new Date().toISOString() },
            );
        }
    }

    /**
     * Thử execute với một binding
     */
    private async tryBinding<T>(
        binding: ToolServiceBinding & { profile: ServiceProfile; provider: ServiceProvider },
        handler: (credential: ServiceCredential, overrides: Record<string, unknown>) => Promise<T>,
        context: ExecutionContext,
        startTime: number,
    ): Promise<ExecutionResult<T>> {
        const { profile, provider } = binding;
        const { options = {} } = context;

        try {
            // 1. Load credentials cho profile
            const credentials = await this.loadCredentials(profile.id);

            if (credentials.length === 0) {
                return this.createErrorResult(
                    {
                        code: 'NO_CREDENTIALS',
                        message: `No credentials configured for profile ${profile.name}`,
                        provider: provider.code,
                        retryable: true,
                    },
                    {
                        provider_code: provider.code,
                        profile_name: profile.name,
                        credential_id: '',
                        attempts: 0,
                        duration_ms: Date.now() - startTime,
                        timestamp: new Date().toISOString(),
                    },
                );
            }

            // 2. Tạo credential pool
            const pool = new CredentialPool(credentials);
            pool.checkAndResetQuota();

            // 3. Merge overrides: profile settings < binding overrides < context options
            const mergedOverrides = {
                ...profile.settings,
                ...binding.overrides,
                ...options.overrides,
            };

            // 4. Thử từng credential trong pool
            const maxRetries = options.maxRetries ?? 3;
            let attempts = 0;
            let lastError: ExecutionError | undefined;

            while (attempts < maxRetries) {
                const credential = pool.selectCredential(options.strategy);

                if (!credential) {
                    // Pool exhausted
                    break;
                }

                attempts++;

                try {
                    // Execute handler
                    const data = await handler(credential, mergedOverrides);

                    // Success - update credential status
                    await this.updateCredentialSuccess(credential.id);
                    pool.markSuccess(credential.id);

                    return {
                        success: true,
                        data,
                        metadata: {
                            provider_code: provider.code,
                            profile_name: profile.name,
                            credential_id: credential.id,
                            attempts,
                            duration_ms: Date.now() - startTime,
                            timestamp: new Date().toISOString(),
                        },
                    };
                } catch (error) {
                    // Failure - analyze error and update credential
                    const execError = this.parseError(error, provider.code, credential.id);
                    lastError = execError;

                    await this.updateCredentialFailure(credential.id, execError);
                    pool.markFailure(credential.id, execError.code, execError.message, {
                        setCooldown: execError.code.includes('RATE_LIMIT'),
                        markExhausted: execError.code.includes('QUOTA_EXCEEDED'),
                        markInvalid: execError.code.includes('INVALID_KEY'),
                    });

                    // Nếu không retryable, dừng ngay
                    if (!execError.retryable) {
                        break;
                    }
                }
            }

            // All credentials trong pool fail
            return this.createErrorResult(
                lastError ?? {
                    code: 'POOL_EXHAUSTED',
                    message: `All credentials exhausted for ${profile.name}`,
                    provider: provider.code,
                    retryable: true,
                },
                {
                    provider_code: provider.code,
                    profile_name: profile.name,
                    credential_id: '',
                    attempts,
                    duration_ms: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                },
            );
        } catch (error) {
            return this.createErrorResult(
                {
                    code: 'BINDING_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown binding error',
                    provider: provider.code,
                    retryable: true,
                },
                {
                    provider_code: provider.code,
                    profile_name: profile.name,
                    credential_id: '',
                    attempts: 0,
                    duration_ms: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                },
            );
        }
    }

    /**
     * Load bindings từ database
     */
    private async loadBindings(
        tool_code: string,
        capability: string,
    ): Promise<Array<ToolServiceBinding & { profile: ServiceProfile; provider: ServiceProvider }>> {
        const { data, error } = await supabase
            .from('tool_service_bindings')
            .select(
                `
        *,
        profile:service_profiles!inner(
          *,
          provider:service_providers!inner(*)
        )
      `,
            )
            .eq('tool_code', tool_code)
            .eq('capability', capability)
            .eq('enabled', true);

        if (error) {
            throw new Error(`Failed to load bindings: ${error.message}`);
        }

        return (data ?? []).map((row) => ({
            ...row,
            profile: row.profile,
            provider: row.profile.provider,
        }));
    }

    /**
     * Load credentials từ database
     */
    private async loadCredentials(profile_id: string): Promise<ServiceCredential[]> {
        const { data, error } = await supabase
            .from('service_credentials')
            .select('*')
            .eq('profile_id', profile_id)
            .in('status', ['active', 'cooldown'])
            .order('priority', { ascending: false });

        if (error) {
            throw new Error(`Failed to load credentials: ${error.message}`);
        }

        return data ?? [];
    }

    /**
     * Update credential sau khi thành công
     */
    private async updateCredentialSuccess(credential_id: string): Promise<void> {
        await supabase
            .from('service_credentials')
            .update({
                quota_used: supabase.rpc('increment', { row_id: credential_id }),
                last_used_at: new Date().toISOString(),
                last_success_at: new Date().toISOString(),
                status: 'active',
            })
            .eq('id', credential_id);
    }

    /**
     * Update credential sau khi thất bại
     */
    private async updateCredentialFailure(
        credential_id: string,
        error: ExecutionError,
    ): Promise<void> {
        const updates: Partial<ServiceCredential> = {
            last_used_at: new Date().toISOString(),
            last_error_at: new Date().toISOString(),
            last_error_code: error.code,
            last_error_message: error.message,
        };

        if (error.code.includes('RATE_LIMIT')) {
            updates.status = 'cooldown';
            updates.cooldown_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        } else if (error.code.includes('QUOTA_EXCEEDED')) {
            updates.status = 'exhausted';
        } else if (error.code.includes('INVALID_KEY')) {
            updates.status = 'invalid';
        } else {
            updates.status = 'error';
        }

        await supabase.from('service_credentials').update(updates).eq('id', credential_id);
    }

    /**
     * Parse error thành ExecutionError
     */
    private parseError(error: unknown, provider: string, credential: string): ExecutionError {
        const message = error instanceof Error ? error.message : String(error);

        // Phân tích error code
        let code = 'UNKNOWN_ERROR';
        let retryable = true;

        if (message.includes('rate limit') || message.includes('429')) {
            code = 'RATE_LIMIT';
            retryable = true;
        } else if (message.includes('quota') || message.includes('exceeded')) {
            code = 'QUOTA_EXCEEDED';
            retryable = true;
        } else if (message.includes('invalid') || message.includes('unauthorized') || message.includes('401')) {
            code = 'INVALID_KEY';
            retryable = false;
        } else if (message.includes('timeout')) {
            code = 'TIMEOUT';
            retryable = true;
        } else if (message.includes('network') || message.includes('ECONNREFUSED')) {
            code = 'NETWORK_ERROR';
            retryable = true;
        }

        return {
            code,
            message,
            provider,
            credential,
            retryable,
        };
    }

    /**
     * Tạo error result
     */
    private createErrorResult<T>(
        error: ExecutionError,
        metadata: ExecutionResult<T>['metadata'],
    ): ExecutionResult<T> {
        return {
            success: false,
            error,
            metadata,
        };
    }
}

// Singleton instance
export const serviceExecutor = new ServiceExecutor();
