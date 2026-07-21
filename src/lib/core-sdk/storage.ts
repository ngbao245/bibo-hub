// ============================================================
// Core SDK — Storage Pool (Cloud Storage File Index)
// ============================================================
// Unified file storage across multiple Google Drive accounts (or other providers).
// storage_files = central index. Actual files live on provider (Drive, S3, etc).
//
// Flow:
//   1. selectStorageCredential() → pick least-used account from pool
//   2. Upload file to provider using that credential
//   3. registerFile() → INSERT storage_files row + update credential.storage_used_bytes
//   4. getFileUrl() → resolve credential → build provider download URL
//   5. deleteFile() → mark deleted → background cleanup
//
// Plugin usage:
//   import { registerFile, getFileUrl, deleteFile } from '@/lib/core-sdk';
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';
import { getCurrentUserId } from './auth';

// ─── Types ──────────────────────────────────────────────────

export interface StorageFile {
  id: string;
  credential_id: string;
  remote_file_id: string;
  remote_folder_id: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string | null;
  uploaded_by: string;
  tool_code: string | null;
  entity_id: string | null;
  status: 'active' | 'deleted' | 'orphaned';
  deleted_at: string | null;
  created_at: string;
}

export interface RegisterFileInput {
  credentialId: string;
  remoteFileId: string;
  remoteFolderId?: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  toolCode?: string;
  entityId?: string;
}

export interface StorageCredentialInfo {
  id: string;
  identifier: string;
  storage_capacity_bytes: number | null;
  storage_used_bytes: number | null;
  storage_root_folder_id: string | null;
  status: string;
  priority: number;
}

// ─── Query Keys ─────────────────────────────────────────────

export const storageKeys = {
  files: (filters?: Record<string, string>) => ['core-sdk', 'storage-files', filters ?? {}] as const,
  filesByEntity: (toolCode: string, entityId: string) =>
    ['core-sdk', 'storage-files', 'entity', toolCode, entityId] as const,
  credentials: (profileId: string) =>
    ['core-sdk', 'storage-credentials', profileId] as const,
};

// ─── Queries ────────────────────────────────────────────────

/** List storage files with optional filters. */
export function useStorageFiles(filters?: { toolCode?: string; entityId?: string; status?: string }) {
  return useQuery({
    queryKey: storageKeys.files(filters as Record<string, string> | undefined),
    queryFn: async (): Promise<StorageFile[]> => {
      let q = authClient.from('storage_files').select('*');
      if (filters?.toolCode) q = q.eq('tool_code', filters.toolCode);
      if (filters?.entityId) q = q.eq('entity_id', filters.entityId);
      if (filters?.status) q = q.eq('status', filters.status);
      q = q.order('created_at', { ascending: false });

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as StorageFile[];
    },
    staleTime: 60 * 1000,
  });
}

/** Get files for a specific entity (e.g. all PDFs for a book). */
export function useStorageFilesByEntity(toolCode: string, entityId: string) {
  return useQuery({
    queryKey: storageKeys.filesByEntity(toolCode, entityId),
    queryFn: async (): Promise<StorageFile[]> => {
      const { data, error } = await authClient
        .from('storage_files')
        .select('*')
        .eq('tool_code', toolCode)
        .eq('entity_id', entityId)
        .eq('status', 'active');
      if (error) throw new Error(error.message);
      return (data ?? []) as StorageFile[];
    },
    enabled: !!toolCode && !!entityId,
    staleTime: 60 * 1000,
  });
}

// ─── Imperative: selectStorageCredential ────────────────────

/**
 * Select the best storage credential from a pool.
 * Strategy: active credentials, ordered by priority DESC then storage_used_bytes ASC.
 * Returns the least-used credential with available capacity.
 *
 * @param profileId - The service_profile ID for the storage provider.
 */
export async function selectStorageCredential(profileId: string): Promise<StorageCredentialInfo | null> {
  const { data, error } = await authClient
    .from('service_credentials')
    .select('id, identifier, storage_capacity_bytes, storage_used_bytes, storage_root_folder_id, status, priority')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .in('credential_kind', ['storage', 'oauth'])
    .not('storage_capacity_bytes', 'is', null)
    .order('priority', { ascending: false })
    .order('storage_used_bytes', { ascending: true });

  if (error || !data || data.length === 0) return null;

  // Find first credential with available capacity (< 95%)
  for (const cred of data as StorageCredentialInfo[]) {
    if (!cred.storage_capacity_bytes) continue;
    const usedRatio = (cred.storage_used_bytes ?? 0) / cred.storage_capacity_bytes;
    if (usedRatio < 0.95) return cred;
  }

  // All full
  return null;
}

// ─── Imperative: registerFile ───────────────────────────────

/**
 * Register a file in the central index after uploading to provider.
 * Also updates credential.storage_used_bytes.
 *
 * @returns The created StorageFile record.
 */
export async function registerFile(input: RegisterFileInput): Promise<StorageFile> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('[core-sdk] Not authenticated');

  // 1. Insert file record
  const { data, error } = await authClient
    .from('storage_files')
    .insert({
      credential_id: input.credentialId,
      remote_file_id: input.remoteFileId,
      remote_folder_id: input.remoteFolderId ?? null,
      original_name: input.originalName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      checksum: input.checksum ?? null,
      uploaded_by: userId,
      tool_code: input.toolCode ?? null,
      entity_id: input.entityId ?? null,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) throw new Error(`[core-sdk] registerFile failed: ${error.message}`);

  // 2. Update credential storage_used_bytes via atomic RPC
  await authClient.rpc('increment_storage_used', {
    cred_id: input.credentialId,
    bytes_to_add: input.sizeBytes,
  });

  return data as StorageFile;
}

// ─── Imperative: deleteFile ─────────────────────────────────

/**
 * Soft-delete a file. Marks status='deleted', sets deleted_at.
 * Actual provider deletion should be handled by a background job.
 * Decrements credential.storage_used_bytes.
 */
export async function deleteFile(fileId: string): Promise<void> {
  // 1. Get file info
  const { data: file, error: fileErr } = await authClient
    .from('storage_files')
    .select('id, credential_id, size_bytes, status')
    .eq('id', fileId)
    .single();

  if (fileErr || !file) throw new Error(`[core-sdk] File "${fileId}" not found`);
  if ((file as StorageFile).status === 'deleted') return; // Already deleted

  const { credential_id, size_bytes } = file as { credential_id: string; size_bytes: number };

  // 2. Mark as deleted
  await authClient
    .from('storage_files')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', fileId);

  // 3. Decrement credential storage via atomic RPC
  await authClient.rpc('decrement_storage_used', {
    cred_id: credential_id,
    bytes_to_remove: size_bytes,
  });
}

// ─── Imperative: getFileUrl ─────────────────────────────────

/**
 * Resolve a storage file to its download info.
 * Returns credential + remote file ID so caller can build provider-specific URL.
 * (Provider-specific download logic lives in each plugin, not here.)
 */
export async function getFileInfo(fileId: string): Promise<{
  remoteFileId: string;
  credentialId: string;
  mimeType: string;
  originalName: string;
} | null> {
  const { data, error } = await authClient
    .from('storage_files')
    .select('remote_file_id, credential_id, mime_type, original_name')
    .eq('id', fileId)
    .eq('status', 'active')
    .single();

  if (error || !data) return null;

  return {
    remoteFileId: data.remote_file_id as string,
    credentialId: data.credential_id as string,
    mimeType: data.mime_type as string,
    originalName: data.original_name as string,
  };
}

// ─── Mutation hooks (React) ─────────────────────────────────

/** Hook wrapper for registerFile. */
export function useRegisterFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: registerFile,
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'storage-files'] });
      if (data.tool_code && data.entity_id) {
        void qc.invalidateQueries({
          queryKey: storageKeys.filesByEntity(data.tool_code, data.entity_id),
        });
      }
    },
  });
}

/** Hook wrapper for deleteFile. */
export function useDeleteStorageFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-sdk', 'storage-files'] });
    },
  });
}