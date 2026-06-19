// Free translation via Google Translate's unofficial endpoint.
// In production, calls go through /api/translate (Vercel edge function).
// In dev (vite serve), the proxy is unavailable so we fall back to a direct
// browser fetch — Google's gtx endpoint allows CORS.

export interface TranslateInput {
  text: string;
  source: string;
  target: string;
}

export interface TranslateResult {
  translated: string;
  detected: string | null;
}

const GOOGLE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

export async function translate(input: TranslateInput): Promise<TranslateResult> {
  try {
    console.log('[Translate] Trying /api/translate (Vercel edge function)...');
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      console.log('[Translate] ✓ Used /api/translate');
      return (await res.json()) as TranslateResult;
    }
    console.log(`[Translate] /api/translate failed (${res.status}), falling back to Google direct`);
  } catch (e) {
    console.log('[Translate] /api/translate error:', e, '→ falling back to Google direct');
  }
  return translateDirect(input);
}

export async function translateDirect(input: TranslateInput): Promise<TranslateResult> {
  console.log('[Translate] Using Google API direct:', GOOGLE_ENDPOINT);
  const url = new URL(GOOGLE_ENDPOINT);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', input.source);
  url.searchParams.set('tl', input.target);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', input.text);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Translate failed: HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  console.log('[Translate] ✓ Google API direct success');
  return parseGoogleResponse(data);
}

export function parseGoogleResponse(data: unknown): TranslateResult {
  if (!Array.isArray(data)) throw new Error('Unexpected translate response');
  const chunks = Array.isArray(data[0]) ? (data[0] as unknown[]) : [];
  const translated = chunks
    .map((c) => (Array.isArray(c) && typeof c[0] === 'string' ? c[0] : ''))
    .join('');
  const detected = typeof data[2] === 'string' ? (data[2] as string) : null;
  return { translated, detected };
}