// ============================================================
// Letter-avatar fallback for bookmarks without favicon.
// Deterministic HSL color from domain hash + first letter.
// ============================================================

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarBgColor(seed: string): string {
  const hue = hashString(seed || 'default') % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function avatarLetter(title: string, url: string): string {
  const clean = (title || '').trim();
  if (clean.length > 0) return clean[0].toUpperCase();
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return (domain[0] ?? '?').toUpperCase();
  } catch {
    return '?';
  }
}
