// ============================================================
// Loader — Firebase config + TURN credential từ Supabase app_settings
// ============================================================
//
// Refactored: đọc từ app_settings.p2p_config Supabase (plaintext, RLS chặn).
// Không còn APP_SECRET / cryptoFields / cryptoStore.
//
// Schema value trong app_settings:
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
      `p2p_config.firebase thiếu field: ${missing.join(', ')}. Mở Setting → P2P Config để cập nhật.`,
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
      'p2p_config.turn thiếu username/credential. Mở Setting → P2P Config.',
    );
  }
  return { username: turn.username, credential: turn.credential };
}

export function loadP2PConfig(): Promise<P2PConfig> {
  if (cache) return cache;

  cache = (async () => {
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
        'Chưa có p2p_config. Mở Setting → P2P Config để setup Firebase + TURN.',
      );
    }

    const row = data.value as P2PConfigRow;
    return {
      firebase: validateFirebase(row.firebase),
      turn: validateTurn(row.turn),
    };
  })();

  cache.catch(() => {
    cache = null;
  });

  return cache;
}