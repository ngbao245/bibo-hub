import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';
import { useAuthStore } from '@/stores/authStore';

const BUCKET = 'avatars';

export interface AvatarPreset {
  name: string;
  url: string;
}

async function fetchAvatarPresets(): Promise<AvatarPreset[]> {
  const { data, error } = await authClient.storage.from(BUCKET).list('', {
    limit: 100,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(error.message);
  if (!data) return [];

  return data
    .filter((f) => f.metadata && typeof f.metadata.size === 'number')
    .map((f) => ({
      name: f.name,
      url: authClient.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
    }));
}

export function useAvatarPresets() {
  return useQuery({
    queryKey: ['avatarPresets'],
    queryFn: fetchAvatarPresets,
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (avatarPath: string | null) => {
      const userId = useAuthStore.getState().session?.user.id;
      if (!userId) throw new Error('Not authenticated');
      const { error } = await authClient
        .from('profiles')
        .update({ avatar_url: avatarPath })
        .eq('id', userId);
      if (error) throw new Error(error.message);
      return avatarPath;
    },
    onMutate: (avatarPath) => {
      const profile = useAuthStore.getState().profile;
      const previousAvatar = profile?.avatar_url ?? null;
      // Optimistic: update store ngay
      if (profile) {
        useAuthStore.getState().setProfile({ ...profile, avatar_url: avatarPath });
      }
      return { previousAvatar };
    },
    onError: (_err, _vars, context) => {
      // Rollback về avatar cũ
      const profile = useAuthStore.getState().profile;
      if (profile && context) {
        useAuthStore.getState().setProfile({ ...profile, avatar_url: context.previousAvatar });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['avatarPresets'] });
    },
  });
}

/** Build public URL cho avatar path. Trả null nếu path null/empty. */
export function getAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return authClient.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}