import { ConfigService } from '@nestjs/config';
import { SsrfError, SsrfService } from './ssrf.service';

function makeService(allowPrivate = false): SsrfService {
  const config = {
    get: (key: string) =>
      key === 'ssrfAllowPrivate' ? allowPrivate : undefined,
  } as unknown as ConfigService;
  return new SsrfService(config as unknown as ConfigService<never, true>);
}

describe('SsrfService.isPublicIp', () => {
  const svc = makeService(false);

  it.each([
    ['127.0.0.1', false],
    ['10.0.0.5', false],
    ['192.168.1.10', false],
    ['172.16.0.1', false],
    ['169.254.169.254', false], // cloud metadata (link-local)
    ['100.64.0.1', false], // carrier-grade NAT
    ['0.0.0.0', false],
    ['::1', false],
    ['::ffff:127.0.0.1', false], // IPv4-mapped loopback
    ['fe80::1', false], // link-local v6
    ['fc00::1', false], // unique-local v6
    ['8.8.8.8', true],
    ['1.1.1.1', true],
  ])('classifies %s', (ip, expected) => {
    expect(svc.isPublicIp(ip)).toBe(expected);
  });

  it('allows everything when allowPrivate=true', () => {
    expect(makeService(true).isPublicIp('127.0.0.1')).toBe(true);
  });
});

describe('SsrfService.validateUrl', () => {
  const svc = makeService(false);

  it('accepts a normal https URL', () => {
    expect(svc.validateUrl('https://example.com/docs').hostname).toBe(
      'example.com',
    );
  });

  it.each([
    'ftp://example.com',
    'file:///etc/passwd',
    'gopher://example.com',
    'javascript:alert(1)',
  ])('rejects non-http scheme %s', (url) => {
    expect(() => svc.validateUrl(url)).toThrow(SsrfError);
  });

  it('rejects embedded credentials', () => {
    expect(() => svc.validateUrl('http://user:pass@example.com')).toThrow(
      SsrfError,
    );
  });

  it('rejects disallowed ports', () => {
    expect(() => svc.validateUrl('http://example.com:22')).toThrow(SsrfError);
  });

  it('rejects private IP-literal hosts', () => {
    expect(() => svc.validateUrl('http://127.0.0.1/admin')).toThrow(SsrfError);
    expect(() =>
      svc.validateUrl('http://169.254.169.254/latest/meta-data'),
    ).toThrow(SsrfError);
  });

  it('rejects garbage input', () => {
    expect(() => svc.validateUrl('not a url')).toThrow(SsrfError);
  });
});
