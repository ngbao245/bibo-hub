// ============================================================
// Service Registry — Test connection per provider
// ============================================================

import type { ServiceCredential } from './types';

/**
 * Test a credential's connectivity. Provider-specific logic.
 * Returns true if connection successful, false otherwise.
 */
export async function testCredentialConnection(
  providerCode: string,
  credential: ServiceCredential,
): Promise<boolean> {
  const secret = credential.secret_data_json ?? {};

  switch (providerCode) {
    case 'gemini':
      return testGemini(secret);
    case 'ilovepdf':
      return testIlovepdf(secret);
    case 'google_drive':
      return testDrive(secret);
    case 'firebase':
      return testFirebase(secret);
    case 'metered_turn':
      return testTurn(secret);
    default:
      return false;
  }
}

async function testGemini(secret: Record<string, unknown>): Promise<boolean> {
  const apiKey = secret.apiKey as string | undefined;
  if (!apiKey) return false;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(10000) },
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function testIlovepdf(secret: Record<string, unknown>): Promise<boolean> {
  const publicKey = (secret.public_key ?? secret.key) as string | undefined;
  if (!publicKey) return false;
  try {
    // Use the existing testKey from library
    const { testKey } = await import('@/lib/library/pdf-compress');
    return testKey(publicKey);
  } catch {
    return false;
  }
}

async function testDrive(secret: Record<string, unknown>): Promise<boolean> {
  const clientId = secret.client_id as string | undefined;
  const clientSecret = secret.client_secret as string | undefined;
  const refreshToken = secret.refresh_token as string | undefined;
  const folderId = secret.folder_id as string | undefined;
  if (!clientId || !clientSecret || !refreshToken || !folderId) return false;
  try {
    const { testDriveConnection } = await import('@/lib/library/drive-backup');
    return testDriveConnection({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, folder_id: folderId });
  } catch {
    return false;
  }
}

async function testFirebase(secret: Record<string, unknown>): Promise<boolean> {
  const databaseURL = secret.databaseURL as string | undefined;
  if (!databaseURL) return false;
  try {
    const res = await fetch(`${databaseURL}/.json?shallow=true`, {
      signal: AbortSignal.timeout(10000),
    });
    // Firebase returns 401 for invalid auth but 200 for public or valid
    return res.status === 200 || res.status === 401;
  } catch {
    return false;
  }
}

async function testTurn(secret: Record<string, unknown>): Promise<boolean> {
  const username = secret.username as string | undefined;
  const credential = secret.credential as string | undefined;
  if (!username || !credential) return false;
  // TURN servers can't be easily tested via HTTP — validate credentials exist
  return true;
}