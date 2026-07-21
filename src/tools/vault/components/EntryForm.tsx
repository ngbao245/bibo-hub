import { useState } from 'react';
import { Plus, Trash2, Save, Copy, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

import type { VaultEntry, VaultField, VaultTemplate } from '../types';
import { getTemplateConfig } from '../lib/templates';
import { useVaultStore } from '../store';
import { useCreateVaultEntry, useUpdateVaultEntry, useDeleteVaultEntry } from '../api';
import { encrypt, bytesToBase64 } from '../lib/crypto';

interface Props {
  entry: VaultEntry | null;
  templateType?: VaultTemplate;
  onSaved: () => void;
  onCancel: () => void;
}

export default function EntryForm({ entry, templateType, onSaved, onCancel }: Props) {
  const template = getTemplateConfig(entry?.templateType ?? templateType ?? 'custom');
  const isNew = !entry;

  const [title, setTitle] = useState(entry?.title ?? '');
  const [fields, setFields] = useState<VaultField[]>(() => {
    if (entry) return entry.fields;
    return template.defaultFields.map((f) => ({ ...f, value: '' }));
  });
  const [revealedFields, setRevealedFields] = useState<Set<number>>(new Set());

  const masterKey = useVaultStore((s) => s.masterKey);
  const createEntry = useCreateVaultEntry();
  const updateEntry = useUpdateVaultEntry();
  const deleteEntry = useDeleteVaultEntry();

  const isPending = createEntry.isPending || updateEntry.isPending;

  function handleFieldChange(index: number, value: string) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
  }

  function handleAddField() {
    setFields((prev) => [...prev, { key: '', value: '', sensitive: false }]);
  }

  function handleRemoveField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFieldKeyChange(index: number, key: string) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, key } : f)));
  }

  function toggleReveal(index: number) {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleCopy(value: string) {
    navigator.clipboard.writeText(value);
    toast.success('Copied');
    // Auto-clear clipboard after 30s
    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => { /* ignore */ });
    }, 30_000);
  }

  async function handleSave() {
    if (!masterKey || !title.trim()) return;

    try {
      // Encrypt title
      const { ciphertext: encTitle, iv: ivTitle } = await encrypt(masterKey, title);
      // Encrypt fields as JSON
      const fieldsJson = JSON.stringify(fields);
      const { ciphertext: encData, iv: ivData } = await encrypt(masterKey, fieldsJson);

      const payload = {
        template_type: entry?.templateType ?? templateType ?? 'custom',
        encrypted_title: bytesToBase64(encTitle),
        iv_title: bytesToBase64(ivTitle),
        encrypted_data: bytesToBase64(encData),
        iv_data: bytesToBase64(ivData),
      };

      if (entry) {
        await updateEntry.mutateAsync({ id: entry.id, data: payload });
        toast.success('Saved');
      } else {
        await createEntry.mutateAsync(payload);
        toast.success('Created');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function handleDelete() {
    if (!entry) return;
    if (!window.confirm('Delete this entry permanently?')) return;
    try {
      await deleteEntry.mutateAsync(entry.id);
      toast.success('Deleted');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {isNew ? `New ${template.label}` : 'Edit Entry'}
        </h3>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          {!isNew && (
            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isPending || !title.trim()} className="gap-1">
            <Save className="h-3.5 w-3.5" /> {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entry title..." />
        </div>

        {/* Fields */}
        {fields.map((field, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              {/* Custom fields have editable key */}
              {(entry?.templateType === 'custom' || templateType === 'custom' || !template.defaultFields.find((d) => d.key === field.key)) ? (
                <Input
                  value={field.key}
                  onChange={(e) => handleFieldKeyChange(i, e.target.value)}
                  placeholder="Field name..."
                  className="h-7 text-xs"
                />
              ) : (
                <label className="block text-xs font-medium text-muted-foreground capitalize">
                  {field.key.replace(/_/g, ' ')}
                </label>
              )}

              <div className="flex items-center gap-1">
                {field.key === 'content' || field.key === 'notes' ? (
                  <textarea
                    value={field.value}
                    onChange={(e) => handleFieldChange(i, e.target.value)}
                    className="min-h-[80px] w-full resize-none border border-input bg-background p-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder={`Enter ${field.key}...`}
                  />
                ) : (
                  <Input
                    type={field.sensitive && !revealedFields.has(i) ? 'password' : 'text'}
                    value={field.value}
                    onChange={(e) => handleFieldChange(i, e.target.value)}
                    placeholder={`Enter ${field.key}...`}
                  />
                )}

                {field.sensitive && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => toggleReveal(i)}>
                    {revealedFields.has(i) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                )}

                {field.value && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleCopy(field.value)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Remove field (only for non-default or custom) */}
            {(!template.defaultFields.find((d) => d.key === field.key) || template.type === 'custom') && (
              <Button size="icon" variant="ghost" className="mt-5 h-8 w-8 shrink-0 text-destructive" onClick={() => handleRemoveField(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}

        {/* Add custom field */}
        <Button variant="outline" size="sm" onClick={handleAddField} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add field
        </Button>
      </div>
    </div>
  );
}