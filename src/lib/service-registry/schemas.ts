// ============================================================
// Service Registry — Zod validation schemas
// ============================================================

import { z } from 'zod';

export const providerCategorySchema = z.enum(['ai', 'pdf', 'conversion', 'storage', 'realtime', 'networking']);

export const providerStatusSchema = z.enum(['active', 'disabled']);

export const credentialStatusSchema = z.enum(['active', 'disabled', 'exhausted', 'cooldown', 'invalid', 'error']);

export const selectionStrategySchema = z.enum(['round_robin', 'least_used', 'priority', 'available_first']);

export const profileSettingsSchema = z.object({
  keySelectionStrategy: selectionStrategySchema.optional(),
  defaultTimeout: z.number().positive().optional(),
  cooldownDuration: z.number().positive().optional(),
  defaultModel: z.string().optional(),
}).passthrough();

export const createProfileSchema = z.object({
  provider_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  status: providerStatusSchema.optional(),
  settings_json: profileSettingsSchema.optional(),
});

export const updateProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  status: providerStatusSchema.optional(),
  settings_json: profileSettingsSchema.optional(),
});

export const createCredentialSchema = z.object({
  profile_id: z.string().uuid(),
  name: z.string().max(100).optional(),
  identifier: z.string().min(1).max(500),
  secret_data_json: z.record(z.unknown()).optional(),
  status: credentialStatusSchema.optional(),
  priority: z.number().int().min(0).optional(),
  weight: z.number().int().min(1).optional(),
  quota_limit: z.number().int().positive().nullable().optional(),
});

export const updateCredentialSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(100).nullable().optional(),
  identifier: z.string().min(1).max(500).optional(),
  secret_data_json: z.record(z.unknown()).nullable().optional(),
  status: credentialStatusSchema.optional(),
  priority: z.number().int().min(0).optional(),
  weight: z.number().int().min(1).optional(),
  quota_limit: z.number().int().positive().nullable().optional(),
  quota_used: z.number().int().min(0).nullable().optional(),
  quota_reset_at: z.string().nullable().optional(),
  cooldown_until: z.string().nullable().optional(),
  last_used_at: z.string().nullable().optional(),
  last_success_at: z.string().nullable().optional(),
  last_error_at: z.string().nullable().optional(),
  last_error_code: z.string().nullable().optional(),
  last_error_message: z.string().nullable().optional(),
});

export const createBindingSchema = z.object({
  tool_code: z.string().min(1).max(50),
  capability: z.string().min(1).max(50),
  profile_id: z.string().uuid(),
  is_primary: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrides_json: z.record(z.unknown()).optional(),
});

export const updateBindingSchema = z.object({
  id: z.string().uuid(),
  tool_code: z.string().min(1).max(50).optional(),
  capability: z.string().min(1).max(50).optional(),
  profile_id: z.string().uuid().nullable().optional(),
  is_primary: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  overrides_json: z.record(z.unknown()).optional(),
});

export const updateToolSettingsSchema = z.object({
  tool_code: z.string().min(1).max(50),
  settings_json: z.record(z.unknown()),
});