// ============================================================
// Service Registry — Public exports
// ============================================================

export { serviceExecutor } from './executor';
export type { ExecutorOptions, ExecutorCallback, ExecutorResult } from './executor';
export { filterAvailable, selectCredential, resetRoundRobin } from './strategies';
export { loadLegacyCredentials } from './legacy-fallback';
export * from './types';