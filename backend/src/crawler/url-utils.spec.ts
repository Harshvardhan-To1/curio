import {
  getExtension,
  isCrawlableUrl,
  normalizeUrl,
  sameOrigin,
  sameSite,
} from './url-utils';

describe('normalizeUrl', () => {
  it('strips fragments and trailing slashes', () => {
    expect(normalizeUrl('https://a.com/docs/#section')).toBe(
      'https://a.com/docs',
    );
  });

  it('drops tracking params and sorts the rest', () => {
    expect(normalizeUrl('https://a.com/p?b=2&utm_source=x&a=1')).toBe(
      'https://a.com/p?a=1&b=2',
    );
  });

  it('removes default ports and lowercases host', () => {
    expect(normalizeUrl('https://Example.COM:443/Path')).toBe(
      'https://example.com/Path',
    );
  });

  it('resolves relative against a base', () => {
    expect(normalizeUrl('/about', 'https://a.com/team')).toBe(
      'https://a.com/about',
    );
  });

  it('returns null for non-http schemes', () => {
    expect(normalizeUrl('mailto:x@a.com')).toBeNull();
  });
});

describe('crawlability', () => {
  it('rejects binary/media extensions', () => {
    expect(isCrawlableUrl('https://a.com/file.pdf')).toBe(false);
    expect(isCrawlableUrl('https://a.com/img.png')).toBe(false);
  });
  it('accepts html-ish paths', () => {
    expect(isCrawlableUrl('https://a.com/about')).toBe(true);
    expect(isCrawlableUrl('https://a.com/post.html')).toBe(true);
  });
  it('extracts extension', () => {
    expect(getExtension('https://a.com/a/b.PDF')).toBe('pdf');
    expect(getExtension('https://a.com/a/b')).toBeNull();
  });
});

describe('scope checks', () => {
  it('sameOrigin is strict on host+scheme+port', () => {
    expect(sameOrigin('https://a.com/x', 'https://a.com/y')).toBe(true);
    expect(sameOrigin('https://a.com', 'https://sub.a.com')).toBe(false);
  });
  it('sameSite allows subdomains', () => {
    expect(sameSite('https://a.com', 'https://docs.a.com/x')).toBe(true);
    expect(sameSite('https://a.com', 'https://b.com')).toBe(false);
  });
});
