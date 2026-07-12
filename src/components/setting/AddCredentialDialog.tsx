// ============================================================
// Add Credential Dialog
// ============================================================

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useCreateCredential } from '@/api/serviceProvider';
import { encryptSecret, validateApiKey, generateCredentialId } from '@/lib/service-provider/crypto';
import type { ServiceProfile } from '@/lib/service-provider/types';

interface AddCredentialDialogProps {
    profile: ServiceProfile;
    providerCode: string;
    onClose: () => void;
}

export default function AddCredentialDialog({
    profile,
    providerCode,
    onClose,
}: AddCredentialDialogProps) {
    const [formData, setFormData] = useState({
        name: '',
        identifier: '',
        apiKey: '',
        priority: 0,
        weight: 1,
        quotaLimit: '',
    });

    const createMutation = useCreateCredential();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.apiKey) {
            toast.error('API key is required');
            return;
        }

        if (!validateApiKey(formData.apiKey, providerCode)) {
            toast.error(`Invalid API key format for ${providerCode}`);
            return;
        }

        try {
            // Encrypt secret
            const encrypted = await encryptSecret(formData.apiKey);

            // Create credential
            await createMutation.mutateAsync({
                profile_id: profile.id,
                name: formData.name || undefined,
                identifier: formData.identifier || generateCredentialId(),
                public_data: {},
                secret_encrypted: encrypted,
                status: 'active',
                priority: formData.priority,
                weight: formData.weight,
                quota_limit: formData.quotaLimit ? parseInt(formData.quotaLimit) : undefined,
                quota_used: 0,
            });

            toast.success('Credential added successfully');
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to add credential');
        }
    };

    const getPlaceholder = () => {
        switch (providerCode) {
            case 'gemini':
                return 'AIzaSy...';
            case 'ilovepdf':
                return 'project_public_...';
            case 'google_drive':
                return 'client_id.apps.googleusercontent.com';
            default:
                return 'Enter API key or token';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
                <h2 className="mb-4 text-lg font-semibold">Add Credential</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                    Profile: <span className="font-medium">{profile.name}</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">
                            Name <span className="text-xs text-muted-foreground">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="My API Key"
                            className="w-full rounded border bg-background px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Identifier */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">
                            Identifier <span className="text-xs text-muted-foreground">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.identifier}
                            onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                            placeholder="Auto-generated if empty"
                            className="w-full rounded border bg-background px-3 py-2 text-sm"
                        />
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">
                            API Key / Token <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={formData.apiKey}
                            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                            placeholder={getPlaceholder()}
                            className="w-full rounded border bg-background px-3 py-2 text-sm font-mono"
                            required
                        />
                    </div>

                    {/* Priority & Weight */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium">Priority</label>
                            <input
                                type="number"
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                min="0"
                                className="w-full rounded border bg-background px-3 py-2 text-sm"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">Higher = used first</p>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium">Weight</label>
                            <input
                                type="number"
                                value={formData.weight}
                                onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                                min="1"
                                className="w-full rounded border bg-background px-3 py-2 text-sm"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">For weighted selection</p>
                        </div>
                    </div>

                    {/* Quota Limit */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">
                            Quota Limit <span className="text-xs text-muted-foreground">(optional)</span>
                        </label>
                        <input
                            type="number"
                            value={formData.quotaLimit}
                            onChange={(e) => setFormData({ ...formData, quotaLimit: e.target.value })}
                            placeholder="No limit"
                            className="w-full rounded border bg-background px-3 py-2 text-sm"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            {providerCode === 'gemini' && 'Default: 1500 requests/day (free tier)'}
                            {providerCode === 'ilovepdf' && 'Check your plan quota'}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded border px-4 py-2 text-sm hover:bg-muted"
                            disabled={createMutation.isPending}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Add Credential
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
