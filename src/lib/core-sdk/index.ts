// ============================================================
// Core SDK — Public exports
// ============================================================
// Single entry point for plugin/tool consumption.
//
// Usage:
//   import { useDataSource, checkPermission, useArtifacts } from '@/lib/core-sdk';
// ============================================================

// ─── Types ──────────────────────────────────────────────────
export type {
  Datasource,
  DatasourceDriver,
  DatasourceConnection,
  SupabaseConnection,
  MockApiConnection,
  EmptyConnection,
  EntityStatus,
  ToolRecord,
  ToolWithDatasource,
  RequiredCapability,
  Artifact,
  ArtifactKind,
  ArtifactStatus,
  ArtifactMetadata,
  CreateArtifactInput,
  UpdateArtifactInput,
  CreateDatasourceInput,
  UpdateDatasourceInput,
} from './types';

// ─── Datasource routing ─────────────────────────────────────
export {
  useDataSource,
  useDatasources,
  getClientForTool,
  invalidateClientCache,
} from './datasource';

// ─── Auth helpers ───────────────────────────────────────────
export {
  authClient,
  getCurrentSession,
  getCurrentUserId,
  getCurrentProfile,
  isAdmin,
  checkPermission,
  getAllowedTools,
  signOut,
  getAccessToken,
} from './auth';
export type { Profile } from './auth';

// ─── Tools registry ─────────────────────────────────────────
export {
  useToolsRegistry,
  useToolByCode,
  useCreateTool,
  useUpdateTool,
  useDisableTool,
  syncToolBindings,
  toolKeys,
} from './tools';
export type { CreateToolInput, UpdateToolInput } from './tools';

// ─── Artifacts ──────────────────────────────────────────────
export {
  useArtifacts,
  useArtifact,
  useLatestArtifact,
  useCreateArtifact,
  useUpdateArtifact,
  useDeleteArtifact,
  artifactKeys,
} from './artifacts';

// ─── Credits ────────────────────────────────────────────────
export {
  checkQuota,
  deductCredits,
  refundCredits,
  useCreditPools,
  useCreditQuotas,
  useCreditUsage,
  useDeductCredits,
  useRefundCredits,
  creditKeys,
} from './credits';
export type {
  CreditPool,
  CreditPoolQuota,
  CreditUsageLog,
  QuotaCheckResult,
  DeductInput,
} from './credits';

// ─── Storage Pool ───────────────────────────────────────────
export {
  selectStorageCredential,
  registerFile,
  deleteFile,
  getFileInfo,
  useStorageFiles,
  useStorageFilesByEntity,
  useRegisterFile,
  useDeleteStorageFile,
  storageKeys,
} from './storage';
export type {
  StorageFile,
  RegisterFileInput,
  StorageCredentialInfo,
} from './storage';

// ─── Health Check ───────────────────────────────────────────
export {
  useSystemHealth,
  healthKeys,
} from './health';
export type {
  HealthStatus,
  ProviderHealth,
  SystemHealth,
} from './health';

// ─── Audit Log ──────────────────────────────────────────────
export {
  useAuditLog,
  logAuditAction,
  useLogAudit,
  auditKeys,
} from './audit';
export type { AuditEntry } from './audit';