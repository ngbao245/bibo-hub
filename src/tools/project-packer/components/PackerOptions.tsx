import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PRESETS } from '@/tools/project-packer/lib/presets';
import type { PackOptions } from '@/tools/project-packer/lib/types';

// ============================================================
// PackerOptions - chỉnh chunk size, preset, exclude/include
// ============================================================

interface PackerOptionsProps {
  options: PackOptions;
  onChange: (options: PackOptions) => void;
}

export default function PackerOptions({ options, onChange }: PackerOptionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [presetId, setPresetId] = useState('react');

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({
      ...options,
      excludePatterns: preset.excludePatterns,
      includeExtensions: preset.includeExtensions,
    });
  }

  return (
    <div className="border border-border bg-card">
      {/* Header (always visible) */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preset
          </label>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                variant={presetId === p.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(p.id)}
                className="h-7 px-2 text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Mỗi part
            </label>
            <Input
              type="number"
              min={5000}
              max={100000}
              step={5000}
              value={options.maxCharsPerPart}
              onChange={(e) =>
                onChange({
                  ...options,
                  maxCharsPerPart: parseInt(e.target.value, 10) || 50000,
                })
              }
              className="h-7 w-24 text-xs"
            />
            <span className="text-xs text-muted-foreground">ký tự</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="h-7 gap-1 px-2 text-xs"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Nâng cao
        </Button>
      </div>

      {/* Advanced (collapsible) */}
      {expanded && (
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
          <Field label={`Loại trừ (${options.excludePatterns.length})`}>
            <textarea
              value={options.excludePatterns.join('\n')}
              onChange={(e) =>
                onChange({
                  ...options,
                  excludePatterns: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-[120px] w-full resize-none border border-input bg-background p-2 font-mono text-xs focus:border-primary focus:outline-none"
              placeholder={'node_modules/\n*.lock\n.env'}
            />
          </Field>

          <Field
            label={`Extensions (${options.includeExtensions.length || 'tất cả'})`}
          >
            <textarea
              value={options.includeExtensions.join('\n')}
              onChange={(e) =>
                onChange({
                  ...options,
                  includeExtensions: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-[120px] w-full resize-none border border-input bg-background p-2 font-mono text-xs focus:border-primary focus:outline-none"
              placeholder={'.tsx\n.ts\n.css'}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}