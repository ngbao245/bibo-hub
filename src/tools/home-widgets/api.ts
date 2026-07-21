// ============================================================
// Home Widgets — Persistence (Supabase app_settings)
// ============================================================

import { useEffect } from 'react';
import { authClient } from '@/lib/authClient';
import { useWidgetStore } from './store';
import { DEFAULT_WIDGET_CONFIG, type UserWidgetConfig } from './types';

const SETTINGS_KEY = 'home_widgets_config';

/** Load widget config from Supabase on mount. */
export function useLoadWidgetConfig() {
  const { setConfig, loaded } = useWidgetStore();

  useEffect(() => {
    if (loaded) return;

    (async () => {
      try {
        const { data } = await authClient
          .from('app_settings')
          .select('value')
          .eq('key', SETTINGS_KEY)
          .maybeSingle();

        if (data?.value && typeof data.value === 'object') {
          const val = data.value as Partial<UserWidgetConfig>;
          if (Array.isArray(val.activeWidgets)) {
            setConfig({ activeWidgets: val.activeWidgets });
            return;
          }
        }
        setConfig(DEFAULT_WIDGET_CONFIG);
      } catch {
        setConfig(DEFAULT_WIDGET_CONFIG);
      }
    })();
  }, [loaded, setConfig]);
}

/** Save widget config to Supabase (debounced, call after mutation). */
export async function saveWidgetConfig(config: UserWidgetConfig): Promise<void> {
  await authClient
    .from('app_settings')
    .upsert(
      { key: SETTINGS_KEY, value: config },
      { onConflict: 'key' },
    );
}