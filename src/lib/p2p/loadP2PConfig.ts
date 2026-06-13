
// ============================================================
// Loader — Firebase config + TURN credential từ Setting tool
// ============================================================
//
// Lấy 2 record trong group "P2P":
//   - type = "Firebase"             → 7 field firebase config
//   - type = "TURN Server Metered"  → username + credential
//
// Field được mã hoá AES-GCM (xem lib/cryptoFields). Cần passphrase
// trong cryptoStore. Nếu chưa nhập → throw lỗi rõ ràng.
//
// Memoize 1 lần per session — passphrase đổi (logout/clear) thì
// reset cache để load lại với passphrase mới.
// ============================================================

import { fetchJson } from '@/api/client';
import { API } from '@/lib/config';
import { parseSettingList, type Setting } from '@/lib/setting';
import { decodeFieldSlots, decryptText, isEncrypted } from '@/lib/cryptoFields';
import { useCryptoStore } from '@/stores/cryptoStore';
import { APP_SECRET } from '@/lib/appSecret';

// ----------------------------------------------------------
// App secret — passphrase mặc định để decrypt config P2P
// ----------------------------------------------------------
//
// User thường không cần nhập gì. Chỉ admin (sửa Setting) mới cần
// nhập passphrase trong Crypto modal — passphrase này phải khớp
// app secret để app load được data sau đó.
//
// Passphrase plain + encoded được tập trung tại lib/appSecret.ts
// để rotate chỉ cần sửa 1 chỗ.
// ----------------------------------------------------------

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

// ----------------------------------------------------------
// Cache promise — đảm bảo concurrent calls share cùng kết quả
// ----------------------------------------------------------

let cache: Promise<P2PConfig> | null = null;
let cachedPassphrase: string | null = null;

/** Reset cache khi passphrase thay đổi hoặc cần reload từ API. */
export function resetP2PConfigCache() {
  cache = null;
  cachedPassphrase = null;
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

async function decodeRecord(
  setting: Setting,
  passphrase: string,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of [
    'config1',
    'config2',
    'config3',
    'config4',
    'config5',
    'config6',
    'config7',
    'config8',
    'config9',
    'config10',
  ] as const) {
    const raw = setting[key];
    if (!raw) continue;
    const entries = decodeFieldSlots(raw, key);
    for (const e of entries) {
      let value = e.v;
      if (e.e === 1 && isEncrypted(value)) {
        value = await decryptText(value, passphrase);
      }
      out[e.k] = value;
    }
  }
  return out;
}

function pickFirebase(map: Record<string, string>): FirebaseConfig {
  const required: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'databaseURL',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];
  const missing = required.filter((k) => !map[k]);
  if (missing.length) {
    throw new Error(
      `Firebase config thiếu field: ${missing.join(', ')}. Mở Setting → group "P2P" → record type "Firebase".`,
    );
  }
  return {
    apiKey: map.apiKey,
    authDomain: map.authDomain,
    databaseURL: map.databaseURL,
    projectId: map.projectId,
    storageBucket: map.storageBucket,
    messagingSenderId: map.messagingSenderId,
    appId: map.appId,
  };
}

function pickTurn(map: Record<string, string>): TurnCredential {
  const username = map.username ?? '';
  const credential = map.credential ?? '';
  if (!username || !credential) {
    throw new Error(
      'TURN credential thiếu username/credential. Mở Setting → group "P2P" → record type "TURN Server Metered".',
    );
  }
  return { username, credential };
}

// ----------------------------------------------------------
// Public loader
// ----------------------------------------------------------

// Tự reset cache khi passphrase trong store thay đổi
useCryptoStore.subscribe((state, prev) => {
  if (state.passphrase !== prev.passphrase) {
    resetP2PConfigCache();
    // Lazy import để tránh circular dep
    void import('./firebase').then((m) => m.resetFirebase());
  }
});

/**
 * Resolve passphrase dùng để decrypt:
 *   - User đã nhập trong Crypto modal → ưu tiên (cho admin override).
 *   - Không thì dùng APP_SECRET hardcode (default cho mọi visitor).
 */
function resolvePassphrase(): string {
  const userInput = useCryptoStore.getState().passphrase;
  if (userInput) return userInput;
  return APP_SECRET;
}

export function loadP2PConfig(): Promise<P2PConfig> {
  const passphrase = resolvePassphrase();
  if (!passphrase) {
    return Promise.reject(
      new Error(
        'App secret chưa cấu hình. Báo dev cập nhật APP_SECRET_ENCODED trong loadP2PConfig.ts.',
      ),
    );
  }
  if (cache && cachedPassphrase === passphrase) return cache;

  cachedPassphrase = passphrase;
  cache = (async () => {
    const raw = await fetchJson<unknown>(API.CONFIGS);
    const list = parseSettingList(raw).filter((s) => s.group.trim() === 'P2P');

    const firebaseRecord = list.find((s) => s.type.trim() === 'Firebase');
    const turnRecord = list.find((s) => s.type.trim() === 'TURN Server Metered');

    if (!firebaseRecord) {
      throw new Error(
        'Chưa có record Firebase trong Setting → group "P2P" → type "Firebase".',
      );
    }
    if (!turnRecord) {
      throw new Error(
        'Chưa có record TURN trong Setting → group "P2P" → type "TURN Server Metered".',
      );
    }

    const firebaseMap = await decodeRecord(firebaseRecord, passphrase);
    const turnMap = await decodeRecord(turnRecord, passphrase);

    return {
      firebase: pickFirebase(firebaseMap),
      turn: pickTurn(turnMap),
    };
  })();

  // Nếu fail → clear cache để lần sau load lại
  cache.catch(() => {
    cache = null;
    cachedPassphrase = null;
  });

  return cache;
}