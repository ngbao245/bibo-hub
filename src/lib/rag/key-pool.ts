// ============================================================
// GeminiKeyPool — quản lý 1-3 Gemini API keys
// ============================================================
//
// Mỗi key có:
//   - rpmCount: số request trong cửa sổ 60s (limit 15 RPM)
//   - rpdCount: số request trong ngày UTC (limit 1500 RPD)
//   - cooldownUntil: epoch ms, key bị 429 → block tới mốc này
//   - enabled: false sau khi gặp 401/403 (key invalid)
//
// pickKey():
//   - Bỏ qua disabled / cooldown / quá quota
//   - Load balance theo rpmCount thấp nhất
//   - Throw RagAllKeysFailedError nếu không key nào available
//
// Reset:
//   - RPM reset mỗi 60s (rolling window đơn giản hoá thành reset tuyệt đối)
//   - RPD reset mỗi 00:00 UTC
// ============================================================

import { RagAllKeysFailedError } from './types';

const RPM_LIMIT = 15;
const RPD_LIMIT = 1500;
const RPM_WINDOW_MS = 60_000;

export type KeyStatus = 'active' | 'cooldown' | 'invalid' | 'exhausted';

export interface KeyState {
  key: string;
  /** Index gốc khi user nhập (1, 2, 3) — để hiển thị UI */
  slot: number;
  rpmCount: number;
  rpdCount: number;
  /** Mốc reset RPM tiếp theo (epoch ms) */
  rpmResetAt: number;
  /** Mốc reset RPD tiếp theo (epoch ms) — 00:00 UTC ngày mai */
  rpdResetAt: number;
  /** Cooldown vì 429 — epoch ms, 0 nếu không cooldown */
  cooldownUntil: number;
  /** Disabled vĩnh viễn vì invalid (401/403) */
  enabled: boolean;
  /** Lỗi gần nhất (cho UI hiển thị) */
  lastError?: string;
}

function nextUtcMidnight(now: number): number {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function freshState(key: string, slot: number, now: number): KeyState {
  return {
    key,
    slot,
    rpmCount: 0,
    rpdCount: 0,
    rpmResetAt: now + RPM_WINDOW_MS,
    rpdResetAt: nextUtcMidnight(now),
    cooldownUntil: 0,
    enabled: true,
  };
}

export class GeminiKeyPool {
  private states: KeyState[] = [];

  constructor(keys: string[]) {
    this.replaceKeys(keys);
  }

  /** Thay danh sách keys (vd user save lại Setting). Reset state. */
  replaceKeys(keys: string[]): void {
    const now = Date.now();
    const cleaned = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    this.states = cleaned.map((k, i) => freshState(k, i + 1, now));
  }

  /** Số key active hiện tại. */
  size(): number {
    return this.states.filter((s) => s.enabled).length;
  }

  /**
   * Tính thông tin đợi cho friendly error message khi tất cả key exhausted.
   * Return null nếu có key active (không cần đợi).
   */
  computeWaitInfo(): { type: 'rpm' | 'rpd' | 'invalid'; waitMs: number; resetAt: number } | null {
    this.tickResets();
    const now = Date.now();
    const enabledStates = this.states.filter((s) => s.enabled);
    if (enabledStates.length === 0) {
      return { type: 'invalid', waitMs: 0, resetAt: 0 };
    }
    const active = enabledStates.filter((s) => this.statusOf(s) === 'active');
    if (active.length > 0) return null;

    // Ưu tiên: cooldown ngắn < 1h → RPM issue. Ngược lại RPD (đợi qua ngày).
    let minCooldown = Infinity;
    let minRpdReset = Infinity;
    for (const s of enabledStates) {
      if (s.cooldownUntil > now) {
        minCooldown = Math.min(minCooldown, s.cooldownUntil);
      }
      if (s.rpdCount >= RPD_LIMIT) {
        minRpdReset = Math.min(minRpdReset, s.rpdResetAt);
      }
    }
    if (minCooldown !== Infinity && minCooldown - now < 60 * 60 * 1000) {
      return { type: 'rpm', waitMs: minCooldown - now, resetAt: minCooldown };
    }
    if (minRpdReset !== Infinity) {
      return { type: 'rpd', waitMs: minRpdReset - now, resetAt: minRpdReset };
    }
    if (minCooldown !== Infinity) {
      return { type: 'rpm', waitMs: minCooldown - now, resetAt: minCooldown };
    }
    return null;
  }

  /** Snapshot cho UI hiển thị status. */
  snapshot(): Array<KeyState & { status: KeyStatus }> {
    this.tickResets();
    return this.states.map((s) => ({ ...s, status: this.statusOf(s) }));
  }

  /**
   * Pick key tốt nhất cho 1 request.
   * Throw RagAllKeysFailedError nếu không key nào available.
   */
  pickKey(): KeyState {
    this.tickResets();

    const available = this.states.filter((s) => this.statusOf(s) === 'active');
    if (available.length === 0) {
      const reasons = this.states
        .map((s) => `key#${s.slot}: ${this.statusOf(s)}${s.lastError ? ` (${s.lastError})` : ''}`)
        .join('; ');
      throw new RagAllKeysFailedError(
        reasons || 'No Gemini key configured',
      );
    }

    // Load balance: pick key có rpmCount thấp nhất, tie-break rpdCount
    available.sort((a, b) => a.rpmCount - b.rpmCount || a.rpdCount - b.rpdCount);
    return available[0];
  }

  /** Đánh dấu 1 request thành công (tăng counter). */
  markSuccess(key: string): void {
    const s = this.find(key);
    if (!s) return;
    s.rpmCount += 1;
    s.rpdCount += 1;
  }

  /** Đánh dấu 429: set cooldown. Reset counter nhẹ để fairness. */
  markRateLimited(key: string, retryAfterSec?: number): void {
    const s = this.find(key);
    if (!s) return;
    const now = Date.now();
    // Nếu retry-after không có → mặc định 60s
    const wait = (retryAfterSec ?? 60) * 1000;
    s.cooldownUntil = now + wait;
    s.lastError = `429 rate limited, retry after ${wait / 1000}s`;
  }

  /** Đánh dấu RPD exhausted: cooldown tới reset UTC. */
  markDailyExhausted(key: string): void {
    const s = this.find(key);
    if (!s) return;
    s.rpdCount = RPD_LIMIT;
    s.cooldownUntil = s.rpdResetAt;
    s.lastError = '429 daily quota exhausted';
  }

  /** Đánh dấu key invalid (401/403): disable vĩnh viễn. */
  markInvalid(key: string, reason: string = 'invalid key'): void {
    const s = this.find(key);
    if (!s) return;
    s.enabled = false;
    s.lastError = reason;
  }

  // --------------------------------------------------------
  // Internals
  // --------------------------------------------------------

  private find(key: string): KeyState | undefined {
    return this.states.find((s) => s.key === key);
  }

  private statusOf(s: KeyState): KeyStatus {
    if (!s.enabled) return 'invalid';
    const now = Date.now();
    if (s.cooldownUntil > now) return 'cooldown';
    if (s.rpmCount >= RPM_LIMIT) return 'cooldown';
    if (s.rpdCount >= RPD_LIMIT) return 'exhausted';
    return 'active';
  }

  private tickResets(): void {
    const now = Date.now();
    for (const s of this.states) {
      if (now >= s.rpmResetAt) {
        s.rpmCount = 0;
        s.rpmResetAt = now + RPM_WINDOW_MS;
      }
      if (now >= s.rpdResetAt) {
        s.rpdCount = 0;
        s.rpdResetAt = nextUtcMidnight(now);
        // Hết ngày → cooldown vì RPD cũng nên hết
        if (s.cooldownUntil >= s.rpdResetAt) s.cooldownUntil = 0;
      }
      if (now >= s.cooldownUntil && s.cooldownUntil > 0) {
        s.cooldownUntil = 0;
      }
    }
  }
}