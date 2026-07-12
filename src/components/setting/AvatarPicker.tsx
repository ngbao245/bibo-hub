import { Check } from 'lucide-react';
import { toast } from 'sonner';

import { useAvatarPresets, useUpdateAvatar } from '@/api/avatars';
import { useAuthStore } from '@/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared';
import { cn } from '@/lib/cn';

export default function AvatarPicker() {
  const profile = useAuthStore((s) => s.profile);
  const presetsQuery = useAvatarPresets();
  const updateAvatar = useUpdateAvatar();

  const currentAvatar = profile?.avatar_url ?? null;

  function handleSelect(name: string) {
    const newValue = name === currentAvatar ? null : name;
    updateAvatar.mutate(newValue, {
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Update fail');
      },
    });
  }

  if (presetsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (presetsQuery.isError) {
    return (
      <ErrorState
        compact
        message={presetsQuery.error instanceof Error ? presetsQuery.error.message : 'Không load được avatar presets'}
        onRetry={() => presetsQuery.refetch()}
      />
    );
  }

  const presets = presetsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-medium text-foreground">Avatar</h4>
        <p className="text-[11px] text-muted-foreground">
          Chọn avatar từ thư viện. Bấm lần nữa để bỏ chọn.
        </p>
      </div>

      {presets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Chưa có avatar nào. Admin upload vào bucket "avatars" trên Supabase.
        </p>
      ) : (
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {presets.map((preset) => {
            const isSelected = currentAvatar === preset.name;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelect(preset.name)}
                disabled={updateAvatar.isPending}
                className={cn(
                  'relative aspect-square rounded-full border-2 shadow-sm transition-all hover:opacity-80',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-muted-foreground/30',
                )}
              >
                <div
                  className="absolute inset-0 rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${preset.url})` }}
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/20">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}