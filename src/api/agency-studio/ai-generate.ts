// ============================================================
// AI Generate email template — JSON response (non-stream)
// ============================================================

import { authClient } from '@/lib/authClient';

export type EmailTone = 'formal' | 'casual' | 'friendly';

export interface GenerateEmailInput {
  tone: EmailTone;
  currentSubject?: string;
  currentBody?: string;
}

export interface GenerateEmailResult {
  subject: string;
  body: string;
}

/**
 * Call Edge Function gemini-generate-email. Trả JSON { subject, body }.
 * Throws Error nếu fail.
 */
export async function generateEmail(input: GenerateEmailInput): Promise<GenerateEmailResult> {
  const { data: { session } } = await authClient.auth.getSession();
  if (!session) throw new Error('Chưa login');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_AUTH_URL as string;
  const res = await fetch(`${supabaseUrl}/functions/v1/gemini-generate-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      tone: input.tone,
      current_subject: input.currentSubject,
      current_body: input.currentBody,
    }),
  });

  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));

  if (!res.ok || (data as { error?: string }).error) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const result = data as GenerateEmailResult;
  if (!result.subject || !result.body) {
    throw new Error('AI response thiếu subject hoặc body');
  }
  return result;
}