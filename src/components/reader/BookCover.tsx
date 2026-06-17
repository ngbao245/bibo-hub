import { useEffect, useState } from 'react';
import { downloadBookFile } from '@/api/reader/books';
import { fetchBlobThroughCache, STORE_COVERS } from '@/lib/reader/blob-cache';

/**
 * Render cover image cho 1 book.
 *
 * Strategy:
 *   1. Lookup IndexedDB store "covers" với key = path.
 *   2. Cache miss → SDK download() (bypass CORS), put cache.
 *   3. Render qua object URL (revoke khi unmount).
 */
export default function BookCover({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const blob = await fetchBlobThroughCache(STORE_COVERS, path, () =>
          downloadBookFile(path),
        );
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        // Library fallback hiển thị title text
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!url) return null;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
