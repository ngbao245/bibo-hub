// XHR-based upload wrapper that emits progress events. supabase-js hiện chưa
// hỗ trợ progress trong storage.upload() — dùng direct REST endpoint tránh
// blocking user với upload lớn.
//
// Reference: https://supabase.com/docs/reference/javascript/storage-from-upload
// POST /storage/v1/object/{bucket}/{path}
//   headers:
//     authorization: Bearer <session token>
//     x-upsert: true|false
//     cache-control: max-age=3600
//     content-type: ...

import { supabase, BUCKET, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

interface UploadOpts {
  bucket?: string;
  cacheControl?: string;
  upsert?: boolean;
  contentType?: string;
  onProgress?: (ev: UploadProgressEvent) => void;
  /** Override Supabase URL (for storage pool nodes). */
  supabaseUrl?: string;
  /** Override auth token/key (for storage pool nodes using service_role_key). */
  authKey?: string;
  /** Skip fetching session token — use authKey directly as Bearer. */
  useServiceRole?: boolean;
}

export async function uploadWithProgress(
  path: string,
  file: Blob,
  opts: UploadOpts = {},
): Promise<void> {
  let token: string;
  let apikey: string;
  const baseUrl = opts.supabaseUrl ?? SUPABASE_URL;

  if (opts.useServiceRole && opts.authKey) {
    // Storage pool mode: use service_role_key directly
    token = opts.authKey;
    apikey = opts.authKey;
  } else {
    // Legacy mode: use session token
    const { data: sessionData } = await supabase.auth.getSession();
    token = sessionData.session?.access_token ?? '';
    apikey = SUPABASE_ANON_KEY;
    if (!token) throw new Error('Not authenticated');
  }

  const bucket = opts.bucket ?? BUCKET;
  const url = `${baseUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', apikey);
    xhr.setRequestHeader('x-upsert', opts.upsert ? 'true' : 'false');
    xhr.setRequestHeader('cache-control', opts.cacheControl ?? '3600');
    if (opts.contentType) xhr.setRequestHeader('content-type', opts.contentType);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      opts.onProgress?.({
        loaded: e.loaded,
        total: e.total,
        percent: e.total > 0 ? e.loaded / e.total : 0,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed ${xhr.status}: ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.send(file);
  });
}