// ============================================================
// BindingManager — Manage tool-service bindings (dropdown-based)
// ============================================================

import { useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useCreateBinding, useDeleteBinding } from '@/api/service-registry';
import { useToolsRegistry } from '@/lib/core-sdk';
import type { ToolServiceBinding } from '@/lib/service-registry/types';
import type { RequiredCapability } from '@/lib/core-sdk/types';
import { Button } from '@/components/ui/button';

interface Props {
  profileId: string;
  bindings: ToolServiceBinding[];
}

/** Predefined capability list (common across system). */
const KNOWN_CAPABILITIES = [
  'ai.generate',
  'ai.embedding',
  'pdf.compress',
  'pdf.merge',
  'file.convert',
  'storage.upload',
  'storage.download',
  'email.send',
  'realtime.signal',
  'turn.relay',
];

export default function BindingManager({ profileId, bindings }: Props) {
  const createMut = useCreateBinding();
  const deleteMut = useDeleteBinding();
  const toolsQuery = useToolsRegistry('active');
  const [showAdd, setShowAdd] = useState(false);
  const [toolCode, setToolCode] = useState('');
  const [capability, setCapability] = useState('');

  const tools = toolsQuery.data ?? [];

  // Get capabilities for selected tool (from required_capabilities) + known list
  const selectedTool = tools.find((t) => t.code === toolCode);
  const toolCapabilities = (selectedTool?.required_capabilities ?? []) as RequiredCapability[];
  const capabilityOptions = [
    ...new Set([
      ...toolCapabilities.map((c) => c.capability),
      ...KNOWN_CAPABILITIES,
    ]),
  ];

  async function handleAdd() {
    if (!toolCode || !capability) {
      toast.error('Chọn tool và capability');
      return;
    }
    try {
      await createMut.mutateAsync({
        tool_code: toolCode,
        capability,
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
          <select
            value={toolCode}
            onChange={(e) => { setToolCode(e.target.value); setCapability(''); }}
            className="h-7 border border-border bg-background px-2 text-xs text-foreground flex-1"
          >
            <option value="">-- Tool --</option>
            {tools.map((t) => (
              <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
            ))}
          </select>
          <select
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
            className="h-7 border border-border bg-background px-2 text-xs text-foreground flex-1"
          >
            <option value="">-- Capability --</option>
            {capabilityOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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