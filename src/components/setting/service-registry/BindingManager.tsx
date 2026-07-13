// ============================================================
// BindingManager — Manage tool-service bindings within pool settings
// ============================================================

import { useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useCreateBinding, useDeleteBinding } from '@/api/service-registry';
import type { ToolServiceBinding } from '@/lib/service-registry/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  profileId: string;
  bindings: ToolServiceBinding[];
}

export default function BindingManager({ profileId, bindings }: Props) {
  const createMut = useCreateBinding();
  const deleteMut = useDeleteBinding();
  const [showAdd, setShowAdd] = useState(false);
  const [toolCode, setToolCode] = useState('');
  const [capability, setCapability] = useState('');

  async function handleAdd() {
    if (!toolCode.trim() || !capability.trim()) {
      toast.error('Tool code và capability bắt buộc');
      return;
    }
    try {
      await createMut.mutateAsync({
        tool_code: toolCode.trim(),
        capability: capability.trim(),
        profile_id: profileId,
        is_primary: true,
        priority: 0,
      });
      toast.success('Đã thêm binding');
      setToolCode('');
      setCapability('');
      setShowAdd(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Thêm fail');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success('Đã xoá binding');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xoá fail');
    }
  }

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground flex items-center gap-1">
          <Link2 className="h-3 w-3" />
          Tool Bindings ({bindings.length})
        </p>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Binding
        </Button>
      </div>

      {bindings.map((b) => (
        <div key={b.id} className="flex items-center gap-2 text-xs bg-background rounded px-2 py-1.5">
          <span className="font-medium text-foreground">{b.tool_code}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-muted-foreground">{b.capability}</span>
          <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] ${b.is_primary ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
            {b.is_primary ? 'primary' : `fallback p:${b.priority}`}
          </span>
          <button type="button" onClick={() => handleDelete(b.id)} className="text-destructive hover:text-destructive/80">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}

      {showAdd && (
        <div className="flex items-center gap-2 bg-background rounded p-2">
          <Input
            value={toolCode}
            onChange={(e) => setToolCode(e.target.value)}
            placeholder="tool_code"
            className="text-xs h-7"
          />
          <Input
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
            placeholder="capability"
            className="text-xs h-7"
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={createMut.isPending}>
            Add
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(false)}>
            ×
          </Button>
        </div>
      )}
    </div>
  );
}