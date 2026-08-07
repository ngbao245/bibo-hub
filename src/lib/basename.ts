// ============================================================
// basename utility — detect basename cho production URL generation
// ============================================================
//
// Production: app deploy tại /hubibo → basename = '/hubibo'
// Development: app chạy tại root → basename = ''
//
// Dùng cho generate public URLs, preview links, share URLs, etc.
// ============================================================

/**
 * Detect basename từ current URL pathname.
 * Returns '/hubibo' nếu pathname chứa /hubibo, '' nếu không.
 */
export function getBasename(): string {
    return window.location.pathname.startsWith('/hubibo') ? '/hubibo' : '';
}

/**
 * Generate full public URL với basename detection.
 * @param path - Relative path (e.g., '/bookmarks/baobibo')
 * @returns Full URL with origin + basename + path
 */
export function getPublicUrl(path: string): string {
    const basename = getBasename();
    return `${window.location.origin}${basename}${path}`;
}

/**
 * Generate origin + basename (e.g., 'https://www.vudecor.vn/hubibo')
 */
export function getOriginWithBasename(): string {
    const basename = getBasename();
    return `${window.location.origin}${basename}`;
}
