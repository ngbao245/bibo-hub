// ============================================================
// Drive Backup — upload bản gốc PDF lên Google Drive (fire-and-forget)
// ============================================================
//
// Dùng OAuth2 refresh token (personal Google account).
// Config 1 lần: Client ID + Client Secret + Refresh Token + Folder ID.
// Upload via Drive API v3 resumable upload.
// Retry 1 lần nếu fail, silent log console.warn.
// ============================================================

import type { DriveBackupConfigValue } from '@/api/settingsApi';

export type DriveBackupConfig = DriveBackupConfigValue;

// ---- Token cache (in-memory, không persist) ----
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

// ---- OAuth2 token exchange ----

async function getAccessToken(config: DriveBackupConfig): Promise<string> {
  // Return cached if still valid (5min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    client_id: config.client_id,
    client_secret: config.client_secret,
    refresh_token: config.refresh_token,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in as number) * 1000;
  return cachedToken;
}

// ---- File naming ----

const INVALID_CHARS = /[/\\:*?"<>|]/g;

export function sanitizeDriveFilename(title: string): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const clean = title.replace(INVALID_CHARS, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${clean || 'file'}_${dd}-${mm}-${yyyy}.pdf`;
}

// ---- Upload (resumable) ----

async function resumableUpload(
  file: File,
  filename: string,
  folderId: string,
  token: string,
): Promise<string> {
  // Step 1: initiate resumable upload
  const metadata = { name: filename, parents: [folderId] };
  const initRes = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/pdf',
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Drive init failed (${initRes.status}): ${text}`);
  }

  const uploadUri = initRes.headers.get('Location');
  if (!uploadUri) throw new Error('No upload URI in response');

  // Step 2: upload file content
  const uploadRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(file.size),
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Drive upload failed (${uploadRes.status}): ${text}`);
  }

  const result = await uploadRes.json();
  return result.id as string;
}

// ---- Public API ----

/**
 * Upload file lên Google Drive. Retry 1 lần sau 2s nếu fail.
 * Fire-and-forget — caller nên `.catch()` để swallow error.
 */
export async function uploadToDrive(
  file: File,
  title: string,
  config: DriveBackupConfig,
): Promise<void> {
  if (!navigator.onLine) {
    // eslint-disable-next-line no-console
    console.warn('[drive-backup] Offline, skipping upload');
    return;
  }

  const filename = sanitizeDriveFilename(title);

  const attempt = async (isRetry: boolean): Promise<void> => {
    try {
      // Invalidate cached token on retry (might be expired)
      if (isRetry) {
        cachedToken = null;
        tokenExpiresAt = 0;
      }
      const token = await getAccessToken(config);
      const fileId = await resumableUpload(file, filename, config.folder_id, token);
      // eslint-disable-next-line no-console
      console.info(`[drive-backup] Uploaded: ${filename} → ${fileId}`);
    } catch (err) {
      if (!isRetry) {
        // Retry once after 2s
        await new Promise((r) => setTimeout(r, 2000));
        return attempt(true);
      }
      // Final fail — silent log
      // eslint-disable-next-line no-console
      console.warn(
        `[drive-backup] Failed: ${filename} —`,
        err instanceof Error ? err.message : err,
      );
    }
  };

  await attempt(false);
}

/**
 * Test connection: list 1 file in folder to verify access.
 */
export async function testDriveConnection(config: DriveBackupConfig): Promise<boolean> {
  try {
    const token = await getAccessToken(config);
    const res = await fetch(
      `${DRIVE_FILES_URL}?q='${encodeURIComponent(config.folder_id)}'+in+parents&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}