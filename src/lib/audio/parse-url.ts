/**
 * Parse YouTube URL hoặc raw 11-char video ID.
 * Hỗ trợ: youtu.be, watch?v=, embed/, shorts/, music.youtube.com
 */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  // Raw 11-char ID
  if (/^[\w-]{11}$/.test(raw)) return raw;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Fetch title từ YouTube oEmbed (CORS-friendly, không cần API key).
 * Trả về null nếu fail — caller dùng placeholder.
 */
export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return typeof data.title === 'string' ? data.title : null;
  } catch {
    return null;
  }
}