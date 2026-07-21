// ============================================================
// Library Storage Pool — Core Logic
// ============================================================
//
// Best-fit allocation: pick node with smallest remaining that fits.
// Client creation for upload/delete vs read (different keys).
// Usage tracking after upload/delete.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authClient } from '@/lib/authClient';
import type { StorageNode, StorageNodeCredential } from '../types';
import { StoragePoolFullError } from '../types';

// ── Node Resolution ──

/**
 * Parse service_credentials rows into StorageNode objects.
 */
export function parseNodes(credentials: StorageNodeCredential[]): StorageNode[] {
  return credentials
    .filter((c) => c.secret_data_json?.url && c.secret_data_json?.service_role_key)
    .map((c) => ({
      id: c.id,
      name: c.name || c.identifier || 'Unnamed',
      url: c.secret_data_json!.url!,
      serviceRoleKey: c.secret_data_json!.service_role_key!,
      anonKey: c.secret_data_json!.anon_key ?? '',
      bucketName: c.secret_data_json!.bucket_name ?? 'books',
      capacityBytes: c.storage_capacity_bytes ?? 1073741824, // default 1GB
      usedBytes: c.storage_used_bytes ?? 0,
      status: c.status === 'active' ? 'active' : 'disabled',
    }));
}

// ── Best-Fit Algorithm ──

/**
 * Pick the best storage node for a file of given size.
 *
 * Algorithm: best-fit
 *   1. Filter active nodes where remaining >= fileSize
 *   2. Sort by remaining ASC (smallest remaining first)
 *   3. Return first (fills tightest fit)
 *
 * Returns null if no node can fit the file.
 */
export function pickNode(nodes: StorageNode[], fileSize: number): StorageNode | null {
  const candidates = nodes
    .filter((n) => n.status === 'active')
    .filter((n) => (n.capacityBytes - n.usedBytes) >= fileSize)
    .sort((a, b) => {
      const remainA = a.capacityBytes - a.usedBytes;
      const remainB = b.capacityBytes - b.usedBytes;
      return remainA - remainB; // smallest remaining first (best-fit)
    });

  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Pick node or throw StoragePoolFullError.
 */
export function pickNodeOrThrow(nodes: StorageNode[], fileSize: number): StorageNode {
  const node = pickNode(nodes, fileSize);
  if (!node) throw new StoragePoolFullError(fileSize);
  return node;
}

// ── Supabase Client Factory ──

// Cache clients to avoid creating new instances per request
const clientCache = new Map<string, SupabaseClient>();

/**
 * Get Supabase client for upload/delete operations (uses service_role_key).
 */
export function getUploadClient(node: StorageNode): SupabaseClient {
  const cacheKey = `upload:${node.id}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = createClient(node.url, node.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

/**
 * Get Supabase client for read operations / signed URLs (uses anon_key).
 * Falls back to service_role_key if anon_key not set.
 */
export function getReadClient(node: StorageNode): SupabaseClient {
  const cacheKey = `read:${node.id}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    const key = node.anonKey || node.serviceRoleKey;
    client = createClient(node.url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

/** Clear cached clients (e.g. when nodes config changes). */
export function clearClientCache(): void {
  clientCache.clear();
}

// ── Usage Tracking ──

/**
 * Update storage_used_bytes for a node after upload (+) or delete (-).
 * Uses Core authClient to update service_credentials table.
 */
export async function updateUsage(nodeId: string, deltaBytes: number): Promise<void> {
  // Read current value
  const { data, error: readErr } = await authClient
    .from('service_credentials')
    .select('storage_used_bytes')
    .eq('id', nodeId)
    .single();

  if (readErr || !data) return; // silent fail — usage tracking is best-effort

  const current = (data as { storage_used_bytes: number | null }).storage_used_bytes ?? 0;
  const newUsed = Math.max(0, current + deltaBytes);

  await authClient
    .from('service_credentials')
    .update({ storage_used_bytes: newUsed })
    .eq('id', nodeId);
}

// ── Load Nodes from DB ──

/**
 * Load all storage nodes from service_credentials.
 * Used by upload/read/delete flows and Setting UI.
 */
export async function loadStorageNodes(): Promise<StorageNode[]> {
  const { data: bindings } = await authClient
    .from('tool_service_bindings')
    .select('profile_id')
    .eq('tool_code', 'library')
    .eq('capability', 'storage.files')
    .eq('enabled', true)
    .order('priority')
    .limit(1);

  if (!bindings?.length || !bindings[0].profile_id) return [];

  const { data: credentials } = await authClient
    .from('service_credentials')
    .select('id, name, identifier, secret_data_json, status, storage_capacity_bytes, storage_used_bytes')
    .eq('profile_id', bindings[0].profile_id)
    .in('status', ['active', 'disabled'])
    .order('priority');

  if (!credentials?.length) return [];

  return parseNodes(credentials as StorageNodeCredential[]);
}