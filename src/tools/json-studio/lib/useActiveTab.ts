import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { normalizeTab, type StudioTabId } from './tabs';

// ============================================================
// useActiveTab — sync active tab với URL query `?tab=`
// ============================================================
//
// Source of truth = URL. State internal component không cần thiết vì
// React Router `useSearchParams` đã reactive.
//
// Setter update chỉ key `tab`, giữ nguyên các key khác (VD `?debug=1`).
// ============================================================

export function useActiveTab(): {
  activeTab: StudioTabId;
  setActiveTab: (next: StudioTabId) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get('tab'));

  const setActiveTab = useCallback(
    (next: StudioTabId) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('tab', next);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { activeTab, setActiveTab };
}