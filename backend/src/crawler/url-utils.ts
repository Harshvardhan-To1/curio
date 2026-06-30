/**
 * URL normalization for crawl dedup and same-origin checks.
 * The normalized form is used as the dedup key; we keep a separate set of
 * tracking-param strippers so `?a=1&utm_source=x` and `?a=1` collapse.
 */

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
];

/** File extensions we never want to crawl (binaries / media / archives). */
const SKIP_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'ico',
  'bmp',
  'tif',
  'tiff',
  'mp4',
  'webm',
  'mov',
  'avi',
  'mkv',
  'mp3',
  'wav',
  'ogg',
  'flac',
  'pdf',
  'zip',
  'gz',
  'tar',
  'rar',
  '7z',
  'dmg',
  'exe',
  'bin',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'css',
  'js',
  'json',
  'xml',
  'rss',
]);

export function normalizeUrl(input: string, base?: string): string | null {
  let url: URL;
  try {
    url = base ? new URL(input, base) : new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  // Drop fragments - they never identify a distinct document.
  url.hash = '';

  // Lowercase host; strip default ports.
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  // Strip known tracking params, then sort the rest for a stable key.
  const params = url.searchParams;
  for (const p of TRACKING_PARAMS) params.delete(p);
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  for (const [k, v] of sorted) url.searchParams.append(k, v);

  // Collapse a trailing slash on non-root paths.
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function getExtension(urlStr: string): string | null {
  try {
    const { pathname } = new URL(urlStr);
    const last = pathname.split('/').pop() ?? '';
    const dot = last.lastIndexOf('.');
    if (dot <= 0) return null;
    return last.slice(dot + 1).toLowerCase();
  } catch {
    return null;
  }
}

export function isCrawlableUrl(urlStr: string): boolean {
  const ext = getExtension(urlStr);
  return ext === null || !SKIP_EXTENSIONS.has(ext);
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** True if `candidate` is the same registrable host or a subdomain of `seed`. */
export function sameSite(seed: string, candidate: string): boolean {
  try {
    const s = new URL(seed).hostname.toLowerCase();
    const c = new URL(candidate).hostname.toLowerCase();
    return c === s || c.endsWith(`.${s}`) || s.endsWith(`.${c}`);
  } catch {
    return false;
  }
}
