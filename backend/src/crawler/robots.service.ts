import { Injectable, Logger } from '@nestjs/common';
import robotsParser, { Robot } from 'robots-parser';
import { SsrfService } from '../security/ssrf.service';

/**
 * Fetches and caches robots.txt per origin and exposes allow/crawl-delay/
 * sitemap lookups. A failed robots fetch is treated as "allow all" (the common
 * convention) but logged.
 */
@Injectable()
export class RobotsService {
  private readonly logger = new Logger(RobotsService.name);
  private readonly cache = new Map<string, Robot | null>();

  constructor(private readonly ssrf: SsrfService) {}

  private robotsUrl(target: string): string {
    const u = new URL(target);
    return `${u.protocol}//${u.host}/robots.txt`;
  }

  async load(
    target: string,
    userAgent: string,
    timeoutMs: number,
  ): Promise<void> {
    const key = new URL(target).origin;
    if (this.cache.has(key)) return;
    const robotsUrl = this.robotsUrl(target);
    try {
      const res = await this.ssrf.safeFetch(robotsUrl, {
        userAgent,
        timeoutMs,
        maxBytes: 512 * 1024,
      });
      if (res.status >= 200 && res.status < 300 && res.body.trim()) {
        this.cache.set(key, robotsParser(robotsUrl, res.body));
      } else {
        this.cache.set(key, null); // no rules → allow all
      }
    } catch (err) {
      this.logger.warn(
        `robots.txt fetch failed for ${key}: ${(err as Error).message} — allowing all`,
      );
      this.cache.set(key, null);
    }
  }

  isAllowed(target: string, userAgent: string): boolean {
    const key = new URL(target).origin;
    const robot = this.cache.get(key);
    if (!robot) return true;
    // robots-parser returns undefined when no rule matches → allowed.
    return robot.isAllowed(target, userAgent) ?? true;
  }

  crawlDelaySeconds(target: string, userAgent: string): number | undefined {
    const key = new URL(target).origin;
    const robot = this.cache.get(key);
    if (!robot) return undefined;
    return robot.getCrawlDelay(userAgent);
  }

  sitemaps(target: string): string[] {
    const key = new URL(target).origin;
    const robot = this.cache.get(key);
    if (!robot) return [];
    return robot.getSitemaps();
  }
}
