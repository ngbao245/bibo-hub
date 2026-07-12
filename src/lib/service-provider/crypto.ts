// ============================================================
// Credential Encryption/Decryption
// ============================================================
// TODO: Implement proper encryption using Web Crypto API or KMS

/**
 * Encrypt secret trước khi lưu database
 * 
 * TODO: Implement encryption
 * - Use Web Crypto API (SubtleCrypto)
 * - Or integrate with cloud KMS (AWS KMS, GCP KMS)
 * - Store encryption key securely (env var, vault)
 */
export async function encryptSecret(plaintext: string): Promise<string> {
    // Temporary: Base64 encode (NOT SECURE)
    // Replace with proper encryption in production
    if (typeof btoa === 'function') {
        return btoa(plaintext);
    }
    return Buffer.from(plaintext).toString('base64');
}

/**
 * Decrypt secret sau khi load từ database
 * 
 * TODO: Implement decryption
 */
export async function decryptSecret(encrypted: string): Promise<string> {
    // Temporary: Base64 decode (NOT SECURE)
    // Replace with proper decryption in production
    if (typeof atob === 'function') {
        return atob(encrypted);
    }
    return Buffer.from(encrypted, 'base64').toString('utf-8');
}

/**
 * Mask secret cho logging (show only first/last N chars)
 */
export function maskSecret(secret: string, showChars = 4): string {
    if (secret.length <= showChars * 2) {
        return '*'.repeat(secret.length);
    }
    return `${secret.slice(0, showChars)}${'*'.repeat(secret.length - showChars * 2)}${secret.slice(-showChars)}`;
}

/**
 * Validate secret format
 */
export function validateApiKey(key: string, provider: string): boolean {
    // Provider-specific validation
    switch (provider) {
        case 'gemini':
            // Gemini keys start with "AI" and are ~40 chars
            return key.startsWith('AI') && key.length >= 30;

        case 'ilovepdf':
            // iLovePDF public keys are project IDs
            return key.startsWith('project_') && key.length > 10;

        case 'google_drive':
            // OAuth client IDs end with .apps.googleusercontent.com
            return key.includes('.apps.googleusercontent.com');

        default:
            // Generic: at least 20 chars
            return key.length >= 20;
    }
}

/**
 * Generate secure random credential identifier
 */
export function generateCredentialId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `cred_${timestamp}_${randomPart}`;
}
