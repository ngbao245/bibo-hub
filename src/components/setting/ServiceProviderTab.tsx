// ============================================================
// Service Provider Management Tab
// ============================================================

import { useState } from 'react';
import { Loader2, Plus, Trash2, Edit, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

import {
    useProviders,
    useProfiles,
    useCredentials,
    useCreateCredential,
    useUpdateCredential,
    useDeleteCredential,
} from '@/api/serviceProvider';
import type { ServiceProvider, ServiceProfile, ServiceCredential } from '@/lib/service-provider/types';
import { LoadingState, EmptyState } from '@/components/shared';

export default function ServiceProviderTab() {
    const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
    const [selectedProfile, setSelectedProfile] = useState<ServiceProfile | null>(null);

    const { data: providers, isLoading: loadingProviders } = useProviders();
    const { data: profiles, isLoading: loadingProfiles } = useProfiles(selectedProvider?.id);
    const { data: credentials, isLoading: loadingCredentials } = useCredentials(selectedProfile?.id);

    if (loadingProviders) {
        return <LoadingState />;
    }

    return (
        <div className="grid h-full grid-cols-3 gap-4">
            {/* Providers List */}
            <div className="flex flex-col gap-2 border-r pr-4">
                <h3 className="text-sm font-semibold">Service Providers</h3>
                <div className="flex flex-col gap-1">
                    {providers?.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => {
                                setSelectedProvider(provider);
                                setSelectedProfile(null);
                            }}
                            className={`rounded px-3 py-2 text-left text-sm transition-colors ${selectedProvider?.id === provider.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted'
                                }`}
                        >
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-xs opacity-70">{provider.category}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Profiles List */}
            <div className="flex flex-col gap-2 border-r pr-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Profiles</h3>
                    {selectedProvider && (
                        <button
                            className="rounded p-1 hover:bg-muted"
                            onClick={() => toast.info('Create profile - Coming soon')}
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {!selectedProvider && (
                    <EmptyState message="Select a provider to view profiles" />
                )}

                {selectedProvider && loadingProfiles && <LoadingState />}

                {selectedProvider && !loadingProfiles && (
                    <div className="flex flex-col gap-1">
                        {profiles?.length === 0 && (
                            <EmptyState message="No profiles configured" />
                        )}
                        {profiles?.map((profile) => (
                            <button
                                key={profile.id}
                                onClick={() => setSelectedProfile(profile)}
                                className={`rounded px-3 py-2 text-left text-sm transition-colors ${selectedProfile?.id === profile.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-muted'
                                    }`}
                            >
                                <div className="font-medium">{profile.name}</div>
                                <div className="text-xs opacity-70">{profile.status}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Credentials List */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Credentials</h3>
                    {selectedProfile && (
                        <button
                            className="rounded p-1 hover:bg-muted"
                            onClick={() => toast.info('Add credential - Coming soon')}
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {!selectedProfile && (
                    <EmptyState message="Select a profile to view credentials" />
                )}

                {selectedProfile && loadingCredentials && <LoadingState />}

                {selectedProfile && !loadingCredentials && (
                    <div className="flex flex-col gap-2">
                        {credentials?.length === 0 && (
                            <EmptyState message="No credentials configured" />
                        )}
                        {credentials?.map((cred) => (
                            <CredentialCard key={cred.id} credential={cred} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// Credential Card Component
// ============================================================

function CredentialCard({ credential }: { credential: ServiceCredential }) {
    const updateMutation = useUpdateCredential();
    const deleteMutation = useDeleteCredential();

    const statusIcon = {
        active: <CheckCircle className="h-4 w-4 text-green-500" />,
        disabled: <XCircle className="h-4 w-4 text-gray-400" />,
        exhausted: <XCircle className="h-4 w-4 text-red-500" />,
        cooldown: <Clock className="h-4 w-4 text-yellow-500" />,
        invalid: <XCircle className="h-4 w-4 text-red-500" />,
        error: <XCircle className="h-4 w-4 text-red-500" />,
    };

    const handleToggleStatus = async () => {
        const newStatus = credential.status === 'active' ? 'disabled' : 'active';
        await updateMutation.mutateAsync({
            ...credential,
            status: newStatus,
        });
        toast.success(`Credential ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    };

    const handleDelete = async () => {
        if (!confirm('Delete this credential?')) return;
        await deleteMutation.mutateAsync(credential.id);
        toast.success('Credential deleted');
    };

    return (
        <div className="rounded border p-3">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        {statusIcon[credential.status]}
                        <span className="text-sm font-medium">
                            {credential.name || credential.identifier || 'Unnamed'}
                        </span>
                    </div>

                    {credential.identifier && (
                        <div className="mt-1 text-xs text-muted-foreground">
                            {credential.identifier}
                        </div>
                    )}

                    {credential.quota_limit && (
                        <div className="mt-2 text-xs">
                            <div className="flex justify-between">
                                <span>Quota:</span>
                                <span>
                                    {credential.quota_used} / {credential.quota_limit}
                                </span>
                            </div>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full bg-primary"
                                    style={{
                                        width: `${Math.min(100, (credential.quota_used / credential.quota_limit) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {credential.last_success_at && (
                        <div className="mt-1 text-xs text-muted-foreground">
                            Last success: {new Date(credential.last_success_at).toLocaleString()}
                        </div>
                    )}

                    {credential.last_error_at && (
                        <div className="mt-1 text-xs text-red-500">
                            Last error: {credential.last_error_message}
                        </div>
                    )}

                    {credential.cooldown_until && new Date(credential.cooldown_until) > new Date() && (
                        <div className="mt-1 text-xs text-yellow-600">
                            Cooldown until: {new Date(credential.cooldown_until).toLocaleString()}
                        </div>
                    )}
                </div>

                <div className="flex gap-1">
                    <button
                        onClick={handleToggleStatus}
                        className="rounded p-1 hover:bg-muted"
                        disabled={updateMutation.isPending}
                    >
                        {updateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Edit className="h-4 w-4" />
                        )}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="rounded p-1 hover:bg-muted"
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4 text-red-500" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
