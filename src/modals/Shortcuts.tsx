
import { useMemo } from 'react';
import { Keyboard } from 'lucide-react';

import { useShortcutStore, type Shortcut } from '@/stores/shortcutStore';

import ToolModal from '@/components/ToolModal';

// ============================================================
// Shortcuts Modal — hiển thị tất cả phím tắt active
// ============================================================

export default function Shortcuts() {
  return (
    <ToolModal
      id="shortcuts"
      title="Phím tắt"
      description="Tất cả phím tắt đang hoạt động trong app"
      className="max-w-lg"
    >
      <ShortcutsContent />
    </ToolModal>
  );
}

function ShortcutsContent() {
  const shortcuts = useShortcutStore((s) => s.shortcuts);

  // Group theo `group` field. Convert Map → array → group.
  const grouped = useMemo(() => {
    const list = Array.from(shortcuts.values());
    const result: Record<string, Shortcut[]> = {};
    for (const s of list) {
      const g = s.group ?? 'Khác';
      if (!result[g]) result[g] = [];
      result[g].push(s);
    }
    // Sort shortcut trong mỗi group theo key
    for (const g in result) {
      result[g].sort((a, b) => a.key.localeCompare(b.key));
    }
    return result;
  }, [shortcuts]);

  const groupNames = Object.keys(grouped).sort();
  const isEmpty = groupNames.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
        <Keyboard className="mb-2 h-8 w-8" />
        Chưa có phím tắt nào được đăng ký
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupNames.map((group) => (
        <section key={group}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group}
          </h3>
          <ul className="space-y-1">
            {grouped[group].map((s) => (
              <li
                key={s.key}
                className="flex items-center justify-between border border-border bg-card px-3 py-2"
              >
                <span className="text-sm text-foreground">{s.label}</span>
                <KeyChip keyName={s.key} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function KeyChip({ keyName }: { keyName: string }) {
  // Render mỗi phần (alt+shift+s) thành kbd riêng
  const parts = keyName.split('+');
  return (
    <span className="flex items-center gap-1">
      {parts.map((p, i) => (
        <kbd
          key={i}
          className="border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary"
        >
          {prettyKey(p)}
        </kbd>
      ))}
    </span>
  );
}

function prettyKey(part: string): string {
  const map: Record<string, string> = {
    alt: 'Alt',
    ctrl: 'Ctrl',
    shift: 'Shift',
    meta: '⌘',
    escape: 'Esc',
    enter: '↵',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
  };
  return map[part] ?? part.toUpperCase();
}