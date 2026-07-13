// ============================================================
// Loader — Firebase config + TURN credential từ service registry
// ============================================================
//
// Refactored: đọc từ service registry tables (service_credentials).
// Fallback app_settings.p2p_config khi service registry chưa có data.
//
// Schema value trong app_settings (legacy):
//   {
//     firebase: { apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId },
//     turn: { username, credential }
//   }
// ============================================================

import { authClient } from '@/lib/authClient';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface TurnCredential {
  username: string;
  credential: string;
}

export interface P2PConfig {
  firebase: FirebaseConfig;
  turn: TurnCredential;
}

const KEY = 'p2p_config';

let cache: Promise<P2PConfig> | null = null;

/** Reset cache khi user thay đổi (logout / re-login). */
export function resetP2PConfigCache() {
  cache = null;
}

interface P2PConfigRow {
  firebase?: Partial<FirebaseConfig>;
  turn?: Partial<TurnCredential>;
}

function validateFirebase(fb: Partial<FirebaseConfig> | undefined): FirebaseConfig {
  const required: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'databaseURL',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];
  const missing = required.filter((k) => !fb?.[k]);
  if (missing.length) {
    throw new Error(
      `p2p_config.firebase thiếu field: ${missing.join(', ')}. Mở Setting → Firebase/TURN tab để cập nhật.`,
    );
  }
  return {
    apiKey: fb!.apiKey!,
    authDomain: fb!.authDomain!,
    databaseURL: fb!.databaseURL!,
    projectId: fb!.projectId!,
    storageBucket: fb!.storageBucket!,
    messagingSenderId: fb!.messagingSenderId!,
    appId: fb!.appId!,
  };
}

function validateTurn(turn: Partial<TurnCredential> | undefined): TurnCredential {
  if (!turn?.username || !turn?.credential) {
    throw new Error(
      'p2p_config.turn thiếu username/credential. Mở Setting → Firebase/TURN tab.',
    );
  }
  return { username: turn.username, credential: turn.credential };
}

export function loadP2PConfig(): Promise<P2PConfig> {
  if (cache) return cache;

  cache = (async () => {
    // Try service registry first
    const registryResult = await loadFromRegistry();
    if (registryResult) return registryResult;

    // Legacy fallback
    return loadFromAppSettings();
  })();

  cache.catch(() => {
    cache = null;
  });

  return cache;
}

async function loadFromRegistry(): Promise<P2PConfig | null> {
  try {
    // Load Firebase credential
    const { data: fbBindings } = await authClient
      .from('tool_service_bindings')
      .select('profile_id')
      .eq('tool_code', 'p2p-transfer')
      .eq('capability', 'realtime.signaling')
      .eq('enabled', true)
      .limit(1);

    let firebase: FirebaseConfig | null = null;
    if (fbBindings?.length && fbBindings[0].profile_id) {
      const { data: creds } = await authClient
        .from('service_credentials')
        .select('secret_data_json')
        .eq('profile_id', fbBindings[0].profile_id)
        .eq('status', 'active')
        .limit(1);

      if (creds?.length) {
        const s = creds[0].secret_data_json as Partial<FirebaseConfig> | null;
        if (s?.apiKey) {
          firebase = validateFirebase(s);
        }
      }
    }

    // Load TURN credential
    const { data: turnBindings } = await authClient
      .from('tool_service_bindings')
      .select('profile_id')
      .eq('tool_code', 'p2p-transfer')
      .eq('capability', 'networking.turn')
      .eq('enabled', true)
      .limit(1);

    let turn: TurnCredential | null = null;
    if (turnBindings?.length && turnBindings[0].profile_id) {
      const { data: creds } = await authClient
        .from('service_credentials')
        .select('secret_data_json')
        .eq('profile_id', turnBindings[0].profile_id)
        .eq('status', 'active')
        .limit(1);

      if (creds?.length) {
        const s = creds[0].secret_data_json as Partial<TurnCredential> | null;
        if (s?.username) {
          turn = validateTurn(s);
        }
      }
    }

    if (firebase && turn) return { firebase, turn };
    return null;
  } catch {
    return null;
  }
}

async function loadFromAppSettings(): Promise<P2PConfig> {
  const { data, error } = await authClient
    .from('app_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle();

  if (error) {
    if (error.code === '42501' || error.code === 'PGRST116') {
      throw new Error('Bạn không có quyền dùng P2P Transfer. Liên hệ admin.');
    }
    throw new Error(`Load p2p_config failed: ${error.message}`);
  }

  if (!data || !data.value) {
    throw new Error(
      'Chưa có p2p_config. Mở Setting → Firebase/TURN tab để setup.',
    );
  }

  const row = data.value as P2PConfigRow;
  return {
    firebase: validateFirebase(row.firebase),
    turn: validateTurn(row.turn),
  };
}