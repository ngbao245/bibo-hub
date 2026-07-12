// ============================================================
// VariableWarnings — Detect + warn unknown variables trong template
// ============================================================
// Parse `{{var}}` tokens, filter khỏi whitelist → return list unknown.
// Component render banner cảnh báo — không block, chỉ inform.
// ============================================================

import { AlertTriangle } from 'lucide-react';

const VALID_VARS = new Set(['name', 'first_name', 'email', 'phone', 'company', 'website']);
const VAR_REGEX = /\{\{(\w+)\}\}/g;

export function extractInvalidVars(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(VAR_REGEX)) {
      const name = m[1];
      if (!VALID_VARS.has(name)) found.add(name);
    }
  }
  return [...found];
}

interface Props {
  subject: string;
  body: string;
  className?: string;
}

export function VariableWarnings({ subject, body, className }: Props) {
  const invalid = extractInvalidVars(subject, body);
  if (invalid.length === 0) return null;

  return (
    <div className={`flex items-start gap-2 border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning ${className ?? ''}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">Biến không hợp lệ:</p>
        <p className="mt-0.5">
          {invalid.map((v) => (
            <code key={v} className="mr-1 rounded bg-warning/20 px-1 py-0.5 font-mono text-[11px]">
              {`{{${v}}}`}
            </code>
          ))}
        </p>
        <p className="mt-1 opacity-90">
          Hợp lệ: <code className="font-mono text-[11px]">name, first_name, email, phone, company, website</code>
        </p>
      </div>
    </div>
  );
}