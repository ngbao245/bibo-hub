// ============================================================
// Server Executor — Client-side wrapper for Edge Function
// ============================================================
// Replaces direct browser-side credential access with a call
// to the service-executor Edge Function. Browser never sees
// raw API keys; only receives scoped descriptors/tokens.
//
// Usage:
//   const result = await serverExecutor.execute({
//     toolCode: 'pdf_studio',
//     capability: 'pdf.convert',
//     payload: { tool: 'officepdf', input_format: 'docx', output_format: 'pdf' },
//   });
// ============================================================

import { authClient } from '@/lib/authClient';

export interface ServerExecuteRequest {
  toolCode: string;
  capability: string;
  payload?: Record<string, unknown>;
}

export interface ServerExecuteResult {
  success: boolean;
  provider_code?: string;
  credential_id?: string;
  identifier?: string;
  descriptor?: ProviderDescriptor;
  overrides?: Record<string, unknown>;
  error?: string;
}

export type ProviderDescriptor =
  | GeminiDescriptor
  | IlovepdfDescriptor
  | CloudConvertDescriptor
  | DriveDescriptor;

export interface GeminiDescriptor {
  type: 'server_execute';
  provider: 'gemini';
  credential_id: string;
}

export interface IlovepdfDescriptor {
  type: 'direct_upload';
  provider: 'ilovepdf';
  credential_id: string;
  token: string;
  server: string;
  task: string;
}

export interface CloudConvertDescriptor {
  type: 'server_execute';
  provider: 'cloudconvert';
  credential_id: string;
  api_base: string;
}

export interface DriveDescriptor {
  type: 'direct_upload';
  provider: 'google_drive';
  credential_id: string;
  access_token: string;
  expires_in: number;
  folder_id: string;
}

// ─── Edge Function URL ──────────────────────────────────────

function getEdgeFunctionUrl(): string {
  // Core project Supabase URL (same as authClient)
  const supabaseUrl = (authClient as unknown as { supabaseUrl: string }).supabaseUrl
    ?? import.meta.env.VITE_SUPABASE_URL
    ?? '';
  return `${supabaseUrl}/functions/v1/service-executor`;
}

async function getAuthToken(): Promise<string | null> {
  const { data } = await authClient.auth.getSession();
  return data.session?.access_token ?? null;
}

// ─── Execute: get scoped descriptor ─────────────────────────

async function execute(request: ServerExecuteRequest): Promise<ServerExecuteResult> {
  const token = await getAuthToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const res = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'execute',
        tool_code: request.toolCode,
        capability: request.capability,
        payload: request.payload,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    }

    return data as ServerExecuteResult;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

// ─── Test connection (admin) ────────────────────────────────

export async function testConnectionServer(credentialId: string): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;

  try {
    const res = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'test-connection',
        tool_code: '_admin',
        capability: '_admin',
        payload: { credential_id: credentialId },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// ─── Reserve credits ────────────────────────────────────────

export interface ReserveCreditsRequest {
  toolCode: string;
  capability: string;
  jobId: string;
  credentialId: string;
  providerCode: string;
  estimatedCredits?: number;
}

export async function reserveCredits(request: ReserveCreditsRequest): Promise<{ success: boolean; reservation_id?: string; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  try {
    const res = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'reserve-credits',
        tool_code: request.toolCode,
        capability: request.capability,
        payload: {
          job_id: request.jobId,
          credential_id: request.credentialId,
          provider_code: request.providerCode,
          estimated_credits: request.estimatedCredits ?? 1,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    return await res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ─── Commit/refund credits ──────────────────────────────────

export interface CommitCreditsRequest {
  toolCode: string;
  capability: string;
  reservationId: string;
  outcome: 'committed' | 'refunded' | 'expired';
  actualCredits?: number;
}

export async function commitCredits(request: CommitCreditsRequest): Promise<{ success: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  try {
    const res = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'commit-credits',
        tool_code: request.toolCode,
        capability: request.capability,
        payload: {
          reservation_id: request.reservationId,
          outcome: request.outcome,
          actual_credits: request.actualCredits,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    return await res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ─── Update credential status (admin) ───────────────────────

export interface UpdateStatusRequest {
  credentialId: string;
  status: string;
  cooldownUntil?: string;
  errorMessage?: string;
}

export async function updateCredentialStatus(request: UpdateStatusRequest): Promise<{ success: boolean; error?: string }> {
  const token = await getAuthToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  try {
    const res = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'update-status',
        tool_code: '_admin',
        capability: '_admin',
        payload: {
          credential_id: request.credentialId,
          status: request.status,
          cooldown_until: request.cooldownUntil,
          last_error_message: request.errorMessage,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    return await res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ─── Public API ─────────────────────────────────────────────

export const serverExecutor = { execute };
