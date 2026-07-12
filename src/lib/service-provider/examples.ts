// ============================================================
// Service Provider Usage Examples
// ============================================================

import { serviceExecutor } from './service-executor';
import type { ServiceCredential, GeminiOverrides, ILovePDFOverrides } from './types';

// ============================================================
// Example 1: RAG Search với Gemini
// ============================================================

export async function ragSearchExample(query: string) {
    const result = await serviceExecutor.execute<{ embedding: number[] }>(
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
            // Handler thực hiện API call với credential
            const geminiOverrides = overrides as GeminiOverrides;
            const apiKey = credential.secret_encrypted;

            if (!apiKey) {
                throw new Error('No API key found in credential');
            }

            // Gọi Gemini API
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${geminiOverrides.model ?? 'text-embedding-004'}:embedContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: { parts: [{ text: query }] },
                    }),
                },
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message ?? 'Gemini API error');
            }

            const data = await response.json();
            return {
                embedding: data.embedding?.values ?? [],
            };
        },
    );

    if (result.success) {
        console.log('Embedding generated:', result.data?.embedding.length, 'dimensions');
        console.log('Used provider:', result.metadata.provider_code);
        console.log('Attempts:', result.metadata.attempts);
    } else {
        console.error('Failed:', result.error?.message);
        console.error('Error code:', result.error?.code);
    }

    return result;
}

// ============================================================
// Example 2: AI Chat Generation
// ============================================================

export async function generateEmailExample(prompt: string) {
    const result = await serviceExecutor.execute<{ text: string }>(
        {
            tool_code: 'email-generator',
            capability: 'ai.generate',
            payload: { prompt },
            options: {
                strategy: 'least_used',
                overrides: {
                    model: 'gemini-1.5-pro',
                    temperature: 0.8,
                    maxOutputTokens: 1000,
                },
            },
        },
        async (credential, overrides) => {
            const geminiOverrides = overrides as GeminiOverrides;
            const apiKey = credential.secret_encrypted;

            if (!apiKey) {
                throw new Error('No API key found');
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${geminiOverrides.model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: geminiOverrides.temperature,
                            maxOutputTokens: geminiOverrides.maxOutputTokens,
                        },
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

            return { text };
        },
    );

    return result;
}

// ============================================================
// Example 3: PDF Compress với iLovePDF
// ============================================================

export async function compressPdfExample(fileBlob: Blob) {
    const result = await serviceExecutor.execute<{ compressedUrl: string }>(
        {
            tool_code: 'pdf-compress',
            capability: 'pdf.compress',
            payload: { file: fileBlob },
        },
        async (credential, overrides) => {
            const pdfOverrides = overrides as ILovePDFOverrides;
            const publicKey = credential.public_data.public_key as string;

            // Simplified iLovePDF flow
            // 1. Start task
            const startResponse = await fetch('https://api.ilovepdf.com/v1/start/compress', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${publicKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!startResponse.ok) {
                throw new Error('Failed to start compress task');
            }

            const { server, task } = await startResponse.json();

            // 2. Upload file
            const formData = new FormData();
            formData.append('task', task);
            formData.append('file', fileBlob);

            const uploadResponse = await fetch(`https://${server}/v1/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file');
            }

            // 3. Process
            const processResponse = await fetch(`https://${server}/v1/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task,
                    compression_level: pdfOverrides.compressionLevel ?? 'recommended',
                }),
            });

            if (!processResponse.ok) {
                throw new Error('Failed to process file');
            }

            const { download_filename } = await processResponse.json();

            return {
                compressedUrl: `https://${server}/v1/download/${task}/${download_filename}`,
            };
        },
    );

    return result;
}

// ============================================================
// Example 4: Multiple Providers với Fallback
// ============================================================

export async function convertFileWithFallback(file: Blob, targetFormat: string) {
    // Primary: iLovePDF
    // Fallback: CloudConvert
    // Service executor tự động thử fallback nếu primary fail

    const result = await serviceExecutor.execute<{ convertedUrl: string }>(
        {
            tool_code: 'file-converter',
            capability: 'conversion.convert',
            payload: { file, targetFormat },
        },
        async (credential, overrides) => {
            // Handler này sẽ được gọi với credential từ primary hoặc fallback provider
            // Không cần biết đang dùng provider nào - executor handle logic đó

            const providerCode = overrides.provider_code as string;

            if (providerCode === 'ilovepdf') {
                // Use iLovePDF API
                return { convertedUrl: 'ilovepdf://...' };
            } else if (providerCode === 'cloudconvert') {
                // Use CloudConvert API
                return { convertedUrl: 'cloudconvert://...' };
            }

            throw new Error(`Unknown provider: ${providerCode}`);
        },
    );

    return result;
}

// ============================================================
// Example 5: Credential Pool Status Check
// ============================================================

export async function checkPoolStatus() {
    // Có thể query trực tiếp database để xem pool status
    // Hoặc dùng API endpoints để monitor

    const { data: credentials } = await import('@/lib/library/supabase').then((m) =>
        m.supabase
            .from('service_credentials')
            .select(
                `
        *,
        profile:service_profiles!inner(
          name,
          provider:service_providers!inner(code, name)
        )
      `,
            )
            .in('status', ['active', 'cooldown', 'exhausted']),
    );

    // Group by provider
    const byProvider: Record<string, any[]> = {};

    for (const cred of credentials ?? []) {
        const providerCode = cred.profile.provider.code;
        if (!byProvider[providerCode]) {
            byProvider[providerCode] = [];
        }
        byProvider[providerCode].push(cred);
    }

    return byProvider;
}
