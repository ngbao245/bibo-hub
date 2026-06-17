// =============================================================
// Upload to Supabase Storage WITH progress.
// =============================================================
//
// Supabase JS SDK chưa expose upload progress. Để có % thực tế,
// ta gọi trực tiếp REST endpoint qua XHR (XHR có upload.onprogress,
// fetch hiện tại chưa support cho request body).
//
// Endpoint: POST {SUPABASE_URL}/storage/v1/object/{bucket}/{path}
// Headers: Authorization: Bearer <access_token>
//          apikey: <anon_key>
//          x-upsert: false / true
//          cache-control: max-age=...
//          content-type: ...

import { supabase, BUCKET, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

export async function uploadWithProgress(
  path: string,
  body: Blob,
  opts: {
    contentType: string;
    cacheControl?: string;
    upsert?: boolean;
    onProgress?: (e: UploadProgressEvent) => void;
    bucket?: string;
  },
): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const bucket = opts.bucket ?? BUCKET;
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', opts.upsert ? 'true' : 'false');
    xhr.setRequestHeader('cache-control', opts.cacheControl ?? '3600');
    // Note: KHÔNG set Content-Type qua header rồi gửi blob — browser sẽ tự
    // detect. Set qua xhr.send sẽ override. Cách đúng: setRequestHeader trước.
    xhr.setRequestHeader('content-type', opts.contentType);

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const percent = Math.round((e.loaded / e.total) * 100);
      opts.onProgress?.({ loaded: e.loaded, total: e.total, percent });
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json?.message) msg += `: ${json.message}`;
        } catch {
          if (xhr.responseText) msg += `: ${xhr.responseText.slice(0, 200)}`;
        }
        reject(new Error(msg));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.send(body);
  });
}