import { Construction } from 'lucide-react';
import type { StudioTab } from '@/lib/json-studio/tabs';

// ============================================================
// ComingSoonWorkspace — placeholder cho tab chưa implement
// ============================================================
//
// Render khi user URL trực tiếp `/json-studio?tab=format` (tab disabled).
// Click qua TabBar chỉ ra toast, KHÔNG switch state → workspace này chỉ
// hiện khi URL trỏ thẳng tab disabled.
// ============================================================

interface ComingSoonWorkspaceProps {
  tab: StudioTab;
}

export function ComingSoonWorkspace({ tab }: ComingSoonWorkspaceProps) {
  const Icon = tab.icon;
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-card p-8 text-center">
      <div className="relative">
        <Icon className="h-14 w-14 text-muted-foreground/40" />
        <Construction className="absolute -bottom-1 -right-1 h-6 w-6 text-warning" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{tab.label} — Coming soon</h2>
        <p className="text-sm text-muted-foreground">
          {tab.hint ?? 'Feature này thuộc phase sau, chưa implement trong Phase 1 shell.'}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Chuyển sang tab <span className="font-medium text-foreground">Visualize</span> để xem graph
        JSON hoặc bấm <span className="font-medium">Alt+1</span>.
      </p>
    </div>
  );
}