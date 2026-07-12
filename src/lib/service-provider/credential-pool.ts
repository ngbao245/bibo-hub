// ============================================================
// Credential Pool Manager
// ============================================================
// Quản lý việc chọn credential từ pool, track usage, handle fail-over

import type {
    ServiceCredential,
    SelectionStrategy,
    CredentialStatus,
} from './types';

export class CredentialPool {
    private credentials: ServiceCredential[];
    private lastUsedIndex = -1;

    constructor(credentials: ServiceCredential[]) {
        this.credentials = credentials;
    }

    /**
     * Lấy credential khả dụng theo strategy
     */
    selectCredential(strategy: SelectionStrategy = 'available_first'): ServiceCredential | null {
        const available = this.getAvailableCredentials();

        if (available.length === 0) {
            return null;
        }

        switch (strategy) {
            case 'priority':
                return this.selectByPriority(available);
            case 'round_robin':
                return this.selectRoundRobin(available);
            case 'least_used':
                return this.selectLeastUsed(available);
            case 'weighted':
                return this.selectWeighted(available);
            case 'available_first':
            default:
                return available[0];
        }
    }

    /**
     * Lọc credentials có thể sử dụng
     */
    private getAvailableCredentials(): ServiceCredential[] {
        const now = new Date();

        return this.credentials.filter((cred) => {
            // Bỏ qua credential không active
            if (cred.status !== 'active' && cred.status !== 'cooldown') {
                return false;
            }

            // Bỏ qua credential đang cooldown
            if (cred.cooldown_until) {
                const cooldownDate = new Date(cred.cooldown_until);
                if (cooldownDate > now) {
                    return false;
                }
            }

            // Bỏ qua credential đã exhausted quota
            if (cred.quota_limit && cred.quota_used >= cred.quota_limit) {
                // Check if quota has reset
                if (cred.quota_reset_at) {
                    const resetDate = new Date(cred.quota_reset_at);
                    if (resetDate > now) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Chọn theo priority cao nhất
     */
    private selectByPriority(available: ServiceCredential[]): ServiceCredential {
        return available.sort((a, b) => b.priority - a.priority)[0];
    }

    /**
     * Chọn theo round-robin
     */
    private selectRoundRobin(available: ServiceCredential[]): ServiceCredential {
        this.lastUsedIndex = (this.lastUsedIndex + 1) % available.length;
        return available[this.lastUsedIndex];
    }

    /**
     * Chọn credential ít được dùng nhất
     */
    private selectLeastUsed(available: ServiceCredential[]): ServiceCredential {
        return available.sort((a, b) => a.quota_used - b.quota_used)[0];
    }

    /**
     * Chọn theo trọng số (weighted random)
     */
    private selectWeighted(available: ServiceCredential[]): ServiceCredential {
        const totalWeight = available.reduce((sum, cred) => sum + cred.weight, 0);
        let random = Math.random() * totalWeight;

        for (const cred of available) {
            random -= cred.weight;
            if (random <= 0) {
                return cred;
            }
        }

        return available[0];
    }

    /**
     * Đánh dấu credential thành công
     */
    markSuccess(credentialId: string): void {
        const cred = this.credentials.find((c) => c.id === credentialId);
        if (cred) {
            cred.quota_used += 1;
            cred.last_used_at = new Date().toISOString();
            cred.last_success_at = new Date().toISOString();
            cred.status = 'active';
        }
    }

    /**
     * Đánh dấu credential thất bại
     */
    markFailure(
        credentialId: string,
        errorCode: string,
        errorMessage: string,
        options: {
            setCooldown?: boolean;
            cooldownMinutes?: number;
            markExhausted?: boolean;
            markInvalid?: boolean;
        } = {},
    ): void {
        const cred = this.credentials.find((c) => c.id === credentialId);
        if (!cred) return;

        cred.last_used_at = new Date().toISOString();
        cred.last_error_at = new Date().toISOString();
        cred.last_error_code = errorCode;
        cred.last_error_message = errorMessage;

        if (options.markInvalid) {
            cred.status = 'invalid';
        } else if (options.markExhausted) {
            cred.status = 'exhausted';
        } else if (options.setCooldown) {
            cred.status = 'cooldown';
            const cooldownMs = (options.cooldownMinutes ?? 5) * 60 * 1000;
            cred.cooldown_until = new Date(Date.now() + cooldownMs).toISOString();
        } else {
            cred.status = 'error';
        }
    }

    /**
     * Reset quota nếu đã qua thời gian reset
     */
    checkAndResetQuota(): void {
        const now = new Date();

        for (const cred of this.credentials) {
            if (cred.quota_reset_at) {
                const resetDate = new Date(cred.quota_reset_at);
                if (resetDate <= now) {
                    cred.quota_used = 0;
                    if (cred.status === 'exhausted') {
                        cred.status = 'active';
                    }
                }
            }
        }
    }

    /**
     * Kiểm tra xem còn credential nào khả dụng không
     */
    hasAvailableCredentials(): boolean {
        return this.getAvailableCredentials().length > 0;
    }

    /**
     * Lấy thống kê pool
     */
    getStats() {
        const total = this.credentials.length;
        const byStatus: Partial<Record<CredentialStatus, number>> = {};

        for (const cred of this.credentials) {
            byStatus[cred.status] = (byStatus[cred.status] ?? 0) + 1;
        }

        return {
            total,
            available: this.getAvailableCredentials().length,
            byStatus,
        };
    }
}
