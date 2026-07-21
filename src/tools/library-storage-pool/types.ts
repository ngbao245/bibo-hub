// ============================================================
// Library Storage Pool — Types
// ============================================================

/** A storage node backed by a Supabase project. */
export interface StorageNode {
  /** service_credentials.id */
  id: string;
  /** Human-readable name (e.g. "Node Alpha") */
  name: string;
  /** Supabase project URL */
  url: string;
  /** Service role key — for upload/delete (server-side-like ops) */
  serviceRoleKey: string;
  /** Anon key — for signed URL generation (read) */
  anonKey: string;
  /** Bucket name (default 'books') */
  bucketName: string;
  /** Total capacity in bytes (e.g. 1073741824 = 1GB) */
  capacityBytes: number;
  /** Bytes currently used */
  usedBytes: number;
  /** Node status */
  status: 'active' | 'disabled';
}

/** Credential row shape from service_credentials table. */
export interface StorageNodeCredential {
  id: string;
  name: string | null;
  identifier: string;
  secret_data_json: {
    url?: string;
    service_role_key?: string;
    anon_key?: string;
    bucket_name?: string;
  } | null;
  status: 'active' | 'disabled' | 'revoked';
  storage_capacity_bytes: number | null;
  storage_used_bytes: number | null;
}

/** Error when no node has enough remaining capacity. */
export class StoragePoolFullError extends Error {
  neededBytes: number;
  constructor(neededBytes: number) {
    super(`No storage node has enough space for ${(neededBytes / 1024 / 1024).toFixed(1)}MB. Add a new storage node.`);
    this.name = 'StoragePoolFullError';
    this.neededBytes = neededBytes;
  }
}