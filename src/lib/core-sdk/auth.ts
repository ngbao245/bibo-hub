// ============================================================
// Core SDK — Auth helpers
// ============================================================
// Thin wrapper over authClient + authStore for plugin consumption.
// Plugins import from core-sdk instead of reaching into internal modules.
//
// Re-exports:
//   - authClient (Supabase client for core project)
//   - getCurrentUser, getCurrentSession
//   - checkPermission (tool-level access check)
//   - isAdmin
//   - signOut
// ============================================================

import { authClient } from '@/lib/authClient';
import { useAuthStore, type Profile } from '@/stores/authStore';
import type { Session } from '@supabase/supabase-js';

export { authClient };
export type { Profile };

// ─── Session helpers ────────────────────────────────────────

/** Get current authenticated session. Null if not logged in. */
export function getCurrentSession(): Session | null {
  return useAuthStore.getState().session;
}

/** Get current user ID. Null if not logged in. */
export function getCurrentUserId(): string | null {
  return useAuthStore.getState().session?.user.id ?? null;
}

/** Get current user profile. Null if not loaded yet. */
export function getCurrentProfile(): Profile | null {
  return useAuthStore.getState().profile;
}

// ─── Permission helpers ─────────────────────────────────────

/** Check if current user is admin. */
export function isAdmin(): boolean {
  return useAuthStore.getState().profile?.role === 'admin';
}

/**
 * Check if current user has access to a specific tool.
 * Admin always passes. Wildcard '*' in allowed_tools means all tools.
 */
export function checkPermission(toolCode: string): boolean {
  const profile = useAuthStore.getState().profile;
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.allowed_tools.includes('*')) return true;
  return profile.allowed_tools.includes(toolCode);
}

/**
 * Get the list of tool codes the current user is allowed to access.
 * Admin returns ['*']. Returns empty array if no profile.
 */
export function getAllowedTools(): string[] {
  const profile = useAuthStore.getState().profile;
  if (!profile) return [];
  if (profile.role === 'admin') return ['*'];
  return profile.allowed_tools;
}

// ─── Actions ────────────────────────────────────────────────

/** Sign out current user. Clears session + profile in store. */
export async function signOut(): Promise<void> {
  await authClient.auth.signOut();
  useAuthStore.getState().clear();
}

/**
 * Get access token for current session.
 * Useful for plugins calling edge functions with Authorization header.
 * Returns null if no active session.
 */
export function getAccessToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null;
}