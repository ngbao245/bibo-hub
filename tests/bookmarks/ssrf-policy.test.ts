/**
 * Regression tests for SSRF URL safety policy used in fetch-bookmark-meta.
 * Tests the pure isPrivateHost and assertSafeUrl functions.
 * Does NOT call network — validates classification only.
 */
import { describe, it, expect } from 'vitest';

// ── Re-implement policy for unit testing (mirrors fetch-bookmark-meta/index.ts) ──

function isPrivateHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (h === '0.0.0.0' || h === '255.255.255.255') return true;
  if (/^0\./.test(h)) return true;

  if (h === '::1' || h === '::') return true;
  if (/^fe80:/i.test(h)) return true;
  if (/^fc00:/i.test(h) || /^fd/i.test(h)) return true;
  if (/^::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i.test(h)) return true;

  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
  if (lower === 'metadata.google.internal') return true;

  return false;
}

function assertSafeUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked scheme: ${url.protocol}`);
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error(`Blocked private/reserved host: ${url.hostname}`);
  }
  if (url.username || url.password) {
    throw new Error('URLs with credentials are not allowed');
  }
  return url;
}

// ── Tests ──

describe('isPrivateHost — IPv4 private ranges', () => {
  it.each([
    '127.0.0.1', '127.255.255.255',
    '10.0.0.1', '10.255.255.255',
    '172.16.0.1', '172.31.255.255',
    '192.168.0.1', '192.168.255.255',
    '169.254.169.254', '169.254.1.1',
    '0.0.0.0', '0.1.2.3',
  ])('classifies %s as private', (host) => {
    expect(isPrivateHost(host)).toBe(true);
  });

  it.each([
    '8.8.8.8', '1.1.1.1', '172.32.0.1', '192.167.1.1', '11.0.0.1',
  ])('classifies %s as public', (host) => {
    expect(isPrivateHost(host)).toBe(false);
  });
});

describe('isPrivateHost — IPv6', () => {
  it.each([
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:169.254.169.254',
  ])('classifies %s as private', (host) => {
    expect(isPrivateHost(host)).toBe(true);
  });

  it.each([
    '2001:db8::1', '2607:f8b0:4004:800::200e',
  ])('classifies %s as public', (host) => {
    expect(isPrivateHost(host)).toBe(false);
  });
});

describe('isPrivateHost — hostnames', () => {
  it('blocks localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true);
  });
  it('blocks subdomain.localhost', () => {
    expect(isPrivateHost('evil.localhost')).toBe(true);
  });
  it('blocks metadata.google.internal', () => {
    expect(isPrivateHost('metadata.google.internal')).toBe(true);
  });
  it('allows normal domains', () => {
    expect(isPrivateHost('example.com')).toBe(false);
    expect(isPrivateHost('github.com')).toBe(false);
  });
});

describe('assertSafeUrl — scheme validation', () => {
  it('allows https', () => {
    expect(() => assertSafeUrl('https://example.com')).not.toThrow();
  });
  it('allows http', () => {
    expect(() => assertSafeUrl('http://example.com')).not.toThrow();
  });
  it('blocks ftp', () => {
    expect(() => assertSafeUrl('ftp://example.com')).toThrow('Blocked scheme');
  });
  it('blocks file', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow('Blocked scheme');
  });
  it('blocks javascript', () => {
    expect(() => assertSafeUrl('javascript:alert(1)')).toThrow();
  });
  it('blocks data URI', () => {
    expect(() => assertSafeUrl('data:text/html,<script>alert(1)</script>')).toThrow();
  });
});

describe('assertSafeUrl — private host in URL', () => {
  it('blocks http://127.0.0.1/path', () => {
    expect(() => assertSafeUrl('http://127.0.0.1/admin')).toThrow('Blocked private');
  });
  it('blocks http://localhost:3000', () => {
    expect(() => assertSafeUrl('http://localhost:3000')).toThrow('Blocked private');
  });
  it('blocks cloud metadata endpoint', () => {
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/')).toThrow('Blocked private');
  });
  it('blocks http://[::1]/path', () => {
    expect(() => assertSafeUrl('http://[::1]/secret')).toThrow('Blocked private');
  });
  it('allows public URL', () => {
    const url = assertSafeUrl('https://github.com/user/repo');
    expect(url.hostname).toBe('github.com');
  });
});

describe('assertSafeUrl — credentials in URL', () => {
  it('blocks URL with username', () => {
    expect(() => assertSafeUrl('https://admin@example.com')).toThrow('credentials');
  });
  it('blocks URL with username:password', () => {
    expect(() => assertSafeUrl('https://user:pass@example.com')).toThrow('credentials');
  });
});

describe('assertSafeUrl — edge cases', () => {
  it('throws on invalid URL', () => {
    expect(() => assertSafeUrl('not a url')).toThrow();
  });
  it('allows URL with port on public host', () => {
    const url = assertSafeUrl('https://example.com:8443/api');
    expect(url.port).toBe('8443');
  });
  it('allows URL with path and query', () => {
    const url = assertSafeUrl('https://example.com/path?q=1&r=2#hash');
    expect(url.pathname).toBe('/path');
  });
});
