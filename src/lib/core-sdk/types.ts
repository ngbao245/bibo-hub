// ============================================================
// Core SDK — Type definitions
// ============================================================
// Mirrors DB tables: datasources, tools, artifacts.
// Used by core-sdk hooks and consumer components.
// ============================================================

/** Backend driver type for a datasource. */
export type DatasourceDriver = 'supabase' | 'mockapi' | 'none';

/** Status shared across multiple entities. */
export type EntityStatus = 'active' | 'disabled';

/** Artifact kinds stored in core.artifacts table. */
export type ArtifactKind = 'migration' | 'edge_function' | 'seed' | 'script' | 'shared';

/** Artifact lifecycle status. */
export type ArtifactStatus = 'latest' | 'deprecated' | 'draft';

// ─── Datasource ─────────────────────────────────────────────

export interface Datasource {
  id: string;
  code: string;
  name: string;
  driver: DatasourceDriver;
  /** supabase: {url, anon_key} | mockapi: {base_url} | none: {} */
  connection_json: DatasourceConnection;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

/** Connection config shape depends on driver. */
export type DatasourceConnection =
  | SupabaseConnection
  | MockApiConnection
  | EmptyConnection;

export interface SupabaseConnection {
  url: string;
  anon_key: string;
}

export interface MockApiConnection {
  base_url: string;
}

export type EmptyConnection = Record<string, never>;

// ─── Tool (DB row) ──────────────────────────────────────────

/** Declares a capability a tool needs + preferred provider. */
export interface RequiredCapability {
  capability: string;
  preferred_provider: string;
}

export interface ToolRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  datasource_id: string | null;
  required_capabilities: RequiredCapability[];
  status: EntityStatus;
  created_at: string;
}

/** Tool record joined with datasource info (for useDataSource resolution). */
export interface ToolWithDatasource extends ToolRecord {
  datasource: Datasource | null;
}

// ─── Artifact ───────────────────────────────────────────────

export interface Artifact {
  id: string;
  datasource_code: string;
  kind: ArtifactKind;
  name: string;
  path: string | null;
  version: number;
  content: string;
  content_hash: string | null;
  metadata_json: ArtifactMetadata;
  status: ArtifactStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Kind-specific metadata. */
export interface ArtifactMetadata {
  /** migration: execution order */
  order?: number;
  /** migration: dependencies */
  depends_on?: string[];
  /** edge_function: is this the entry file */
  entry?: boolean;
  /** edge_function: runtime */
  runtime?: string;
  /** edge_function: imported shared modules */
  imports?: string[];
  /** Allow additional keys */
  [key: string]: unknown;
}

// ─── Input types for mutations ──────────────────────────────

export interface CreateArtifactInput {
  datasource_code: string;
  kind: ArtifactKind;
  name: string;
  path?: string;
  version?: number;
  content: string;
  content_hash?: string;
  metadata_json?: ArtifactMetadata;
  status?: ArtifactStatus;
  created_by?: string;
}

export interface UpdateArtifactInput {
  id: string;
  content?: string;
  content_hash?: string;
  metadata_json?: ArtifactMetadata;
  status?: ArtifactStatus;
  path?: string;
}

export interface CreateDatasourceInput {
  code: string;
  name: string;
  driver: DatasourceDriver;
  connection_json?: DatasourceConnection;
  status?: EntityStatus;
}

export interface UpdateDatasourceInput {
  id: string;
  name?: string;
  driver?: DatasourceDriver;
  connection_json?: DatasourceConnection;
  status?: EntityStatus;
}