// ============================================================
// Service Registry — Credential selection strategies
// ============================================================

import type { ServiceCredential, SelectionStrategy } from './types';

/**
 * State tracked per-session for round_robin.
 * Key = profileId, value = last used index.
 */
const roundRobinState = new Map<string, number>();

/**
 * Filter credentials to only those available (active, not in cooldown, not exhausted).
 */
export function filterAvailable(credentials: ServiceCredential[]): ServiceCredential[] {
  const now = Date.now();
  return credentials.filter((c) => {
    if (c.status !== 'active') return false;
    if (c.cooldown_until && new Date(c.cooldown_until).getTime() > now) return false;
    return true;
  });
}

/**
 * Select credential from available pool based on strategy.
 * Returns null if no credential available.
 */
export function selectCredential(
  available: ServiceCredential[],
  strategy: SelectionStrategy,
  profileId: string,
): ServiceCredential | null {
  if (available.length === 0) return null;

  switch (strategy) {
    case 'priority':
      return selectByPriority(available);
    case 'available_first':
      return available[0] ?? null;
    case 'round_robin':
      return selectRoundRobin(available, profileId);
    case 'least_used':
      return selectLeastUsed(available);
    default:
      return available[0] ?? null;
  }
}

function selectByPriority(available: ServiceCredential[]): ServiceCredential | null {
  // Already sorted by priority from DB query, take first
  return available[0] ?? null;
}

function selectRoundRobin(available: ServiceCredential[], profileId: string): ServiceCredential | null {
  const lastIdx = roundRobinState.get(profileId) ?? -1;
  const nextIdx = (lastIdx + 1) % available.length;
  roundRobinState.set(profileId, nextIdx);
  return available[nextIdx] ?? null;
}

function selectLeastUsed(available: ServiceCredential[]): ServiceCredential | null {
  let least: ServiceCredential | null = null;
  let leastTime = Infinity;

  for (const c of available) {
    const lastUsed = c.last_used_at ? new Date(c.last_used_at).getTime() : 0;
    if (lastUsed < leastTime) {
      leastTime = lastUsed;
      least = c;
    }
  }

  return least;
}

/**
 * Reset round robin state for a profile (useful when credentials change).
 */
export function resetRoundRobin(profileId: string): void {
  roundRobinState.delete(profileId);
}