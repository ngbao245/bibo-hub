
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useShortcutOverrides } from '@/api/shortcutOverrides';
import { useShortcutStore } from '@/stores/shortcutStore';
import { useModalStore } from '@/stores/modalStore';
import { TOOLS } from '@/lib/tools';
import { buildShortcutRegistry, getToolIdFromEntry } from '@/lib/shortcutRegistry';

// ============================================================
// Bootstrap shortcut từ overrides
// ============================================================
//
// 1. Load overrides từ /Config.
// 2. Build registry (tools + controls).
// 3. Với mỗi entry có override `enabled=true` và `key`:
//    register vào shortcutStore với handler tương ứng action.
// 4. Đồng thời populate `byId` cho mọi entry để Setting UI list được.
// ============================================================

export function useBootstrapShortcutOverrides() {
  const query = useShortcutOverrides();
  const setOverrides = useShortcutStore((s) => s.setOverrides);
  const setRegistry = useShortcutStore((s) => s.setRegistry);
  const navigate = useNavigate();
  const toggleModal = useModalStore((s) => s.toggle);

  // Build handlers cho tất cả entries
  const handlers = useMemo(() => {
    const map: Record<string, () => void> = {
      'tool.shortcuts': () => toggleModal('shortcuts'),
    };
    for (const t of TOOLS) {
      const id = `tool.${t.id}`;
      if (t.action.kind === 'modal') {
        const modalId = t.action.modalId;
        map[id] = () => toggleModal(modalId);
      } else if (t.action.kind === 'route') {
        const path = t.action.path;
        map[id] = () => navigate(path);
      } else {
        map[id] = () => {
          /* todo */
        };
      }
    }
    return map;
  }, [navigate, toggleModal]);

  // Set registry cho UI list
  useEffect(() => {
    const entries = buildShortcutRegistry().map((e) => ({
      id: e.id,
      label: e.label,
      group: e.group,
      key: '', // default trống — user phải gán
      handler: handlers[e.id] ?? (() => {}),
    }));
    setRegistry(entries);
  }, [handlers, setRegistry]);

  // Apply overrides
  useEffect(() => {
    if (query.data) {
      setOverrides(query.data.data);
    }
  }, [query.data, setOverrides]);
}

// Re-export helper
export { getToolIdFromEntry };