// ============================================================
// Service Registry — Legacy fallback reader
// ============================================================
// When VITE_LEGACY_SETTINGS_FALLBACK=true and new tables have no data
// for a tool+capability, fall back to reading app_settings directly.
// ============================================================

import { authClient } from '@/lib/authClient';
import type { CredentialWithSecret, BindingOverrides } from './types';

const LEGACY_ENABLED = (import.meta.env.VITE_LEGACY_SETTINGS_FALLBACK ?? 'true') === 'true';

interface LegacyResult {
  credentials: CredentialWithSecret[];
  overrides: BindingOverrides;
}

/**
 * Attempt to load credentials from legacy app_settings for a given tool+capability.
 * Returns null if legacy fallback is disabled or no data found.
 */
export async function loadLegacyCredentials(
  toolCode: string,
  capability: string,
): Promise<LegacyResult | null> {
  if (!LEGACY_ENABLED) return null;

  const mapping = resolveLegacyKey(toolCode, capability);
  if (!mapping) return null;

  const { data, error } = await authClient
    .from('app_settings')
    .select('value')
    .eq('key', mapping.key)
    .maybeSingle();

  if (error || !data?.value) return null;

  // eslint-disable-next-line no-console
  console.warn(`[service-registry] legacy fallback for "${mapping.key}"`);

  return mapping.transform(data.value as Record<string, unknown>);
}

interface LegacyMapping {
  key: string;
  transform: (value: Record<string, unknown>) => LegacyResult;
}

function resolveLegacyKey(toolCode: string, capability: string): LegacyMapping | null {
  // Gemini pool — RAG + Agency Studio
  if (capability === 'ai.generate') {
    return {
      key: 'gemini_credit_pool',
      transform: (value) => {
        const keys = (value as { keys?: Array<{ key?: string; name?: string } | string> }).keys ?? [];
        const credentials: CredentialWithSecret[] = keys.map((entry, idx) => {
          const key = typeof entry === 'string' ? entry : (entry.key ?? '');
          return {
            id: `legacy-gemini-${idx}`,
            identifier: key.slice(0, 10) + '...',
            secret_data_json: { apiKey: key },
            priority: idx,
            weight: 1,
          };
        });
        return { credentials, overrides: {} };
      },
    };
  }

  // iLovePDF — Library compress
  if (toolCode === 'library' && capability === 'pdf.compress') {
    return {
      key: 'compress_config',
      transform: (value) => {
        const v = value as { keys?: Array<{ public_key: string; secret_key?: string; name?: string }>; compression_level?: string };
        const credentials: CredentialWithSecret[] = (v.keys ?? []).map((entry, idx) => ({
          id: `legacy-ilovepdf-${idx}`,
          identifier: entry.public_key,
          secret_data_json: { public_key: entry.public_key, secret_key: entry.secret_key ?? null },
          priority: idx,
          weight: 1,
        }));
        return {
          credentials,
          overrides: { compressionLevel: v.compression_level ?? 'recommended' },
        };
      },
    };
  }

  // Google Drive — Library backup
  if (toolCode === 'library' && capability === 'storage.backup') {
    return {
      key: 'drive_backup_config',
      transform: (value) => {
        const v = value as { client_id?: string; client_secret?: string; refresh_token?: string; folder_id?: string; name?: string };
        if (!v.client_id) return { credentials: [], overrides: {} };
        const credentials: CredentialWithSecret[] = [{
          id: 'legacy-drive-0',
          identifier: v.client_id,
          secret_data_json: {
            client_id: v.client_id,
            client_secret: v.client_secret ?? '',
            refresh_token: v.refresh_token ?? '',
            folder_id: v.folder_id ?? '',
          },
          priority: 0,
          weight: 1,
        }];
        return { credentials, overrides: {} };
      },
    };
  }

  // P2P — Firebase signaling
  if (toolCode === 'p2p-transfer' && capability === 'realtime.signaling') {
    return {
      key: 'p2p_config',
      transform: (value) => {
        const v = value as { firebase?: Record<string, string> };
        if (!v.firebase?.apiKey) return { credentials: [], overrides: {} };
        const credentials: CredentialWithSecret[] = [{
          id: 'legacy-firebase-0',
          identifier: v.firebase.projectId ?? 'firebase',
          secret_data_json: { ...v.firebase },
          priority: 0,
          weight: 1,
        }];
        return { credentials, overrides: {} };
      },
    };
  }

  // P2P — TURN server
  if (toolCode === 'p2p-transfer' && capability === 'networking.turn') {
    return {
      key: 'p2p_config',
      transform: (value) => {
        const v = value as { turn?: { username?: string; credential?: string } };
        if (!v.turn?.username) return { credentials: [], overrides: {} };
        const credentials: CredentialWithSecret[] = [{
          id: 'legacy-turn-0',
          identifier: v.turn.username,
          secret_data_json: { username: v.turn.username, credential: v.turn.credential ?? '' },
          priority: 0,
          weight: 1,
        }];
        return { credentials, overrides: {} };
      },
    };
  }

  return null;
}