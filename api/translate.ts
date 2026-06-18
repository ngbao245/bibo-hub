// Vercel edge function — proxy for Google Translate's unofficial endpoint.
// Used by the Reader tool's translate popover. Browser also falls back to
// calling Google directly when the proxy is unavailable (e.g. local dev).
//
// POST /api/translate { text, source, target } -> { translated, detected }

import { parseGoogleResponse } from '../src/lib/reader/translate.js';

export const config = { runtime: 'edge' };

interface Body {
  text?: string;
  source?: string;
  target?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const text = (body.text ?? '').trim();
  const source = body.source || 'auto';
  const target = body.target || 'vi';
  if (!text) return new Response('Missing text', { status: 400 });
  if (text.length > 5000) return new Response('Text too long', { status: 413 });

  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', source);
  url.searchParams.set('tl', target);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const upstream = await fetch(url.toString());
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: `Upstream HTTP ${upstream.status}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const data = (await upstream.json()) as unknown;
  const result = parseGoogleResponse(data);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}