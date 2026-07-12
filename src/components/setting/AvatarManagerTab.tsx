import { useRef, useState } from 'react';
import { Plus, Trash2, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useAvatarPresets } from '@/api/avatars';
import { authClient } from '@/lib/authClient';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared';

const BUCKET = 'avatars';

export default function AvatarManagerTab() {
  const presetsQuery = useAvatarPresets();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter((f) =>
      /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f.name),
    );
    if (accepted.length === 0) {
      toast.error('Chỉ hỗ trợ ảnh (png, jpg, webp, gif, svg)');
      return;
    }

    setUploading(true);
    let success = 0;
    for (const file of accepted) {
      const { error } = await authClient.storage
        .from(BUCKET)
        .upload(file.name, file, { upsert: true });
      if (error) {
        toast.error(`Upload fail: ${file.name} — ${error.message}`);
      } else {
        success++;
      }
    }
    setUploading(false);
    if (success > 0) {
      toast.success(`Đã upload ${success} avatar`);
      presetsQuery.refetch();
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Xoá avatar "${name}"?`)) return;
    const { error } = await authClient.storage.from(BUCKET).remove([name]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Đã xoá ${name}`);
    presetsQuery.refetch();
  }

  if (presetsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const presets = presetsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Avatar Presets</h3>
          <p className="text-xs text-muted-foreground">
            Upload ảnh vào thư viện avatar. User chọn từ đây trong My Account.
          </p>
        </div>
        {presets.length > 0 && (
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-1"
          >
            {uploading ? (
              <Upload className="h-4 w-4 animate-pulse" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {presets.length === 0 ? (
        <EmptyState
          compact
          icon={ImageIcon}
          title="Chưa có avatar nào"
          description="Upload ảnh để tạo thư viện avatar cho user."
          action={
            <Button onClick={() => fileInputRef.current?.click()} className="gap-1">
              <Plus className="h-4 w-4" />
              Upload avatar đầu tiên
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
          {presets.map((preset) => (
            <div key={preset.name} className="group relative aspect-square overflow-hidden rounded-full border border-border">
              <img
                src={preset.url}
                alt={preset.name}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => handleDelete(preset.name)}
                className="absolute right-0.5 top-0.5 hidden bg-background/80 p-1 text-destructive hover:bg-destructive hover:text-white group-hover:block"
                title={`Xoá ${preset.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
              <p className="absolute inset-x-0 bottom-0 truncate bg-background/70 px-1 py-0.5 text-center text-[9px] text-muted-foreground">
                {preset.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}