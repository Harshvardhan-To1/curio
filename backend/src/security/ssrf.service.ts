import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'node:dns';
import ipaddr from 'ipaddr.js';
import { Agent, request as undiciRequest, Dispatcher } from 'undici';
import { AppConfig } from '../config/configuration';

/** Thrown when a URL/IP fails SSRF validation. Surface as HTTP 400. */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
// Conservative default port allowlist for outbound crawl fetches.
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);
const MAX_REDIRECTS = 5;

/**
 * ipaddr.js `range()` buckets that are NOT routable public unicast.
 * `169.254.169.254` (cloud metadata) falls under `linkLocal`, so it is covered.
 */
const BLOCKED_V4_RANGES = new Set([
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'loopback',
  'carrierGradeNat',
  'private',
  'reserved',
]);
const BLOCKED_V6_RANGES = new Set([
  'unspecified',
  'linkLocal',
  'multicast',
  'loopback',
  'uniqueLocal',
  'reserved',
]);

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
}

export interface SafeFetchOptions {
  userAgent: string;
  timeoutMs: number;
  maxBytes: number;
}

@Injectable()
export class SsrfService {
  private readonly logger = new Logger(SsrfService.name);
  private readonly allowPrivate: boolean;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    this.allowPrivate = this.config.get('ssrfAllowPrivate', { infer: true });
    if (this.allowPrivate) {
      this.logger.warn(
        'SSRF_ALLOW_PRIVATE is enabled - private/loopback IPs are reachable. ' +
          'This must NEVER be set in production.',
      );
    }
  }

  /** True if a literal IP string is a routable public address. */
  isPublicIp(ip: string): boolean {
    if (this.allowPrivate) return true;
    let addr: ipaddr.IPv4 | ipaddr.IPv6;
    try {
      addr = ipaddr.parse(ip);
    } catch {
      return false;
    }
    if (addr.kind() === 'ipv6') {
      const v6 = addr as ipaddr.IPv6;
      // Unwrap IPv4-mapped addresses (::ffff:127.0.0.1 etc.) and judge the v4.
      if (v6.isIPv4MappedAddress()) {
        return !BLOCKED_V4_RANGES.has(v6.toIPv4Address().range());
      }
      return !BLOCKED_V6_RANGES.has(v6.range());
    }
    return !BLOCKED_V4_RANGES.has(addr.range());
  }

  /**
   * Validate scheme, port, and shape of a user-supplied URL. Does NOT resolve
   * DNS - that happens at connect time so a TOCTOU/rebind can't slip past.
   */
  validateUrl(input: string): URL {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new SsrfError(`Not a valid URL: ${input}`);
    }
    if (!ALLOWED_SCHEMES.has(url.protocol)) {
      throw new SsrfError(`Scheme not allowed: ${url.protocol}`);
    }
    if (url.username || url.password) {
      throw new SsrfError('URLs with embedded credentials are not allowed');
    }
    const port = url.port
      ? Number(url.port)
      : url.protocol === 'https:'
        ? 443
        : 80;
    if (!this.allowPrivate && !ALLOWED_PORTS.has(port)) {
      throw new SsrfError(`Port not allowed: ${port}`);
    }
    // Reject IP-literal hosts that are obviously private up front.
    const hostIsIp = ipaddr.isValid(url.hostname);
    if (hostIsIp && !this.isPublicIp(url.hostname)) {
      throw new SsrfError(
        `Host resolves to a non-public address: ${url.hostname}`,
      );
    }
    return url;
  }

  /**
   * A DNS lookup that resolves the host, rejects any non-public result, and
   * pins the connection to a validated address. Plugged into undici's
   * connect() so the socket can only ever reach an address we approved.
   */
  private guardedLookup = (
    hostname: string,
    options: { all?: boolean } | undefined,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | dns.LookupAddress[],
      family?: number,
    ) => void,
  ): void => {
    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) return callback(err, '', 0);
      const safe = addresses.filter((a) => this.isPublicIp(a.address));
      if (safe.length === 0) {
        return callback(
          new SsrfError(`Host ${hostname} has no public IP address`),
          '',
          0,
        );
      }
      if (options && options.all) {
        // undici expects [{address, family}] here.
        return callback(null, safe);
      }
      callback(null, safe[0].address, safe[0].family);
    });
  };

  private makeDispatcher(timeoutMs: number): Agent {
    return new Agent({
      connect: { lookup: this.guardedLookup as never, timeout: timeoutMs },
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      maxRedirections: 0, // we follow manually so every hop is re-validated
    });
  }

  /**
   * Fetch a URL safely: validates scheme/port, pins DNS to public IPs, follows
   * redirects manually (re-validating each Location), and caps the body size.
   */
  async safeFetch(
    input: string,
    opts: SafeFetchOptions,
  ): Promise<SafeFetchResult> {
    const dispatcher = this.makeDispatcher(opts.timeoutMs);
    try {
      let current = this.validateUrl(input);
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const res = await undiciRequest(current.toString(), {
          dispatcher,
          method: 'GET',
          maxRedirections: 0,
          headers: {
            'user-agent': opts.userAgent,
            accept:
              'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          },
        });

        if (this.isRedirect(res.statusCode)) {
          const loc = this.headerValue(res.headers['location']);
          res.body.dump().catch(() => undefined);
          if (!loc) throw new SsrfError('Redirect without Location header');
          current = this.validateUrl(new URL(loc, current).toString());
          continue;
        }

        const contentType = this.headerValue(res.headers['content-type']) ?? '';
        const { body, truncated } = await this.readCapped(
          res.body,
          opts.maxBytes,
        );
        return {
          finalUrl: current.toString(),
          status: res.statusCode,
          contentType,
          body,
          truncated,
        };
      }
      throw new SsrfError(`Too many redirects (> ${MAX_REDIRECTS})`);
    } finally {
      await dispatcher.close().catch(() => undefined);
    }
  }

  private isRedirect(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status);
  }

  private headerValue(h: string | string[] | undefined): string | undefined {
    if (Array.isArray(h)) return h[0];
    return h;
  }

  private async readCapped(
    body: Dispatcher.ResponseData['body'],
    maxBytes: number,
  ): Promise<{ body: string; truncated: boolean }> {
    const chunks: Buffer[] = [];
    let total = 0;
    let truncated = false;
    for await (const chunk of body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        chunks.push(buf.subarray(0, buf.length - (total - maxBytes)));
        truncated = true;
        break;
      }
      chunks.push(buf);
    }
    body.destroy();
    return { body: Buffer.concat(chunks).toString('utf8'), truncated };
  }
}
