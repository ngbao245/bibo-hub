
// ============================================================
// Firebase Realtime DB — signaling cho WebRTC P2P (trickle ICE)
// ============================================================
//
// Cấu trúc:
//   /rooms/{id}/offer          — { sdp }
//   /rooms/{id}/answer         — { sdp }
//   /rooms/{id}/offerCandidates/{pushId} — { candidate }
//   /rooms/{id}/answerCandidates/{pushId} — { candidate }
//
// Flow trickle ICE:
// - Mỗi candidate sinh ra → push lên Firebase ngay
// - Peer kia subscribe (onChildAdded) → addIceCandidate ngay
// - Không phải đợi gathering complete trước khi gửi SDP
//
// Config Firebase được nạp động từ Setting tool (group P2P, type
// "Firebase"). Lazy init: lần đầu gọi mới fetch + initializeApp.
// ============================================================

import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  onChildAdded,
  remove,
  get,
  type Database,
} from 'firebase/database';

import { loadP2PConfig } from './loadP2PConfig';

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const cfg = await loadP2PConfig();
    const app =
      getApps().length === 0
        ? initializeApp(cfg.firebase)
        : getApps()[0];
    return getDatabase(app);
  })();
  // Reset cache nếu init fail
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** Reset Firebase init (gọi khi passphrase đổi) */
export function resetFirebase() {
  dbPromise = null;
}

/** Kiểm tra room tồn tại */
export async function roomExists(roomId: string): Promise<boolean> {
  const db = await getDb();
  const snapshot = await get(ref(db, `rooms/${roomId}/offer`));
  return snapshot.exists();
}

/** Ghi offer SDP */
export async function setOffer(roomId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
  const db = await getDb();
  await set(ref(db, `rooms/${roomId}/offer`), { sdp: JSON.stringify(sdp) });
}

/** Ghi answer SDP */
export async function setAnswer(roomId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
  const db = await getDb();
  await set(ref(db, `rooms/${roomId}/answer`), { sdp: JSON.stringify(sdp) });
}

/** Đọc offer SDP (dùng 1 lần khi joiner connect) */
export async function getOfferSdp(roomId: string): Promise<RTCSessionDescriptionInit | null> {
  const db = await getDb();
  const snap = await get(ref(db, `rooms/${roomId}/offer`));
  if (!snap.exists()) return null;
  return JSON.parse(snap.val().sdp);
}

/** Listen answer SDP (host đợi answer) */
export function listenAnswer(
  roomId: string,
  callback: (sdp: RTCSessionDescriptionInit) => void,
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  void getDb().then((db) => {
    if (cancelled) return;
    const r = ref(db, `rooms/${roomId}/answer`);
    unsub = onValue(r, (snap) => {
      if (!snap.exists()) return;
      callback(JSON.parse(snap.val().sdp));
    });
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

/** Push 1 ICE candidate lên */
export async function pushCandidate(
  roomId: string,
  side: 'offer' | 'answer',
  candidate: RTCIceCandidateInit,
): Promise<void> {
  const db = await getDb();
  const r = ref(db, `rooms/${roomId}/${side}Candidates`);
  await push(r, { candidate: JSON.stringify(candidate) });
}

/** Listen các candidate mới được push lên */
export function listenCandidates(
  roomId: string,
  side: 'offer' | 'answer',
  callback: (candidate: RTCIceCandidateInit) => void,
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  void getDb().then((db) => {
    if (cancelled) return;
    const r = ref(db, `rooms/${roomId}/${side}Candidates`);
    unsub = onChildAdded(r, (snap) => {
      if (!snap.exists()) return;
      try {
        callback(JSON.parse(snap.val().candidate));
      } catch {
        // skip malformed
      }
    });
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

/** Xoá room sau khi xong */
export async function deleteRoom(roomId: string): Promise<void> {
  const db = await getDb();
  await remove(ref(db, `rooms/${roomId}`));
}